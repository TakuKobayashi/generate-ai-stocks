// packages/unity/Runtime/Transport/LiveKitTransport.cs
// IARTransport の LiveKit (WebRTC) 実装。
// LiveKit Unity SDK (io.livekit.unity) + com.unity.webrtc を使用。

using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Google.Protobuf;
using LiveKit;
using UnityEngine;
using AREditorPreview.Proto;

namespace AREditorPreview.Transport
{
    public sealed class LiveKitTransport : IARTransport
    {
        // ─── 定数 ──────────────────────────────────────────────
        private const int   QueueCapacity    = 256;
        private const int   PingIntervalMs   = 2000;
        private const float RttSmoothAlpha   = 0.1f;   // EMA 係数

        // ─── 状態 ──────────────────────────────────────────────
        public TransportState State    { get; private set; } = TransportState.Disconnected;
        public float          RttMs    { get; private set; } = -1f;

        public event Action<TransportState> OnStateChanged;
        public event Action<string>         OnParticipantJoined;
        public event Action<string>         OnParticipantLeft;

        // ─── 内部フィールド ────────────────────────────────────
        private Room         _room;
        private RenderTexture _cameraRT;
        private readonly ConcurrentQueue<ReceivedEnvelope> _queue
            = new ConcurrentQueue<ReceivedEnvelope>();

        private CancellationTokenSource _pingCts;
        private long _lastPingSentMs;

        // ─────────────────────────────────────────────────────────
        // 接続
        // ─────────────────────────────────────────────────────────

        public async Task ConnectAsync(TransportConnectParams p, CancellationToken ct = default)
        {
            if (State == TransportState.Connected) return;

            SetState(TransportState.Connecting);

            _room = new Room();
            RegisterEvents();

            var opts = new RoomOptions
            {
                AutoSubscribe                 = true,
                DefaultVideoPublishOptions    = null,   // 受信のみ
                DefaultAudioPublishOptions    = null,
            };

            await _room.ConnectAsync(p.ServerUrl, p.Token, opts);
            // ConnectAsync が正常に返れば Connected イベントが内部で発火される
        }

        public async Task DisconnectAsync()
        {
            StopPing();
            if (_room == null) return;

            UnregisterEvents();
            _room.Disconnect();
            _room = null;

            CleanupTexture();
            SetState(TransportState.Disconnected);
            await Task.CompletedTask;
        }

        // ─────────────────────────────────────────────────────────
        // データ取り出し (メインスレッドから)
        // ─────────────────────────────────────────────────────────

        public int DequeueEnvelopes(Span<ReceivedEnvelope> buffer)
        {
            int count = 0;
            while (count < buffer.Length && _queue.TryDequeue(out var env))
                buffer[count++] = env;
            return count;
        }

        public Texture GetLatestCameraTexture() => _cameraRT;

        // ─────────────────────────────────────────────────────────
        // LiveKit ルームイベント
        // ─────────────────────────────────────────────────────────

        private void RegisterEvents()
        {
            _room.Connected         += HandleConnected;
            _room.Disconnected      += HandleDisconnected;
            _room.TrackSubscribed   += HandleTrackSubscribed;
            _room.TrackUnsubscribed += HandleTrackUnsubscribed;
            _room.DataReceived      += HandleDataReceived;
            _room.ParticipantConnected    += p => OnParticipantJoined?.Invoke(p.Identity);
            _room.ParticipantDisconnected += p => OnParticipantLeft?.Invoke(p.Identity);
        }

        private void UnregisterEvents()
        {
            if (_room == null) return;
            _room.Connected         -= HandleConnected;
            _room.Disconnected      -= HandleDisconnected;
            _room.TrackSubscribed   -= HandleTrackSubscribed;
            _room.TrackUnsubscribed -= HandleTrackUnsubscribed;
            _room.DataReceived      -= HandleDataReceived;
        }

        private void HandleConnected()
        {
            SetState(TransportState.Connected);
            StartPingLoop();
        }

        private void HandleDisconnected(DisconnectReason reason)
        {
            StopPing();
            var next = reason == DisconnectReason.ClientInitiated
                ? TransportState.Disconnected
                : TransportState.Reconnecting;
            SetState(next);
        }

        // ─────────────────────────────────────────────────────────
        // トラック受信
        // ─────────────────────────────────────────────────────────

        private void HandleTrackSubscribed(Track track, TrackPublication pub, RemoteParticipant participant)
        {
            if (track is RemoteVideoTrack video)
                AttachVideoTrack(video);
        }

        private void HandleTrackUnsubscribed(Track track, TrackPublication pub, RemoteParticipant participant)
        {
            if (track is RemoteVideoTrack)
                CleanupTexture();
        }

        private void AttachVideoTrack(RemoteVideoTrack video)
        {
            // RenderTexture は固定サイズで確保し、
            // 実際の解像度が合わない場合は Blit でスケーリング
            EnsureRenderTexture(1280, 720);

            video.VideoReceived += texture =>
            {
                // WebRTC スレッドから呼ばれるため Graphics.Blit は使えない
                // → Texture への参照を保持してメインスレッドで Blit する
                AREditorMainThread.Enqueue(() =>
                {
                    if (_cameraRT != null)
                        Graphics.Blit(texture, _cameraRT);
                });
            };
        }

        private void EnsureRenderTexture(int w, int h)
        {
            if (_cameraRT != null && _cameraRT.width == w && _cameraRT.height == h)
                return;
            CleanupTexture();
            _cameraRT = new RenderTexture(w, h, 0, RenderTextureFormat.BGRA32);
            _cameraRT.Create();
        }

        private void CleanupTexture()
        {
            if (_cameraRT == null) return;
            _cameraRT.Release();
            UnityEngine.Object.Destroy(_cameraRT);
            _cameraRT = null;
        }

        // ─────────────────────────────────────────────────────────
        // Data Channel 受信 → Protobuf デシリアライズ → キュー
        // ─────────────────────────────────────────────────────────

        private void HandleDataReceived(byte[] data, RemoteParticipant participant, DataPacketKind kind)
        {
            if (data == null || data.Length == 0) return;

            try
            {
                var envelope = Envelope.Parser.ParseFrom(data);

                // Pong は RTT 計算に使う (キューには積まない)
                if (envelope.PayloadCase == Envelope.PayloadOneofCase.Pong)
                {
                    UpdateRtt(envelope.Pong);
                    return;
                }

                // キューが溢れていたら最古を破棄して空きを作る
                if (_queue.Count >= QueueCapacity)
                    _queue.TryDequeue(out _);

                var receivedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                _queue.Enqueue(new ReceivedEnvelope(envelope, receivedAtMs, participant.Identity));
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ARTransport] Protobuf parse error: {ex.Message}");
            }
        }

        // ─────────────────────────────────────────────────────────
        // Ping / RTT
        // ─────────────────────────────────────────────────────────

        private async void StartPingLoop()
        {
            _pingCts = new CancellationTokenSource();
            var ct = _pingCts.Token;

            try
            {
                while (!ct.IsCancellationRequested)
                {
                    await Task.Delay(PingIntervalMs, ct);
                    SendPing();
                }
            }
            catch (OperationCanceledException) { }
        }

        private void StopPing()
        {
            _pingCts?.Cancel();
            _pingCts = null;
        }

        private void SendPing()
        {
            if (_room == null || State != TransportState.Connected) return;
            _lastPingSentMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var env = new Envelope { Ping = new Ping { TimestampMs = _lastPingSentMs } };
            var bytes = env.ToByteArray();
            _room.LocalParticipant?.PublishData(bytes, DataPacketKind.Reliable);
        }

        private void UpdateRtt(Pong pong)
        {
            var now   = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var rtt   = (float)(now - pong.PingTimestampMs);
            // 指数移動平均
            RttMs = RttMs < 0 ? rtt : RttMs * (1 - RttSmoothAlpha) + rtt * RttSmoothAlpha;
        }

        // ─────────────────────────────────────────────────────────
        // ユーティリティ
        // ─────────────────────────────────────────────────────────

        private void SetState(TransportState next)
        {
            if (State == next) return;
            State = next;
            AREditorMainThread.Enqueue(() => OnStateChanged?.Invoke(next));
        }

        public void Dispose()
        {
            _ = DisconnectAsync();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // LiveKitTransportFactory
    // ─────────────────────────────────────────────────────────────

    public sealed class LiveKitTransportFactory : IARTransportFactory
    {
        public IARTransport Create() => new LiveKitTransport();
    }
}

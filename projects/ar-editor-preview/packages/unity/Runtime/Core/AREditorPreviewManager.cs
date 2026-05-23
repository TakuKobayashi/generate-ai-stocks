// packages/unity/Runtime/Core/AREditorPreviewManager.cs
// トランスポート層と XR サブシステムを繋ぐ調整クラス。
// XRLoader から生成され、各サブシステムがポーリングで参照する。

using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using AREditorPreview.Proto;
using AREditorPreview.Transport;

#if UNITY_EDITOR
using UnityEditor;
#endif

namespace AREditorPreview.Core
{
    /// <summary>
    /// AR Editor Preview のランタイム中枢。
    /// - IARTransport を保持・管理
    /// - 毎フレーム Dequeue して各サブシステム向けに最新データを保持
    /// - Editor Play 開始/終了を検知して自動接続/切断
    /// </summary>
    public sealed class AREditorPreviewManager : IDisposable
    {
        // ─── シングルトン ──────────────────────────────────────
        public static AREditorPreviewManager Instance { get; private set; }

        // ─── 公開状態 ──────────────────────────────────────────
        public TransportState     TransportState   => _transport?.State ?? Transport.TransportState.Disconnected;
        public bool               IsConnected      => TransportState == Transport.TransportState.Connected;
        public float              RttMs            => _transport?.RttMs ?? -1f;
        public string             ConnectedDevice  { get; private set; } = "";
        public Platform           ConnectedPlatform { get; private set; } = Platform.PlatformUnknown;
        public SessionStatus      SessionStatus    { get; private set; } = SessionStatus.SessionStatusInitializing;

        // ─── サブシステム向けの最新データ ──────────────────────
        // （サブシステムは Update ループで interlocked に読む）
        internal volatile ARFrame         LatestFrame;
        internal volatile ARPlaneUpdate   LatestPlanes;
        internal volatile SessionState    LatestSession;
        internal Texture                  LatestCameraTexture => _transport?.GetLatestCameraTexture();

        // ─── イベント ──────────────────────────────────────────
        public event Action<TransportState> OnTransportStateChanged;
        public event Action<ARPlaneUpdate>  OnPlanesUpdated;

        // ─── 内部 ──────────────────────────────────────────────
        private readonly IARTransport     _transport;
        private readonly ARPreviewSettings _settings;
        private readonly ReceivedEnvelope[] _dequeueBuffer = new ReceivedEnvelope[64];
        private CancellationTokenSource    _connectCts;

        // ─────────────────────────────────────────────────────────
        // コンストラクタ / 初期化
        // ─────────────────────────────────────────────────────────

        public AREditorPreviewManager(IARTransportFactory factory, ARPreviewSettings settings)
        {
            if (Instance != null)
                throw new InvalidOperationException("AREditorPreviewManager is already instantiated.");

            Instance  = this;
            _settings = settings;
            _transport = factory.Create();
            _transport.OnStateChanged      += s => { AREditorMainThread.Enqueue(() => OnTransportStateChanged?.Invoke(s)); };
            _transport.OnParticipantJoined += id => Debug.Log($"[ARPreview] Device joined: {id}");
            _transport.OnParticipantLeft   += id => Debug.Log($"[ARPreview] Device left: {id}");

#if UNITY_EDITOR
            EditorApplication.playModeStateChanged += OnPlayModeChanged;
#endif
        }

        // ─────────────────────────────────────────────────────────
        // 接続
        // ─────────────────────────────────────────────────────────

        public void Connect()
        {
            _connectCts?.Cancel();
            _connectCts = new CancellationTokenSource();
            _ = ConnectAsync(_connectCts.Token);
        }

        private async Task ConnectAsync(CancellationToken ct)
        {
            try
            {
                var token = LiveKitTokenHelper.GenerateEditorToken(_settings);
                var p = new TransportConnectParams
                {
                    ServerUrl = _settings.ServerUrl,
                    RoomName  = _settings.RoomName,
                    Identity  = "unity-editor",
                    Token     = token,
                };
                await _transport.ConnectAsync(p, ct);
                Debug.Log($"[ARPreview] ✅ Connected → {_settings.ServerUrl} room={_settings.RoomName}");
            }
            catch (OperationCanceledException) { }
            catch (Exception ex)
            {
                Debug.LogError($"[ARPreview] Connection failed: {ex.Message}");

                if (_settings.AutoReconnect)
                {
                    await Task.Delay((int)(_settings.ReconnectIntervalSec * 1000), ct);
                    if (!ct.IsCancellationRequested)
                        _ = ConnectAsync(ct);
                }
            }
        }

        public async void Disconnect()
        {
            _connectCts?.Cancel();
            if (_transport != null)
                await _transport.DisconnectAsync();
        }

        // ─────────────────────────────────────────────────────────
        // Update (XRLoader から毎フレーム呼ばれる)
        // ─────────────────────────────────────────────────────────

        public void Update()
        {
            AREditorMainThread.Flush();  // MainThread キューを処理

            var count = _transport.DequeueEnvelopes(_dequeueBuffer);
            for (int i = 0; i < count; i++)
                ProcessEnvelope(_dequeueBuffer[i].Payload);
        }

        private void ProcessEnvelope(Envelope env)
        {
            switch (env.PayloadCase)
            {
                case Envelope.PayloadOneofCase.Frame:
                    LatestFrame = env.Frame;
                    break;

                case Envelope.PayloadOneofCase.Planes:
                    LatestPlanes = env.Planes;
                    OnPlanesUpdated?.Invoke(env.Planes);
                    break;

                case Envelope.PayloadOneofCase.Session:
                    LatestSession     = env.Session;
                    ConnectedDevice   = env.Session.DeviceModel;
                    ConnectedPlatform = env.Session.Platform;
                    SessionStatus     = env.Session.Status;
                    break;

                case Envelope.PayloadOneofCase.Ping:
                    // Editor は Ping を受けたら Pong を返さない (デバイス→Editor 方向のみ)
                    break;
            }
        }

        // ─────────────────────────────────────────────────────────
        // Editor ライフサイクル
        // ─────────────────────────────────────────────────────────

#if UNITY_EDITOR
        private void OnPlayModeChanged(PlayModeStateChange state)
        {
            if (state == PlayModeStateChange.EnteredPlayMode && _settings.AutoConnect)
                Connect();
            else if (state == PlayModeStateChange.ExitingPlayMode)
                Disconnect();
        }
#endif

        // ─────────────────────────────────────────────────────────
        // IDisposable
        // ─────────────────────────────────────────────────────────

        public void Dispose()
        {
            Disconnect();
            _transport?.Dispose();
            Instance = null;
#if UNITY_EDITOR
            EditorApplication.playModeStateChanged -= OnPlayModeChanged;
#endif
        }
    }

    // ─────────────────────────────────────────────────────────────
    // メインスレッドキュー (static、スレッドセーフ)
    // ─────────────────────────────────────────────────────────────

    public static class AREditorMainThread
    {
        private static readonly System.Collections.Concurrent.ConcurrentQueue<Action>
            _queue = new();

        public static void Enqueue(Action a) => _queue.Enqueue(a);

        /// <summary>メインスレッドから呼ぶこと</summary>
        public static void Flush()
        {
            while (_queue.TryDequeue(out var a))
            {
                try { a(); }
                catch (Exception ex) { Debug.LogException(ex); }
            }
        }
    }
}

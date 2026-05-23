// packages/unity/Runtime/Transport/IARTransport.cs
// トランスポート層の抽象インターフェース。
// LiveKit の他に将来 USB / ADB / Wi-Fi Direct 等へ差し替え可能にする。

using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using AREditorPreview.Proto;

namespace AREditorPreview.Transport
{
    // ─────────────────────────────────────────────────────────────
    // 接続状態
    // ─────────────────────────────────────────────────────────────

    public enum TransportState
    {
        Disconnected,
        Connecting,
        Connected,
        Reconnecting,
        Failed,
    }

    // ─────────────────────────────────────────────────────────────
    // 受信データのコンテナ (アロケーション削減のため struct)
    // ─────────────────────────────────────────────────────────────

    public readonly struct ReceivedEnvelope
    {
        public readonly Envelope  Payload;
        public readonly long      ReceivedAtMs;   // 受信時刻 (RTT 計算用)
        public readonly string    ParticipantId;

        public ReceivedEnvelope(Envelope payload, long receivedAtMs, string participantId)
        {
            Payload       = payload;
            ReceivedAtMs  = receivedAtMs;
            ParticipantId = participantId;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 接続パラメータ
    // ─────────────────────────────────────────────────────────────

    public class TransportConnectParams
    {
        public string ServerUrl  { get; init; }
        public string RoomName   { get; init; }
        public string Identity   { get; init; }
        public string Token      { get; init; }   // JWT (LiveKit)
    }

    // ─────────────────────────────────────────────────────────────
    // IARTransport — メイン抽象
    // ─────────────────────────────────────────────────────────────

    public interface IARTransport : IDisposable
    {
        // ── 状態 ──────────────────────────────────────────────
        TransportState State { get; }

        /// <summary>RTT ミリ秒 (直近の Ping/Pong ペアから計算)</summary>
        float RttMs { get; }

        // ── 接続ライフサイクル ────────────────────────────────
        Task ConnectAsync(TransportConnectParams @params, CancellationToken ct = default);
        Task DisconnectAsync();

        // ── データ受信 (キューベース、メインスレッドから Dequeue) ──
        /// <summary>
        /// 受信済み Envelope を最大 <paramref name="maxCount"/> 件取り出す。
        /// メインスレッドから Update() ループで呼ぶことを想定。
        /// </summary>
        int DequeueEnvelopes(Span<ReceivedEnvelope> buffer);

        // ── 映像受信 ──────────────────────────────────────────
        /// <summary>
        /// 最新のカメラフレームテクスチャを返す。
        /// フレームがなければ null。テクスチャの所有権はトランスポートが持つ。
        /// </summary>
        Texture GetLatestCameraTexture();

        // ── イベント ──────────────────────────────────────────
        event Action<TransportState>   OnStateChanged;
        event Action<string>           OnParticipantJoined;   // participantId
        event Action<string>           OnParticipantLeft;
    }

    // ─────────────────────────────────────────────────────────────
    // IARTransportFactory — DI / テスト差し替え用
    // ─────────────────────────────────────────────────────────────

    public interface IARTransportFactory
    {
        IARTransport Create();
    }
}

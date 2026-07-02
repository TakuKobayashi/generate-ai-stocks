// =============================================================
//  SignalingClient.cs  (Unity 6)
//  PartyKit WebSocket シグナリングクライアント
//  ICE / SDP の交換のみ担当。位置データは一切通さない。
//  Websocket.Client (NuGet) を使用
// =============================================================

using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using Websocket.Client;

namespace PlateauSniper.Network
{
    // ─── シグナリングメッセージ型 ─────────────────────────────

    public class SigPeerInfo
    {
        [JsonProperty("clientId")]    public string ClientId    { get; set; } = "";
        [JsonProperty("role")]        public string Role        { get; set; } = "";
        [JsonProperty("displayName")] public string DisplayName { get; set; } = "";
        [JsonProperty("connectedAt")] public long   ConnectedAt { get; set; }
    }

    // クライアント→サーバー
    public class SigJoin
    {
        [JsonProperty("type")]        public string Type        => "join";
        [JsonProperty("roomId")]      public string RoomId      { get; set; } = "";
        [JsonProperty("role")]        public string Role        { get; set; } = "";
        [JsonProperty("displayName")] public string DisplayName { get; set; } = "";
    }
    public class SigOffer
    {
        [JsonProperty("type")] public string Type => "offer";
        [JsonProperty("to")]   public string To   { get; set; } = "";
        [JsonProperty("sdp")]  public string Sdp  { get; set; } = "";
    }
    public class SigAnswer
    {
        [JsonProperty("type")] public string Type => "answer";
        [JsonProperty("to")]   public string To   { get; set; } = "";
        [JsonProperty("sdp")]  public string Sdp  { get; set; } = "";
    }
    public class SigIce
    {
        [JsonProperty("type")]      public string Type      => "ice";
        [JsonProperty("to")]        public string To        { get; set; } = "";
        [JsonProperty("candidate")] public object Candidate { get; set; } = new();
    }
    public class SigPing
    {
        [JsonProperty("type")] public string Type => "ping";
        [JsonProperty("ts")]   public long   Ts   { get; set; }
    }

    // ─── イベントデータ ───────────────────────────────────────

    public class SigWelcomeEvent
    {
        public string        ClientId { get; set; } = "";
        public string        RoomId   { get; set; } = "";
        public SigPeerInfo[] Peers    { get; set; } = Array.Empty<SigPeerInfo>();
    }
    public class SigOfferEvent  { public string From { get; set; } = ""; public string Sdp { get; set; } = ""; }
    public class SigAnswerEvent { public string From { get; set; } = ""; public string Sdp { get; set; } = ""; }
    public class SigIceEvent    { public string From { get; set; } = ""; public string CandidateJson { get; set; } = ""; }
    public class SigGamePhaseEvent
    {
        public string  Phase        { get; set; } = "";
        public float?  RemainingSec { get; set; }
        public string? Winner       { get; set; }
    }

    // ─── メインクラス ─────────────────────────────────────────

    public class SignalingClient : IDisposable
    {
        public string ClientId { get; private set; } = "";
        public bool   IsConnected => _ws?.IsRunning ?? false;

        // イベント (WSスレッドから発火 → UnityMainThread.Enqueue で安全に処理)
        public event Action<SigWelcomeEvent>?   OnWelcome;
        public event Action<SigPeerInfo>?        OnPeerJoined;
        public event Action<string, string>?     OnPeerLeft;      // (clientId, role)
        public event Action<SigOfferEvent>?      OnOffer;
        public event Action<SigAnswerEvent>?     OnAnswer;
        public event Action<SigIceEvent>?        OnIce;
        public event Action<SigGamePhaseEvent>?  OnGamePhase;
        public event Action<bool>?               OnConnectionChanged;
        public event Action<string>?             OnError;

        private WebsocketClient? _ws;
        private readonly string  _url;
        private readonly string  _roomId;
        private readonly string  _role;
        private readonly string  _displayName;
        private readonly CancellationTokenSource _cts = new();

        // ─── 送信レート制御 (Ping 用) ─────────────────────────
        private float _pingTimer = 0f;

        public SignalingClient(string url, string roomId, string role, string displayName)
        {
            _url         = url;
            _roomId      = roomId;
            _role        = role;
            _displayName = displayName;
        }

        // ─── 接続 ──────────────────────────────────────────────
        public async Task ConnectAsync()
        {
            _ws = new WebsocketClient(new Uri(_url))
            {
                ReconnectTimeout      = TimeSpan.FromSeconds(5),
                ErrorReconnectTimeout = TimeSpan.FromSeconds(5),
                IsReconnectionEnabled = true,
            };

            _ws.MessageReceived.Subscribe(msg =>
            {
                if (msg.Text != null) HandleMessage(msg.Text);
            });

            _ws.ReconnectionHappened.Subscribe(_ =>
            {
                // 再接続時は join を再送
                SendRaw(new SigJoin { RoomId = _roomId, Role = _role, DisplayName = _displayName });
                UnityMainThread.Enqueue(() => OnConnectionChanged?.Invoke(true));
            });

            _ws.DisconnectionHappened.Subscribe(_ =>
            {
                UnityMainThread.Enqueue(() => OnConnectionChanged?.Invoke(false));
            });

            await _ws.Start();
            Debug.Log($"[Signaling] 接続: {_url}");
        }

        // ─── 送信 API ─────────────────────────────────────────
        public void SendOffer(string to, string sdp)   => SendRaw(new SigOffer  { To = to, Sdp = sdp });
        public void SendAnswer(string to, string sdp)  => SendRaw(new SigAnswer { To = to, Sdp = sdp });
        public void SendIce(string to, string candidateJson)
        {
            var candObj = JsonConvert.DeserializeObject(candidateJson) ?? new object();
            SendRaw(new SigIce { To = to, Candidate = candObj });
        }
        public void SendStartGame() => SendRaw(new { type = "start_game" });
        public void SendResetGame() => SendRaw(new { type = "reset_game" });

        // ─── メッセージ解析 ───────────────────────────────────
        private void HandleMessage(string json)
        {
            try
            {
                var obj = JObject.Parse(json);
                var type = obj["type"]?.Value<string>();
                if (type == null) return;

                switch (type)
                {
                    case "welcome":
                        ClientId = obj["clientId"]?.Value<string>() ?? "";
                        var peers = obj["peers"]?.ToObject<SigPeerInfo[]>() ?? Array.Empty<SigPeerInfo>();
                        UnityMainThread.Enqueue(() => OnWelcome?.Invoke(new SigWelcomeEvent
                        {
                            ClientId = ClientId,
                            RoomId   = obj["roomId"]?.Value<string>() ?? "",
                            Peers    = peers,
                        }));
                        break;

                    case "peer_joined":
                        var peer = obj["peer"]?.ToObject<SigPeerInfo>();
                        if (peer != null)
                            UnityMainThread.Enqueue(() => OnPeerJoined?.Invoke(peer));
                        break;

                    case "peer_left":
                        var leftId   = obj["clientId"]?.Value<string>() ?? "";
                        var leftRole = obj["role"]?.Value<string>() ?? "";
                        UnityMainThread.Enqueue(() => OnPeerLeft?.Invoke(leftId, leftRole));
                        break;

                    case "offer":
                        var offerFrom = obj["from"]?.Value<string>() ?? "";
                        var offerSdp  = obj["sdp"]?.Value<string>()  ?? "";
                        UnityMainThread.Enqueue(() => OnOffer?.Invoke(
                            new SigOfferEvent { From = offerFrom, Sdp = offerSdp }));
                        break;

                    case "answer":
                        var ansFrom = obj["from"]?.Value<string>() ?? "";
                        var ansSdp  = obj["sdp"]?.Value<string>()  ?? "";
                        UnityMainThread.Enqueue(() => OnAnswer?.Invoke(
                            new SigAnswerEvent { From = ansFrom, Sdp = ansSdp }));
                        break;

                    case "ice":
                        var iceFrom      = obj["from"]?.Value<string>() ?? "";
                        var iceCandidObj = obj["candidate"];
                        var iceCandJson  = iceCandidObj?.ToString() ?? "{}";
                        UnityMainThread.Enqueue(() => OnIce?.Invoke(
                            new SigIceEvent { From = iceFrom, CandidateJson = iceCandJson }));
                        break;

                    case "game_phase":
                        var gp = new SigGamePhaseEvent
                        {
                            Phase        = obj["phase"]?.Value<string>()        ?? "",
                            RemainingSec = obj["remainingSec"]?.Value<float?>(),
                            Winner       = obj["winner"]?.Value<string?>(),
                        };
                        UnityMainThread.Enqueue(() => OnGamePhase?.Invoke(gp));
                        break;

                    case "pong":
                        // ラテンシ計測（将来実装）
                        break;

                    case "error":
                        var errMsg = $"{obj["code"]?.Value<string>()}: {obj["message"]?.Value<string>()}";
                        Debug.LogWarning($"[Signaling] Error: {errMsg}");
                        UnityMainThread.Enqueue(() => OnError?.Invoke(errMsg));
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[Signaling] HandleMessage: {e.Message}");
            }
        }

        private void SendRaw<T>(T msg)
        {
            if (_ws == null || !_ws.IsRunning) return;
            _ws.Send(JsonConvert.SerializeObject(msg));
        }

        public void Dispose()
        {
            _cts.Cancel();
            _ws?.Dispose();
        }
    }
}

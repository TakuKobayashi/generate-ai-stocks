// =============================================================
//  RoomClient.cs  (Unity 6)
//  SignalingClient (PartyKit) + WebRtcPeer の統合オーケストレーター
//  複数ピアとの P2P メッシュを管理する
//  MonoBehaviour として GameManager と同じ GameObject にアタッチ
// =============================================================

using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace PlateauSniper.Network
{
    public class RoomClient : MonoBehaviour
    {
        public static RoomClient Instance { get; private set; }

        // ─── Inspector ────────────────────────────────────────
        [Header("サーバー設定")]
        public string serverBaseUrl   = "https://plateau-sniper.your-name.workers.dev";
        public string partykitHost    = "plateau-sniper-signaling.your-name.partykit.dev";
        public bool   useLocalServer  = true;
        public string localApiUrl     = "http://localhost:8787";
        public string localPartykit   = "localhost:1999";

        [Header("送信レート")]
        [Tooltip("位置データ送信レート (fps)")]
        public float sendRateHz = 20f;

        // ─── 状態 ─────────────────────────────────────────────
        public string MyClientId { get; private set; } = "";
        public string RoomId     { get; private set; } = "";
        public string MyRole     { get; private set; } = "";
        public bool   IsSignalingConnected => _signaling?.IsConnected ?? false;

        // 接続済みピア数
        public int PeerCount => _peers.Count;

        // ─── イベント ─────────────────────────────────────────
        public UnityEvent<string>           OnWelcome          = new(); // clientId
        public UnityEvent<SigPeerInfo>      OnPeerJoined       = new();
        public UnityEvent<string, string>   OnPeerLeft         = new(); // (clientId, role)
        public UnityEvent<DcSniperState>    OnSniperState      = new();
        public UnityEvent<DcBodyguardState> OnBodyguardState   = new();
        public UnityEvent<DcSniperFired>    OnSniperFired      = new();
        public UnityEvent<DcCoverOrder>     OnCoverOrder       = new();
        public UnityEvent<DcDispatchOrder>  OnDispatchOrder    = new();
        public UnityEvent<DcGameEvent>      OnGameEvent        = new();
        public UnityEvent<SigGamePhaseEvent>OnGamePhase        = new();
        public UnityEvent<bool>             OnConnectionChanged= new();

        // ─── 内部 ─────────────────────────────────────────────
        private SignalingClient?                     _signaling;
        private readonly Dictionary<string, WebRtcPeer> _peers = new();
        private float _sendTimer = 0f;

        // ──────────────────────────────────────────────────────
        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Unity.WebRTC の更新ループを有効化
            StartCoroutine(WebRTC.Update());
        }

        void Update()
        {
            // WSスレッドからメインスレッドへのコールバックをフラッシュ
            UnityMainThread.Flush();
        }

        void OnDestroy()
        {
            foreach (var peer in _peers.Values) peer.Dispose();
            _signaling?.Dispose();
        }

        // ─── Public API ───────────────────────────────────────

        /// <summary>ルームを新規作成して接続 (スナイパー/ホスト用)</summary>
        public async void CreateRoomAndConnect(string role, string displayName)
        {
            MyRole = role;
            try
            {
                var apiUrl = useLocalServer ? localApiUrl : serverBaseUrl;
                using var http = new System.Net.Http.HttpClient();
                var res  = await http.PostAsync($"{apiUrl}/api/rooms",
                    new System.Net.Http.StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
                res.EnsureSuccessStatusCode();
                var json = await res.Content.ReadAsStringAsync();
                var body = Newtonsoft.Json.JsonConvert.DeserializeAnonymousType(
                    json, new { roomId = "", signalingUrl = "" })!;
                RoomId = body.roomId;
                await ConnectSignaling(body.signalingUrl, role, displayName);
            }
            catch (Exception e)
            {
                Debug.LogError($"[RoomClient] CreateRoom: {e.Message}");
            }
        }

        /// <summary>既存ルームに参加 (ボディガード/参加者用)</summary>
        public async void JoinRoom(string roomId, string role, string displayName)
        {
            MyRole = role;
            RoomId = roomId;
            var host = useLocalServer ? localPartykit : partykitHost;
            var proto = useLocalServer ? "ws" : "wss";
            var url  = $"{proto}://{host}/party/{roomId}";
            await ConnectSignaling(url, role, displayName);
        }

        // ─── 状態送信 (各コントローラーから毎フレーム呼ぶ) ─────

        public void SendSniperState(
            Vector3 pos, Quaternion rot, string mode, float tp)
        {
            _sendTimer += Time.deltaTime;
            if (_sendTimer < 1f / sendRateHz) return;
            _sendTimer = 0f;

            var payload = DcSniperState.From(pos, rot, mode, tp);
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendBodyguardState(Vector3 pos, Quaternion rot, bool sprinting)
        {
            _sendTimer += Time.deltaTime;
            if (_sendTimer < 1f / sendRateHz) return;
            _sendTimer = 0f;

            var payload = DcBodyguardState.From(MyClientId, pos, rot, sprinting);
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendSniperFired(
            Vector3 origin, Vector3 dir, bool hit,
            Vector3? hitPoint = null, string? hitTag = null)
        {
            var payload = new DcSniperFired
            {
                Ox = origin.x, Oy = origin.y, Oz = origin.z,
                Dx = dir.x,    Dy = dir.y,    Dz = dir.z,
                Hit = hit,
                Hx = hitPoint?.x, Hy = hitPoint?.y, Hz = hitPoint?.z,
                Tag = hitTag,
            };
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendCoverOrder(string coverPointName)
        {
            var payload = new DcCoverOrder { BgId = MyClientId, Cp = coverPointName };
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendDispatchOrder(string guardId)
        {
            var payload = new DcDispatchOrder { BgId = MyClientId, Gid = guardId };
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendGameEvent(string ev)
        {
            var payload = new DcGameEvent { Ev = ev };
            Broadcast(DcCodec.Encode(payload));
        }

        public void SendStartGame() => _signaling?.SendStartGame();
        public void SendResetGame() => _signaling?.SendResetGame();

        // ─── シグナリング接続 ─────────────────────────────────
        private async System.Threading.Tasks.Task ConnectSignaling(
            string url, string role, string displayName)
        {
            _signaling = new SignalingClient(url, RoomId, role, displayName);

            _signaling.OnWelcome += (ev) =>
            {
                MyClientId = ev.ClientId;
                OnWelcome.Invoke(ev.ClientId);
                Debug.Log($"[RoomClient] Welcome clientId={ev.ClientId}");

                // 既存ピアへ Offer を送る
                foreach (var peer in ev.Peers)
                    StartCoroutine(CreateOfferToPeer(peer.ClientId));
            };

            _signaling.OnPeerJoined += (peer) =>
            {
                // 後から入ってきた人からのOffer待ち
                EnsurePeer(peer.ClientId);
                OnPeerJoined.Invoke(peer);
            };

            _signaling.OnPeerLeft += (clientId, peerRole) =>
            {
                if (_peers.TryGetValue(clientId, out var p)) { p.Dispose(); _peers.Remove(clientId); }
                OnPeerLeft.Invoke(clientId, peerRole);
            };

            _signaling.OnOffer += (ev) =>
            {
                var peer = EnsurePeer(ev.From);
                StartCoroutine(HandleOfferFromPeer(peer, ev.Sdp));
            };

            _signaling.OnAnswer += (ev) =>
            {
                if (_peers.TryGetValue(ev.From, out var peer))
                    StartCoroutine(peer.HandleAnswerCoroutine(ev.Sdp));
            };

            _signaling.OnIce += (ev) =>
            {
                if (_peers.TryGetValue(ev.From, out var peer))
                    peer.AddIceCandidate(ev.CandidateJson);
            };

            _signaling.OnGamePhase   += (ev) => OnGamePhase.Invoke(ev);
            _signaling.OnConnectionChanged += (c) => OnConnectionChanged.Invoke(c);

            await _signaling.ConnectAsync();
        }

        // ─── WebRTC ピア管理 ──────────────────────────────────

        private WebRtcPeer EnsurePeer(string peerId)
        {
            if (_peers.TryGetValue(peerId, out var existing)) return existing;

            var peer = new WebRtcPeer(peerId);

            // DataChannel メッセージ受信 → デコード → イベント発火
            peer.OnMessage += (bytes, from) => HandleDcMessage(bytes, from);

            // ICE 候補 → シグナリング経由で転送
            peer.OnIceCandidate += (pid, json) => _signaling?.SendIce(pid, json);

            // SDP (offer/answer) → シグナリング経由で転送
            peer.OnLocalDescription += (pid, descJson) =>
            {
                var obj  = Newtonsoft.Json.Linq.JObject.Parse(descJson);
                var type = obj["type"]?.Value<string>();
                var sdp  = obj["sdp"]?.Value<string>() ?? "";
                if (type == "offer")  _signaling?.SendOffer(pid, sdp);
                if (type == "answer") _signaling?.SendAnswer(pid, sdp);
            };

            peer.OnClosed += (pid) =>
            {
                _peers.Remove(pid);
                Debug.Log($"[RoomClient] Peer closed: {pid}");
            };

            _peers[peerId] = peer;
            return peer;
        }

        private IEnumerator CreateOfferToPeer(string peerId)
        {
            var peer = EnsurePeer(peerId);
            yield return peer.CreateOfferCoroutine();
        }

        private IEnumerator HandleOfferFromPeer(WebRtcPeer peer, string sdp)
        {
            yield return peer.HandleOfferCoroutine(sdp);
        }

        // ─── DataChannel メッセージ処理 ───────────────────────
        private void HandleDcMessage(byte[] bytes, string from)
        {
            if (from == MyClientId) return; // 自分自身は無視

            var decoded = DcCodec.Decode(bytes);
            if (decoded == null) return;

            switch (decoded)
            {
                case DcSniperState    s: OnSniperState.Invoke(s);    break;
                case DcBodyguardState b: OnBodyguardState.Invoke(b); break;
                case DcSniperFired    f: OnSniperFired.Invoke(f);    break;
                case DcCoverOrder     c: OnCoverOrder.Invoke(c);     break;
                case DcDispatchOrder  d: OnDispatchOrder.Invoke(d);  break;
                case DcGameEvent      g: OnGameEvent.Invoke(g);      break;
            }
        }

        // ─── ブロードキャスト ─────────────────────────────────
        private void Broadcast(byte[] data)
        {
            foreach (var peer in _peers.Values)
                peer.Send(data);
        }
    }
}

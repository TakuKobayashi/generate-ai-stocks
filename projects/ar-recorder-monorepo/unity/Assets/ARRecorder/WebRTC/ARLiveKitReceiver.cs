// Assets/ARRecorder/WebRTC/ARLiveKitReceiver.cs
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using ARRecorder.Core;

#if LIVEKIT_AVAILABLE
using LiveKit;
#endif

namespace ARRecorder.WebRTC
{
    /// <summary>
    /// LiveKit ルームのビデオトラックを受信して RawImage に表示するコンポーネント（受信側）。
    /// 複数参加者に対応し、1人目は primaryDisplay、2人目以降はプレハブから生成する。
    /// </summary>
    public class ARLiveKitReceiver : MonoBehaviour
    {
        [Header("LiveKit Connection")]
        [SerializeField] private string serverUrl       = "ws://localhost:7880";
        [SerializeField] private string roomName        = "ar-room";
        [SerializeField] private string participantName = "Viewer";
        [SerializeField] private string apiKey          = "devkey";
        [SerializeField] private string apiSecret       = "secret";

        [Header("Display")]
        [SerializeField] private RawImage    primaryDisplay;
        [SerializeField] private Transform   participantListRoot;
        [SerializeField] private GameObject  participantDisplayPrefab;

        private bool isConnected;
        private readonly Dictionary<string, ParticipantView> views = new Dictionary<string, ParticipantView>();

        public bool IsConnected => isConnected;

        public event Action         OnConnected;
        public event Action         OnDisconnected;
        public event Action<string> OnParticipantJoined;
        public event Action<string> OnParticipantLeft;
        public event Action<string> OnError;

#if LIVEKIT_AVAILABLE
        private Room room;
#endif

        // ---- 公開 API ----

        public void SetServerUrl(string url)        => serverUrl       = url;
        public void SetRoomName(string name)        => roomName        = name;
        public void SetParticipantName(string name) => participantName = name;
        public void SetApiCredentials(string k, string s) { apiKey = k; apiSecret = s; }

        public async void Connect()
        {
            if (isConnected) return;

#if UNITY_EDITOR && !LIVEKIT_AVAILABLE
            Debug.Log($"[LKReceiver][EditorStub] Connect → {serverUrl} / room={roomName}");
            await System.Threading.Tasks.Task.Delay(300);
            isConnected = true;
            OnConnected?.Invoke();
            SimulateEditorParticipant();
            return;
#endif

#if LIVEKIT_AVAILABLE
            try
            {
                room = new Room();
                room.ParticipantConnected    += OnRemoteJoined;
                room.ParticipantDisconnected += OnRemoteLeft;
                room.TrackSubscribed         += OnTrackSub;
                room.TrackUnsubscribed       += OnTrackUnsub;
                room.Disconnected            += HandleDisconnect;

                string token = BuildToken();
                await room.Connect(serverUrl, token);
                isConnected = true;
                OnConnected?.Invoke();
                Debug.Log($"[LKReceiver] Connected → room={roomName}");

                // 接続済み参加者のトラックを購読
                foreach (var p in room.RemoteParticipants.Values)
                    foreach (var pub in p.TrackPublications.Values)
                        if (pub is RemoteTrackPublication rp && !rp.IsSubscribed)
                            await rp.SetSubscribed(true);
            }
            catch (Exception e)
            {
                OnError?.Invoke($"LiveKit connect error: {e.Message}");
                Debug.LogError($"[LKReceiver] {e}");
            }
#else
            OnError?.Invoke("LiveKit SDK not found.");
#endif
        }

        public async void Disconnect()
        {
            if (!isConnected) return;
            ClearAllViews();
#if LIVEKIT_AVAILABLE
            try { await room.Disconnect(); room = null; }
            catch (Exception e) { Debug.LogError($"[LKReceiver] Disconnect: {e}"); }
#endif
            isConnected = false;
            OnDisconnected?.Invoke();
        }

        // ---- Room イベント ----

#if LIVEKIT_AVAILABLE
        private void OnRemoteJoined(RemoteParticipant p)
        {
            Debug.Log($"[LKReceiver] Participant joined: {p.Identity}");
            OnParticipantJoined?.Invoke(p.Identity);
        }

        private void OnRemoteLeft(RemoteParticipant p)
        {
            Debug.Log($"[LKReceiver] Participant left: {p.Identity}");
            RemoveView(p.Identity);
            OnParticipantLeft?.Invoke(p.Identity);
        }

        private void OnTrackSub(RemoteTrack track, RemoteTrackPublication pub, RemoteParticipant p)
        {
            if (track is RemoteVideoTrack vt) CreateOrUpdateView(p.Identity, vt);
        }

        private void OnTrackUnsub(RemoteTrack track, RemoteTrackPublication pub, RemoteParticipant p)
        {
            if (track is RemoteVideoTrack) RemoveView(p.Identity);
        }

        private void HandleDisconnect()
        {
            isConnected = false;
            ClearAllViews();
            OnDisconnected?.Invoke();
        }

        private string BuildToken()
        {
            var token = new AccessToken(apiKey, apiSecret);
            token.Identity = participantName;
            token.AddGrant(new VideoGrant
            {
                RoomJoin = true, Room = roomName,
                CanPublish = false, CanSubscribe = true
            });
            return token.ToJwt();
        }
#endif

        // ---- ビュー管理 ----

        private void CreateOrUpdateView(string identity, object videoTrack)
        {
            if (views.TryGetValue(identity, out var existing))
            {
                existing.AttachTrack(videoTrack);
                return;
            }

            RawImage target = null;
            GameObject viewGO = null;

            if (views.Count == 0 && primaryDisplay != null)
            {
                target = primaryDisplay;
            }
            else if (participantDisplayPrefab != null && participantListRoot != null)
            {
                viewGO = Instantiate(participantDisplayPrefab, participantListRoot);
                target = viewGO.GetComponentInChildren<RawImage>();
                var label = viewGO.GetComponentInChildren<Text>();
                if (label != null) label.text = identity;
            }

            if (target == null) return;

            var view = new ParticipantView(identity, target, viewGO);
            view.AttachTrack(videoTrack);
            views[identity] = view;
        }

        private void RemoveView(string identity)
        {
            if (!views.TryGetValue(identity, out var v)) return;
            v.Cleanup();
            views.Remove(identity);
        }

        private void ClearAllViews()
        {
            foreach (var v in views.Values) v.Cleanup();
            views.Clear();
        }

        // ---- エディタースタブ ----
#if UNITY_EDITOR && !LIVEKIT_AVAILABLE
        private async void SimulateEditorParticipant()
        {
            await System.Threading.Tasks.Task.Delay(800);
            OnParticipantJoined?.Invoke("SimulatedPublisher");
            Debug.Log("[LKReceiver][EditorStub] Simulated participant joined");

            // primaryDisplay にグラデーションテクスチャを表示
            if (primaryDisplay != null)
            {
                var tex = new Texture2D(64, 64);
                for (int y = 0; y < 64; y++)
                    for (int x = 0; x < 64; x++)
                        tex.SetPixel(x, y, new Color(x / 63f, y / 63f, 0.5f));
                tex.Apply();
                primaryDisplay.texture = tex;
            }
        }
#endif

        private void OnDestroy()
        {
            if (isConnected) Disconnect();
        }
    }

    // -------------------------------------------------------
    // 1参加者分の表示を管理
    // -------------------------------------------------------
    public class ParticipantView
    {
        public string    Identity  { get; }
        private RawImage rawImage;
        private GameObject go;
        private Texture2D  frameTex;
        private object     currentTrack;

        public ParticipantView(string id, RawImage img, GameObject go)
        {
            Identity = id; rawImage = img; this.go = go;
        }

        public void AttachTrack(object track)
        {
            DetachTrack();
            currentTrack = track;

#if LIVEKIT_AVAILABLE
            if (track is RemoteVideoTrack vt)
                vt.FrameReceived += OnFrame;
#endif
        }

        private void DetachTrack()
        {
#if LIVEKIT_AVAILABLE
            if (currentTrack is RemoteVideoTrack vt)
                vt.FrameReceived -= OnFrame;
#endif
            currentTrack = null;
        }

#if LIVEKIT_AVAILABLE
        private void OnFrame(VideoFrame frame)
        {
            UnityMainThreadDispatcher.Instance().Enqueue(() =>
            {
                if (rawImage == null) return;
                try
                {
                    if (frameTex == null || frameTex.width != (int)frame.Width || frameTex.height != (int)frame.Height)
                    {
                        if (frameTex != null) UnityEngine.Object.Destroy(frameTex);
                        frameTex = new Texture2D((int)frame.Width, (int)frame.Height, TextureFormat.RGBA32, false);
                    }
                    if (frame.Buffer is I420Buffer i420)
                    {
                        frameTex.LoadRawTextureData(i420.ToARGB());
                        frameTex.Apply();
                        rawImage.texture = frameTex;
                    }
                }
                catch (Exception e) { Debug.LogError($"[ParticipantView] Frame error: {e.Message}"); }
            });
        }
#endif

        public void Cleanup()
        {
            DetachTrack();
            if (frameTex != null) { UnityEngine.Object.Destroy(frameTex); frameTex = null; }
            if (go       != null) { UnityEngine.Object.Destroy(go);       go       = null; }
            if (rawImage != null) rawImage.texture = null;
        }
    }
}

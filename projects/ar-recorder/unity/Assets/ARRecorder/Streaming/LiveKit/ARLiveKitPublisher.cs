// Assets/ARRecorder/Streaming/LiveKit/ARLiveKitPublisher.cs
using System;
using System.Collections;
using UnityEngine;
using ARRecorder.Core;

// LiveKit Unity SDK: https://github.com/livekit/client-sdk-unity
// Package Manager → Add from git URL:
//   https://github.com/livekit/client-sdk-unity.git#main
#if LIVEKIT_AVAILABLE
using LiveKit;
#endif

namespace ARRecorder.Streaming
{
    /// <summary>
    /// LiveKit ルームに AR 画面を VideoTrack として送信するコンポーネント（送信側）。
    /// <para>
    /// LiveKit SDK がインポートされていない場合は <c>#define LIVEKIT_AVAILABLE</c> を
    /// 外してコンパイルエラーを回避する。エディターでは接続シミュレーションのみ行う。
    /// </para>
    /// </summary>
    [RequireComponent(typeof(ARCaptureSystem))]
    public class ARLiveKitPublisher : MonoBehaviour
    {
        [Header("LiveKit Connection")]
        [SerializeField] private string serverUrl       = "ws://localhost:7880";
        [SerializeField] private string roomName        = "ar-room";
        [SerializeField] private string participantName = "AR-Publisher";
        [SerializeField] private string apiKey          = "devkey";
        [SerializeField] private string apiSecret       = "secret";

        [Header("Stream Settings")]
        [SerializeField] private int frameRate = 30;

        [Header("Audio")]
        [SerializeField] private bool publishMicrophone = true;

        private ARCaptureSystem captureSystem;
        private bool isConnected;
        private bool isPublishing;

        public bool IsConnected  => isConnected;
        public bool IsPublishing => isPublishing;

        public event Action              OnConnected;
        public event Action              OnDisconnected;
        public event Action<string>      OnParticipantJoined;
        public event Action<string>      OnParticipantLeft;
        public event Action<string>      OnError;

#if LIVEKIT_AVAILABLE
        private Room            room;
        private LocalVideoTrack videoTrack;
        private LocalAudioTrack audioTrack;
        private VideoStream     videoStream;
#endif

        // ----------------------------------------------------------------

        private void Awake() => captureSystem = GetComponent<ARCaptureSystem>();

        // ---- 公開 API ----

        public void SetConnection(string url, string room, string name,
                                  string key = "", string secret = "")
        {
            serverUrl = url; roomName = room; participantName = name;
            if (!string.IsNullOrEmpty(key))    apiKey    = key;
            if (!string.IsNullOrEmpty(secret)) apiSecret = secret;
        }

        public async void ConnectAndPublish()
        {
            if (isConnected) { Debug.LogWarning("[LKPublisher] Already connected"); return; }

#if UNITY_EDITOR && !LIVEKIT_AVAILABLE
            // エディター上で SDK なしでも UI の動作確認ができるようスタブ処理
            Debug.Log($"[LKPublisher][EditorStub] Connect → {serverUrl} / room={roomName}");
            await System.Threading.Tasks.Task.Delay(500); // 擬似遅延
            isConnected  = true;
            isPublishing = true;
            OnConnected?.Invoke();
            StartCoroutine(EditorFrameLoopStub());
            return;
#endif

#if LIVEKIT_AVAILABLE
            try
            {
                room = new Room();
                room.ParticipantConnected    += p => OnParticipantJoined?.Invoke(p.Identity);
                room.ParticipantDisconnected += p => OnParticipantLeft?.Invoke(p.Identity);
                room.Disconnected            += HandleRoomDisconnected;

                string token = BuildToken(canPublish: true);
                await room.Connect(serverUrl, token);

                isConnected = true;
                OnConnected?.Invoke();
                Debug.Log($"[LKPublisher] Connected → room={roomName}");

                // ビデオトラック公開
                videoStream = new VideoStream(captureSystem.CaptureWidth, captureSystem.CaptureHeight, frameRate);
                videoTrack  = LocalVideoTrack.CreateVideoTrack("ar-screen", videoStream);
                await room.LocalParticipant.PublishTrack(videoTrack);

                // マイクトラック公開
                if (publishMicrophone)
                {
                    audioTrack = await LocalAudioTrack.CreateAudioTrack("microphone");
                    await room.LocalParticipant.PublishTrack(audioTrack);
                }

                isPublishing = true;
                StartCoroutine(SendFramesRoutine());
                Debug.Log("[LKPublisher] Publishing started");
            }
            catch (Exception e)
            {
                OnError?.Invoke($"LiveKit connect error: {e.Message}");
                Debug.LogError($"[LKPublisher] {e}");
            }
#else
            OnError?.Invoke("LiveKit SDK not found. Import via Package Manager.");
#endif
        }

        public async void Disconnect()
        {
            if (!isConnected) return;

            StopAllCoroutines();
            isPublishing = false;

#if LIVEKIT_AVAILABLE
            try
            {
                if (videoTrack != null)
                {
                    await room.LocalParticipant.UnpublishTrack(videoTrack);
                    videoTrack.Dispose(); videoTrack = null;
                }
                if (audioTrack != null)
                {
                    await room.LocalParticipant.UnpublishTrack(audioTrack);
                    audioTrack.Dispose(); audioTrack = null;
                }
                videoStream?.Dispose(); videoStream = null;
                await room.Disconnect(); room = null;
            }
            catch (Exception e) { Debug.LogError($"[LKPublisher] Disconnect error: {e}"); }
#endif

            isConnected = false;
            OnDisconnected?.Invoke();
            Debug.Log("[LKPublisher] Disconnected");
        }

        public void SetMicrophoneMuted(bool muted)
        {
#if LIVEKIT_AVAILABLE
            if (audioTrack != null) audioTrack.Muted = muted;
#endif
            Debug.Log($"[LKPublisher] Mic {(muted ? "muted" : "unmuted")}");
        }

        public void SetVideoPaused(bool paused)
        {
#if LIVEKIT_AVAILABLE
            if (videoTrack != null) videoTrack.Muted = paused;
#endif
            Debug.Log($"[LKPublisher] Video {(paused ? "paused" : "resumed")}");
        }

        // ---- フレーム送信ループ ----

        private IEnumerator SendFramesRoutine()
        {
            float interval = 1f / frameRate;
            while (isPublishing)
            {
                captureSystem.CaptureFrame();
#if LIVEKIT_AVAILABLE
                PushFrame(captureSystem.GetRenderTexture());
#endif
                yield return new WaitForSeconds(interval);
            }
        }

#if LIVEKIT_AVAILABLE
        private void PushFrame(RenderTexture rt)
        {
            if (videoStream == null) return;
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            videoStream.PushFrame(tex.GetRawTextureData(),
                (uint)rt.width, (uint)rt.height, VideoBufferType.RGBA);
            Destroy(tex);
        }

        private void HandleRoomDisconnected()
        {
            isConnected = isPublishing = false;
            OnDisconnected?.Invoke();
        }

        private string BuildToken(bool canPublish)
        {
            var token = new AccessToken(apiKey, apiSecret);
            token.Identity = participantName;
            token.AddGrant(new VideoGrant
            {
                RoomJoin     = true,
                Room         = roomName,
                CanPublish   = canPublish,
                CanSubscribe = true
            });
            return token.ToJwt();
        }
#endif

        // ---- エディタースタブ ----
#if UNITY_EDITOR && !LIVEKIT_AVAILABLE
        private IEnumerator EditorFrameLoopStub()
        {
            float interval = 1f / frameRate;
            int count = 0;
            while (isPublishing)
            {
                captureSystem.CaptureFrame();
                if (++count % 30 == 0)
                    Debug.Log($"[LKPublisher][EditorStub] Streaming frame #{count}");
                yield return new WaitForSeconds(interval);
            }
        }
#endif

        private void OnDestroy()
        {
            if (isConnected) Disconnect();
        }
    }
}

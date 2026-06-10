// Assets/ARRecorder/Streaming/YouTube/ARYouTubeStreamer.cs
using System;
using System.Collections;
using UnityEngine;
using ARRecorder.Core;

namespace ARRecorder.Streaming
{
    /// <summary>
    /// YouTube Live へ RTMP でライブ配信するコンポーネント。
    /// <para>
    /// 実機では FFmpeg（ネイティブライブラリ）を呼び出して H.264+AAC を
    /// RTMP でプッシュする。エディターでは配信パラメーターの確認と
    /// フレームキャプチャのシミュレーションのみ行う。
    /// </para>
    /// </summary>
    [RequireComponent(typeof(ARCaptureSystem))]
    public class ARYouTubeStreamer : MonoBehaviour
    {
        [Header("YouTube RTMP")]
        [SerializeField] private string rtmpBaseUrl = "rtmp://a.rtmp.youtube.com/live2/";
        [SerializeField] private string streamKey   = "";

        [Header("Encode Settings")]
        [SerializeField] private int videoWidth    = 1920;
        [SerializeField] private int videoHeight   = 1080;
        [SerializeField] private int frameRate     = 30;
        [SerializeField] private int videoBitrate  = 4_500_000;  // 4.5 Mbps
        [SerializeField] private int audioBitrate  = 128_000;    // 128 kbps

        private ARCaptureSystem captureSystem;
        private StreamingState  state = StreamingState.Idle;

        public StreamingState State => state;
        public bool IsStreaming      => state == StreamingState.Streaming;
        public string FullRtmpUrl    => rtmpBaseUrl + streamKey;

        public event Action              OnStreamStarted;
        public event Action              OnStreamStopped;
        public event Action<StreamingState> OnStateChanged;
        public event Action<string>      OnError;

        // ----------------------------------------------------------------

        private void Awake() => captureSystem = GetComponent<ARCaptureSystem>();

        // ---- 公開 API ----

        public void SetStreamKey(string key) => streamKey = key;

        public void StartStreaming()
        {
            if (string.IsNullOrWhiteSpace(streamKey))
            { OnError?.Invoke("Stream key is empty"); return; }

            if (IsStreaming)
            { Debug.LogWarning("[YouTubeStreamer] Already streaming"); return; }

            SetState(StreamingState.Initializing);

#if UNITY_EDITOR
            Debug.Log($"[YouTubeStreamer][Editor] Would stream to: {FullRtmpUrl}");
            Debug.Log($"  Resolution: {videoWidth}x{videoHeight} @ {frameRate}fps  Video:{videoBitrate/1000}kbps  Audio:{audioBitrate/1000}kbps");
#else
            InitRTMP();
#endif
            SetState(StreamingState.Streaming);
            StartCoroutine(StreamFramesRoutine());
            OnStreamStarted?.Invoke();
            Debug.Log($"[YouTubeStreamer] Streaming started → {FullRtmpUrl}");
        }

        public void StopStreaming()
        {
            if (!IsStreaming) return;

            StopAllCoroutines();
#if !UNITY_EDITOR
            CleanupRTMP();
#endif
            SetState(StreamingState.Idle);
            OnStreamStopped?.Invoke();
            Debug.Log("[YouTubeStreamer] Streaming stopped");
        }

        // ---- フレームループ ----

        private IEnumerator StreamFramesRoutine()
        {
            float interval = 1f / frameRate;
            while (IsStreaming)
            {
                captureSystem.CaptureFrame();
#if !UNITY_EDITOR
                PushFrameToRTMP(captureSystem.GetRenderTexture());
#endif
                yield return new WaitForSeconds(interval);
            }
        }

        // ---- RTMP スタブ（実機用は FFmpeg ラッパーに差し替え） ----

        private void InitRTMP()    => Debug.Log("[YouTubeStreamer] InitRTMP (native)");
        private void CleanupRTMP() => Debug.Log("[YouTubeStreamer] CleanupRTMP (native)");
        private void PushFrameToRTMP(RenderTexture _)
            => Debug.Log("[YouTubeStreamer] PushFrame (native)");

        // ----------------------------------------------------------------

        private void SetState(StreamingState s)
        {
            state = s;
            OnStateChanged?.Invoke(s);
        }

        private void OnDestroy()
        {
            if (IsStreaming) StopStreaming();
        }
    }
}

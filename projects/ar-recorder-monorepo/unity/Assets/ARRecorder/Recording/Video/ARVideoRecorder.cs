// Assets/ARRecorder/Recording/Video/ARVideoRecorder.cs
using System;
using System.Collections;
using System.IO;
using UnityEngine;
using ARRecorder.Core;

namespace ARRecorder.Recording
{
    /// <summary>
    /// AR 画面を MP4 動画として録画するコンポーネント。
    /// <para>
    /// 実機では Android MediaRecorder / iOS AVAssetWriter へのネイティブブリッジを
    /// 呼び出す。エディター再生時は JPEG フレームシーケンスとして保存する
    /// （動画エンコーダが不要なため Play ボタンで動作確認が可能）。
    /// </para>
    /// </summary>
    [RequireComponent(typeof(ARCaptureSystem))]
    public class ARVideoRecorder : MonoBehaviour
    {
        [Header("Save Settings")]
        [SerializeField] private string saveSubDirectory = "ARVideos";
        [SerializeField] private string filePrefix       = "AR_";

        [Header("Encode Settings")]
        [SerializeField] private int frameRate   = 30;
        [SerializeField] private int videoBitrate = 5_000_000;

        [Header("Audio")]
        [SerializeField] private AudioCaptureMode audioMode = AudioCaptureMode.Microphone;

        private ARCaptureSystem captureSystem;
        private bool  isRecording;
        private string currentOutputPath;

        // エディター用フレームシーケンス
        private string editorFrameDir;
        private int    editorFrameIndex;

        public bool  IsRecording     => isRecording;
        public string OutputPath     => currentOutputPath;
        public AudioCaptureMode AudioMode
        {
            get => audioMode;
            set => audioMode = value;
        }

        public event Action<string> OnRecordingStarted;
        public event Action<string> OnRecordingStopped;
        public event Action<string> OnError;

        // ----------------------------------------------------------------

        private void Awake() => captureSystem = GetComponent<ARCaptureSystem>();

        // ---- 公開 API ----

        public void StartRecording()
        {
            if (isRecording) { Debug.LogWarning("[ARVideoRecorder] Already recording"); return; }

            try
            {
                string dir = GetSaveDirectory();
                Directory.CreateDirectory(dir);

                string ts   = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                currentOutputPath = Path.Combine(dir, $"{filePrefix}{ts}.mp4");

#if UNITY_EDITOR
                StartEditorRecording(dir, ts);
#elif UNITY_ANDROID
                StartNativeRecording_Android();
#elif UNITY_IOS
                StartNativeRecording_iOS();
#endif
                isRecording = true;
                StartCoroutine(RecordFramesRoutine());
                OnRecordingStarted?.Invoke(currentOutputPath);
                Debug.Log($"[ARVideoRecorder] Recording started → {currentOutputPath}");
            }
            catch (Exception e)
            {
                OnError?.Invoke(e.Message);
                Debug.LogError($"[ARVideoRecorder] StartRecording error: {e}");
            }
        }

        public void StopRecording()
        {
            if (!isRecording) { Debug.LogWarning("[ARVideoRecorder] Not recording"); return; }

            StopAllCoroutines();

#if UNITY_EDITOR
            StopEditorRecording();
#elif UNITY_ANDROID
            StopNativeRecording_Android();
#elif UNITY_IOS
            StopNativeRecording_iOS();
#endif
            isRecording = false;
            OnRecordingStopped?.Invoke(currentOutputPath);
            Debug.Log($"[ARVideoRecorder] Recording stopped → {currentOutputPath}");
        }

        // ---- フレームキャプチャループ ----

        private IEnumerator RecordFramesRoutine()
        {
            float interval = 1f / frameRate;
            while (isRecording)
            {
                captureSystem.CaptureFrame();
                var rt = captureSystem.GetRenderTexture();

#if UNITY_EDITOR
                SaveEditorFrame(rt);
#else
                SendFrameToNativeEncoder(rt);
#endif
                yield return new WaitForSeconds(interval);
            }
        }

        // ================================================================
        // エディター用：JPEG フレームシーケンスとして保存
        // ================================================================

#if UNITY_EDITOR
        private void StartEditorRecording(string dir, string ts)
        {
            editorFrameDir   = Path.Combine(dir, $"{filePrefix}{ts}_frames");
            editorFrameIndex = 0;
            Directory.CreateDirectory(editorFrameDir);
            Debug.Log($"[ARVideoRecorder][Editor] Frame sequence dir → {editorFrameDir}");
        }

        private void StopEditorRecording()
        {
            Debug.Log($"[ARVideoRecorder][Editor] {editorFrameIndex} frames saved to {editorFrameDir}");
            Debug.Log("[ARVideoRecorder][Editor] Use ffmpeg to convert frames to MP4:");
            Debug.Log($"  ffmpeg -r {frameRate} -i \"{editorFrameDir}/frame_%05d.jpg\" -c:v libx264 \"{currentOutputPath}\"");
        }

        private void SaveEditorFrame(RenderTexture rt)
        {
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;

            string path = Path.Combine(editorFrameDir, $"frame_{editorFrameIndex:D5}.jpg");
            File.WriteAllBytes(path, tex.EncodeToJPG(85));
            Destroy(tex);
            editorFrameIndex++;
        }
#endif

        // ================================================================
        // Android ネイティブブリッジ（スタブ）
        // ================================================================

#if UNITY_ANDROID && !UNITY_EDITOR
        private Android.ARVideoRecorderBridge _androidBridge;

        private void StartNativeRecording_Android()
        {
            _androidBridge = new Android.ARVideoRecorderBridge();
            _androidBridge.Start(currentOutputPath,
                captureSystem.CaptureWidth, captureSystem.CaptureHeight,
                frameRate, videoBitrate);
        }

        private void StopNativeRecording_Android() => _androidBridge?.Stop();
        private void SendFrameToNativeEncoder(RenderTexture rt) => _androidBridge?.PushFrame(rt);
#else
        private void StartNativeRecording_Android() { }
        private void StopNativeRecording_Android()  { }
        private void SendFrameToNativeEncoder(RenderTexture _) { }
#endif

        // ================================================================
        // iOS ネイティブブリッジ（スタブ）
        // ================================================================

#if UNITY_IOS && !UNITY_EDITOR
        private iOS.ARVideoRecorderBridge _iosBridge;

        private void StartNativeRecording_iOS()
        {
            _iosBridge = new iOS.ARVideoRecorderBridge();
            _iosBridge.Start(currentOutputPath,
                captureSystem.CaptureWidth, captureSystem.CaptureHeight,
                frameRate, videoBitrate);
        }

        private void StopNativeRecording_iOS() => _iosBridge?.Stop();
#else
        private void StartNativeRecording_iOS() { }
        private void StopNativeRecording_iOS()  { }
#endif

        // ----------------------------------------------------------------
        private string GetSaveDirectory() =>
            Path.Combine(Application.persistentDataPath, saveSubDirectory);
    }
}

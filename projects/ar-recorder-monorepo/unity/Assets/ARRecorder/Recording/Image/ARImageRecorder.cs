// Assets/ARRecorder/Recording/Image/ARImageRecorder.cs
using System;
using System.IO;
using UnityEngine;
using ARRecorder.Core;

namespace ARRecorder.Recording
{
    /// <summary>
    /// AR 画面を PNG / JPEG 画像として保存するコンポーネント。
    /// ARCaptureSystem と同じ GameObject に追加して使用する。
    /// </summary>
    [RequireComponent(typeof(ARCaptureSystem))]
    public class ARImageRecorder : MonoBehaviour
    {
        [Header("Save Settings")]
        [SerializeField] private string saveSubDirectory = "ARScreenshots";
        [SerializeField] private string filePrefix       = "AR_";
        [SerializeField] private ImageFormat format      = ImageFormat.PNG;
        [SerializeField, Range(1, 100)] private int jpegQuality = 90;

        public enum ImageFormat { PNG, JPEG }

        private ARCaptureSystem captureSystem;

        public event Action<string> OnImageSaved;
        public event Action<string> OnError;

        // ----------------------------------------------------------------

        private void Awake()
        {
            captureSystem = GetComponent<ARCaptureSystem>();
            captureSystem.OnScreenshotReady += HandleScreenshotReady;
        }

        private void OnDestroy()
        {
            if (captureSystem != null)
                captureSystem.OnScreenshotReady -= HandleScreenshotReady;
        }

        // ---- 公開 API ----

        /// <summary>スクリーンショットを撮影してファイルに保存する</summary>
        public void CaptureAndSave()
        {
            captureSystem.TakeScreenshot();
        }

        // ---- 内部処理 ----

        private void HandleScreenshotReady(Texture2D tex)
        {
            try
            {
                string dir  = GetSaveDirectory();
                Directory.CreateDirectory(dir);

                string ext  = format == ImageFormat.PNG ? ".png" : ".jpg";
                string name = $"{filePrefix}{DateTime.Now:yyyyMMdd_HHmmss_fff}{ext}";
                string path = Path.Combine(dir, name);

                byte[] bytes = format == ImageFormat.PNG
                    ? tex.EncodeToPNG()
                    : tex.EncodeToJPG(jpegQuality);

                File.WriteAllBytes(path, bytes);
                Debug.Log($"[ARImageRecorder] Saved → {path}");
                OnImageSaved?.Invoke(path);
            }
            catch (Exception e)
            {
                Debug.LogError($"[ARImageRecorder] Save failed: {e.Message}");
                OnError?.Invoke(e.Message);
            }
            finally
            {
                Destroy(tex);
            }
        }

        private string GetSaveDirectory() =>
            Path.Combine(Application.persistentDataPath, saveSubDirectory);
    }
}

// Assets/ARRecorder/Core/ARCaptureSystem.cs
using System;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace ARRecorder.Core
{
    /// <summary>
    /// AR 画面キャプチャの中核コンポーネント。
    /// Recording / Streaming / Mirror の全機能がこのクラスのフレームを共用する。
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public class ARCaptureSystem : MonoBehaviour
    {
        [Header("AR References")]
        [SerializeField] private ARCameraBackground arCameraBackground;
        [SerializeField] private Camera arCamera;

        [Header("Capture Resolution")]
        [SerializeField] private int captureWidth  = 1280;
        [SerializeField] private int captureHeight = 720;

        [Header("Capture Mode")]
        [SerializeField] private ARCaptureMode captureMode = ARCaptureMode.FullARView;

        // ---- 内部リソース ----
        private RenderTexture captureRT;
        private Camera        offscreenCamera;
        private GameObject    offscreenCameraGO;

        // ---- 公開イベント ----
        /// <summary>スクリーンショット撮影完了時に Texture2D を渡す</summary>
        public event Action<Texture2D> OnScreenshotReady;
        /// <summary>毎フレームキャプチャ完了時に RenderTexture を渡す</summary>
        public event Action<RenderTexture> OnFrameCaptured;

        // ---- プロパティ ----
        public ARCaptureMode CaptureMode
        {
            get => captureMode;
            set { captureMode = value; ApplyCaptureMode(); }
        }
        public int CaptureWidth  => captureWidth;
        public int CaptureHeight => captureHeight;

        // ================================================================
        // Unity ライフサイクル
        // ================================================================

        private void Awake()
        {
            if (arCamera == null)
                arCamera = GetComponent<Camera>();

            InitCaptureRT();
            InitOffscreenCamera();
            ApplyCaptureMode();
        }

        private void OnDestroy()
        {
            if (captureRT != null) { captureRT.Release(); Destroy(captureRT); }
            if (offscreenCameraGO != null) Destroy(offscreenCameraGO);
        }

        // ================================================================
        // 初期化
        // ================================================================

        private void InitCaptureRT()
        {
            captureRT = new RenderTexture(captureWidth, captureHeight, 24, RenderTextureFormat.ARGB32);
            captureRT.antiAliasing = 1;
            captureRT.Create();
        }

        private void InitOffscreenCamera()
        {
            offscreenCameraGO = new GameObject("AR_OffscreenCamera");
            offscreenCameraGO.hideFlags = HideFlags.HideAndDontSave;
            offscreenCamera = offscreenCameraGO.AddComponent<Camera>();
            offscreenCamera.CopyFrom(arCamera);
            offscreenCamera.targetTexture = captureRT;
            offscreenCamera.enabled = false; // 手動 Render のみ
        }

        // ================================================================
        // キャプチャモード切り替え
        // ================================================================

        private void ApplyCaptureMode()
        {
            if (offscreenCamera == null) return;

            switch (captureMode)
            {
                case ARCaptureMode.FullARView:
                    offscreenCamera.cullingMask = arCamera.cullingMask;
                    SetARBackground(true);
                    offscreenCamera.clearFlags = CameraClearFlags.SolidColor;
                    break;

                case ARCaptureMode.CameraOnly:
                    offscreenCamera.cullingMask = 0; // AR オブジェクト非表示
                    SetARBackground(true);
                    offscreenCamera.clearFlags = CameraClearFlags.SolidColor;
                    break;

                case ARCaptureMode.ARElementsOnly:
                    offscreenCamera.cullingMask = arCamera.cullingMask;
                    SetARBackground(false);
                    offscreenCamera.clearFlags = CameraClearFlags.SolidColor;
                    offscreenCamera.backgroundColor = new Color(0, 0, 0, 0);
                    break;
            }
        }

        private void SetARBackground(bool active)
        {
            if (arCameraBackground != null)
                arCameraBackground.enabled = active;
        }

        // ================================================================
        // 公開 API
        // ================================================================

        /// <summary>1フレームをオフスクリーンカメラでレンダリングして RenderTexture に書き込む</summary>
        public void CaptureFrame()
        {
            if (offscreenCamera == null) return;
            offscreenCamera.transform.SetPositionAndRotation(
                arCamera.transform.position, arCamera.transform.rotation);
            offscreenCamera.Render();
            OnFrameCaptured?.Invoke(captureRT);
        }

        /// <summary>スクリーンショットを撮影して OnScreenshotReady イベントを発火する</summary>
        public void TakeScreenshot()
        {
            CaptureFrame();
            var tex = RenderTextureToTexture2D(captureRT);
            OnScreenshotReady?.Invoke(tex);
        }

        /// <summary>現在の RenderTexture を取得（ストリーミング用）</summary>
        public RenderTexture GetRenderTexture() => captureRT;

        // ================================================================
        // ユーティリティ
        // ================================================================

        private static Texture2D RenderTextureToTexture2D(RenderTexture rt)
        {
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            return tex;
        }
    }
}

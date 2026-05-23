// packages/unity/Runtime/AREditorPreviewLoader.cs
// XRLoader の実装。XR Management から登録され、
// Editor Play 時に各サブシステムを初期化する。

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.Management;
using AREditorPreview.Core;
using AREditorPreview.Transport;
using AREditorPreview.Subsystems;

namespace AREditorPreview
{
    /// <summary>
    /// XR Management に登録する Loader。
    /// Project Settings > XR Plug-in Management > Editor で有効化する。
    /// </summary>
    public class AREditorPreviewLoader : XRLoaderHelper
    {
        // ─── サブシステム記述子リスト ──────────────────────────
        // サブシステムを追加する際はここに追加するだけで良い
        private static readonly List<XRSessionSubsystemDescriptor>   s_SessionDescs  = new();
        private static readonly List<XRCameraSubsystemDescriptor>    s_CameraDescs   = new();
        private static readonly List<XRPlaneSubsystemDescriptor>     s_PlaneDescs    = new();
        // 将来の拡張例:
        // private static readonly List<XRDepthSubsystemDescriptor>  s_DepthDescs    = new();
        // private static readonly List<XRMeshSubsystemDescriptor>   s_MeshDescs     = new();

        private AREditorPreviewManager _manager;

        // ─────────────────────────────────────────────────────────
        // 初期化
        // ─────────────────────────────────────────────────────────

        public override bool Initialize()
        {
            // 1. 設定ロード
            var settings = ARPreviewSettings.Load();

            // 2. Manager 生成 (Transport を DI で注入)
            IARTransportFactory factory = new LiveKitTransportFactory();
            _manager = new AREditorPreviewManager(factory, settings);

            // 3. サブシステム初期化
            CreateSubsystem<XRSessionSubsystemDescriptor,   XRSessionSubsystem>  (s_SessionDescs, EditorPreviewSessionSubsystem.k_SubsystemId);
            CreateSubsystem<XRCameraSubsystemDescriptor,    XRCameraSubsystem>   (s_CameraDescs,  EditorPreviewCameraSubsystem.k_SubsystemId);
            CreateSubsystem<XRPlaneSubsystemDescriptor,     XRPlaneSubsystem>    (s_PlaneDescs,   EditorPreviewPlaneSubsystem.k_SubsystemId);

            Debug.Log("[ARPreview] Loader initialized.");
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // 開始
        // ─────────────────────────────────────────────────────────

        public override bool Start()
        {
            StartSubsystem<XRSessionSubsystem>();
            StartSubsystem<XRCameraSubsystem>();
            StartSubsystem<XRPlaneSubsystem>();

            _manager?.Connect();
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // 停止
        // ─────────────────────────────────────────────────────────

        public override bool Stop()
        {
            _manager?.Disconnect();
            StopSubsystem<XRPlaneSubsystem>();
            StopSubsystem<XRCameraSubsystem>();
            StopSubsystem<XRSessionSubsystem>();
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // 破棄
        // ─────────────────────────────────────────────────────────

        public override bool Deinitialize()
        {
            DestroySubsystem<XRPlaneSubsystem>();
            DestroySubsystem<XRCameraSubsystem>();
            DestroySubsystem<XRSessionSubsystem>();

            _manager?.Dispose();
            _manager = null;

            Debug.Log("[ARPreview] Loader deinitialized.");
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // Update フック (XRLoader は Update を自動で呼ばないので MonoBehaviour 経由)
        // ─────────────────────────────────────────────────────────

        // XRLoaderHelper 自体には Update がないため、
        // AREditorPreviewUpdater MonoBehaviour が毎フレーム呼ぶ

        internal void Tick() => _manager?.Update();
    }

    // ─────────────────────────────────────────────────────────────
    // フレーム毎 Update を Manager に橋渡しする MonoBehaviour
    // ─────────────────────────────────────────────────────────────

    [DefaultExecutionOrder(-200)]
    internal class AREditorPreviewUpdater : MonoBehaviour
    {
        private AREditorPreviewLoader _loader;

        internal static AREditorPreviewUpdater Create(AREditorPreviewLoader loader)
        {
            var go = new GameObject("[AREditorPreview] Updater") { hideFlags = HideFlags.HideAndDontSave };
            DontDestroyOnLoad(go);
            var comp = go.AddComponent<AREditorPreviewUpdater>();
            comp._loader = loader;
            return comp;
        }

        private void Update() => _loader?.Tick();

        private void OnDestroy() { /* loader が先に破棄されているケースも考慮 */ }
    }
}

// packages/unity/Editor/AREditorPreviewLoaderUI.cs
// XR Management の Editor 向けローダー設定 UI を提供する。
// Project Settings > XR Plug-in Management > Editor タブに表示される。

using System;
using UnityEditor;
using UnityEngine;
using UnityEngine.XR.Management;
using UnityEngine.XR.Management.Editor;

namespace AREditorPreview.Editor
{
    // XRLoaderOrderManager に AR Editor Preview Loader を登録する
    [InitializeOnLoad]
    public static class AREditorPreviewLoaderOrderUI
    {
        static AREditorPreviewLoaderOrderUI()
        {
            XRPackageMetadataStore.AssignLoader(
                XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(BuildTargetGroup.Standalone),
                typeof(AREditorPreviewLoader).FullName,
                BuildTargetGroup.Standalone
            );
        }
    }

    // Build TargetGroup 向けのローダー設定 UI
    [XRCustomLoaderUI("com.arpreview", BuildTargetGroup.Standalone)]
    public class AREditorPreviewLoaderUI : IXRCustomLoaderUI
    {
        private static readonly GUIContent k_Label = new GUIContent(
            "AR Editor Preview",
            "ARCore/ARKit デバイスと LiveKit WebRTC 経由で接続し、Editor 内で AR を実行します。");

        public bool IsActiveLoader { get; set; }
        public BuildTargetGroup ActiveBuildTargetGroup { get; set; }

        public float RequiredRenderHeight => EditorGUIUtility.singleLineHeight * 2 + 8f;

        public void SetRenderedLineHeight(float height) { }

        public void OnGUI(Rect position)
        {
            var labelRect   = new Rect(position.x, position.y, position.width, EditorGUIUtility.singleLineHeight);
            var versionRect = new Rect(position.x, labelRect.yMax + 2, position.width, EditorGUIUtility.singleLineHeight);

            EditorGUI.LabelField(labelRect, k_Label, EditorStyles.boldLabel);
            EditorGUI.LabelField(versionRect,
                new GUIContent("v0.1.0 — ARCore / ARKit → Unity Editor (LiveKit WebRTC)"),
                EditorStyles.miniLabel);
        }
    }
}

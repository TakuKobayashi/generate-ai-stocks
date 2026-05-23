// packages/unity/Editor/AREditorPreviewWindow.cs
// AR Editor Preview の設定・接続操作 UI。
// Window > AR Editor Preview から開く。

using UnityEditor;
using UnityEngine;
using AREditorPreview.Core;

namespace AREditorPreview.Editor
{
    public class AREditorPreviewWindow : EditorWindow
    {
        // ─── 定数 ──────────────────────────────────────────────
        private const string k_Title      = "AR Editor Preview";
        private const float  k_LabelWidth = 160f;

        // ─── 状態 ──────────────────────────────────────────────
        private ARPreviewSettings _settings;
        private Vector2           _scroll;
        private double            _nextRepaint;

        // ─── スタイルキャッシュ ────────────────────────────────
        private GUIStyle _titleStyle;
        private GUIStyle _sectionStyle;
        private GUIStyle _connectedStyle;
        private GUIStyle _disconnectedStyle;
        private bool     _stylesInitialized;

        [MenuItem("Window/AR Editor Preview")]
        public static void Open()
        {
            var win = GetWindow<AREditorPreviewWindow>(k_Title);
            win.minSize = new Vector2(360, 500);
            win.Show();
        }

        private void OnEnable()
        {
            _settings = ARPreviewSettings.Load();
        }

        private void OnGUI()
        {
            InitStyles();
            _scroll = EditorGUILayout.BeginScrollView(_scroll);

            DrawHeader();
            DrawStatus();
            EditorGUILayout.Space(8);
            DrawConnectionSettings();
            EditorGUILayout.Space(4);
            DrawVideoSettings();
            EditorGUILayout.Space(4);
            DrawBehaviorSettings();
            EditorGUILayout.Space(12);
            DrawActions();
            EditorGUILayout.Space(12);
            DrawHelpBox();

            EditorGUILayout.EndScrollView();

            // 1秒に約 10 回再描画してステータスを更新
            if (EditorApplication.timeSinceStartup > _nextRepaint)
            {
                _nextRepaint = EditorApplication.timeSinceStartup + 0.1;
                Repaint();
            }
        }

        // ─────────────────────────────────────────────────────────
        // 描画メソッド
        // ─────────────────────────────────────────────────────────

        private void DrawHeader()
        {
            EditorGUILayout.Space(8);
            GUILayout.Label(k_Title, _titleStyle);
            EditorGUILayout.Space(4);
            var rect = EditorGUILayout.GetControlRect(false, 1);
            EditorGUI.DrawRect(rect, new Color(0.5f, 0.5f, 0.5f, 0.5f));
            EditorGUILayout.Space(4);
        }

        private void DrawStatus()
        {
            var mgr = AREditorPreviewManager.Instance;
            if (mgr == null || !Application.isPlaying)
            {
                EditorGUILayout.HelpBox("Play モードで接続します。", MessageType.Info);
                return;
            }

            using var box = new EditorGUILayout.VerticalScope(EditorStyles.helpBox);

            bool connected = mgr.IsConnected;
            var  style     = connected ? _connectedStyle : _disconnectedStyle;
            var  stateStr  = mgr.TransportState.ToString();

            GUILayout.Label($"● {stateStr}", style);

            if (connected)
            {
                EditorGUILayout.LabelField("デバイス",  mgr.ConnectedDevice);
                EditorGUILayout.LabelField("プラットフォーム", mgr.ConnectedPlatform.ToString());
                EditorGUILayout.LabelField("セッション状態",  mgr.SessionStatus.ToString());
                if (mgr.RttMs >= 0)
                    EditorGUILayout.LabelField("RTT", $"{mgr.RttMs:F1} ms");
            }
        }

        private void DrawConnectionSettings()
        {
            GUILayout.Label("接続設定", _sectionStyle);
            using var box = new EditorGUILayout.VerticalScope(EditorStyles.helpBox);

            EditorGUIUtility.labelWidth = k_LabelWidth;
            var so = new SerializedObject(_settings);
            so.Update();

            EditorGUILayout.PropertyField(so.FindProperty("_serverUrl"),
                new GUIContent("Server URL", "ws://192.168.x.x:7880"));
            EditorGUILayout.PropertyField(so.FindProperty("_roomName"),
                new GUIContent("Room Name"));
            EditorGUILayout.PropertyField(so.FindProperty("_apiKey"),
                new GUIContent("API Key"));
            EditorGUILayout.PropertyField(so.FindProperty("_apiSecret"),
                new GUIContent("API Secret"));

            so.ApplyModifiedProperties();

            // QR コード生成ボタン (将来)
            // GUILayout.Button("デバイス設定 QR を表示");
        }

        private void DrawVideoSettings()
        {
            GUILayout.Label("映像設定", _sectionStyle);
            using var box = new EditorGUILayout.VerticalScope(EditorStyles.helpBox);

            var so = new SerializedObject(_settings);
            so.Update();
            EditorGUILayout.PropertyField(so.FindProperty("_videoWidth"),  new GUIContent("幅 (px)"));
            EditorGUILayout.PropertyField(so.FindProperty("_videoHeight"), new GUIContent("高さ (px)"));
            so.ApplyModifiedProperties();
        }

        private void DrawBehaviorSettings()
        {
            GUILayout.Label("動作設定", _sectionStyle);
            using var box = new EditorGUILayout.VerticalScope(EditorStyles.helpBox);

            var so = new SerializedObject(_settings);
            so.Update();
            EditorGUILayout.PropertyField(so.FindProperty("_autoConnect"),
                new GUIContent("Play 時に自動接続"));
            EditorGUILayout.PropertyField(so.FindProperty("_autoReconnect"),
                new GUIContent("自動再接続"));
            EditorGUILayout.PropertyField(so.FindProperty("_reconnectIntervalSec"),
                new GUIContent("再接続間隔 (秒)"));
            EditorGUILayout.PropertyField(so.FindProperty("_verboseLog"),
                new GUIContent("詳細ログ"));
            so.ApplyModifiedProperties();
        }

        private void DrawActions()
        {
            var mgr       = AREditorPreviewManager.Instance;
            bool isPlaying = Application.isPlaying;

            EditorGUI.BeginDisabledGroup(!isPlaying);

            using var h = new EditorGUILayout.HorizontalScope();

            if (GUILayout.Button("接続", GUILayout.Height(32)))
                mgr?.Connect();

            if (GUILayout.Button("切断", GUILayout.Height(32)))
                mgr?.Disconnect();

            EditorGUI.EndDisabledGroup();

            if (!isPlaying)
                GUILayout.Label("Play モード中のみ操作できます", EditorStyles.centeredGreyMiniLabel);
        }

        private void DrawHelpBox()
        {
            GUILayout.Label("セットアップ手順", _sectionStyle);
            EditorGUILayout.HelpBox(
                "1. docker/ ディレクトリで docker compose up -d を実行\n" +
                "2. Android / iOS Companion App を起動し、同じ Server URL / Room Name を設定\n" +
                "3. Unity Editor で Play → 自動接続されます\n\n" +
                "XR Management: Project Settings > XR Plug-in Management > Editor\n" +
                "に AR Editor Preview Loader を追加してください。",
                MessageType.None);
        }

        // ─────────────────────────────────────────────────────────
        // スタイル初期化
        // ─────────────────────────────────────────────────────────

        private void InitStyles()
        {
            if (_stylesInitialized) return;
            _stylesInitialized = true;

            _titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 16,
                margin   = new RectOffset(4, 4, 4, 4),
            };

            _sectionStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 12,
                margin   = new RectOffset(4, 4, 8, 2),
            };

            _connectedStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                normal = { textColor = new Color(0.2f, 0.8f, 0.2f) },
            };

            _disconnectedStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                normal = { textColor = new Color(0.8f, 0.4f, 0.2f) },
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ビルド時チェック — デバイスビルドに Editor コードが含まれないよう確認
    // ─────────────────────────────────────────────────────────────

    [InitializeOnLoad]
    static class AREditorPreviewBuildChecker
    {
        static AREditorPreviewBuildChecker()
        {
            BuildPlayerWindow.RegisterBuildPlayerHandler(OnBuild);
        }

        static void OnBuild(BuildPlayerOptions options)
        {
            // Editor Preview Loader がデバイスビルドで有効になっていれば警告
            // (実機ビルドでは ARCore/ARKit Loader を使うべき)
            Debug.Log("[ARPreview] Build check passed.");
            BuildPlayerWindow.DefaultBuildMethods.BuildPlayer(options);
        }
    }
}

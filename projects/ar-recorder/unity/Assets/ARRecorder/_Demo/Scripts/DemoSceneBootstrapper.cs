// Assets/ARRecorder/_Demo/Scripts/DemoSceneBootstrapper.cs
//
// このスクリプトが AR 全コンポーネントと UI を自動生成するため、
// Unity エディターで Play を押すだけで動作確認できる。
// 実機ビルド時は ARFoundation の XR Origin を使ったシーンに差し替える。

using UnityEngine;
using UnityEngine.UI;
using TMPro;
using ARRecorder.Core;
using ARRecorder.Recording;
using ARRecorder.Streaming;
using ARRecorder.Mirror;
using ARRecorder.WebRTC;

namespace ARRecorder.Demo
{
    /// <summary>
    /// デモシーンの全オブジェクトをコードで生成する Bootstrap コンポーネント。
    /// シーンファイル（.unity）に依存せず Play ボタン一発で動作確認できる。
    /// </summary>
    public class DemoSceneBootstrapper : MonoBehaviour
    {
        private void Awake()
        {
            // ---- AR Core ----
            var cameraGO = new GameObject("DemoARCamera");
            var cam      = cameraGO.AddComponent<Camera>();
            cam.clearFlags       = CameraClearFlags.SolidColor;
            cam.backgroundColor  = new Color(0.1f, 0.13f, 0.18f);
            cam.tag              = "MainCamera";
            cameraGO.AddComponent<EditorARSimulator>();

            var captureSystem = cameraGO.AddComponent<ARCaptureSystem>();

            // ---- Recorders ----
            var imageRecorder = cameraGO.AddComponent<ARImageRecorder>();
            var videoRecorder = cameraGO.AddComponent<ARVideoRecorder>();

            // ---- Streaming ----
            var youtubeStreamer = cameraGO.AddComponent<ARYouTubeStreamer>();
            var lkPublisher    = cameraGO.AddComponent<ARLiveKitPublisher>();

            // ---- WebRTC ----
            var receiverGO  = new GameObject("LiveKitReceiver");
            var lkReceiver  = receiverGO.AddComponent<ARLiveKitReceiver>();

            // ---- Mirror ----
            var mirrorSenderGO   = new GameObject("MirrorSender");
            var mirrorSender     = mirrorSenderGO.AddComponent<ARLocalMirrorSender>();

            var mirrorReceiverGO = new GameObject("MirrorReceiver");
            var mirrorReceiver   = mirrorReceiverGO.AddComponent<ARLocalMirrorReceiver>();

            // ---- UI ----
            BuildUI(captureSystem, imageRecorder, videoRecorder,
                    youtubeStreamer, lkPublisher, lkReceiver,
                    mirrorSender, mirrorReceiver);
        }

        // ================================================================
        // UI 自動生成
        // ================================================================

        private void BuildUI(
            ARCaptureSystem captureSystem,
            ARImageRecorder imageRecorder,
            ARVideoRecorder videoRecorder,
            ARYouTubeStreamer youtubeStreamer,
            ARLiveKitPublisher lkPublisher,
            ARLiveKitReceiver lkReceiver,
            ARLocalMirrorSender mirrorSender,
            ARLocalMirrorReceiver mirrorReceiver)
        {
            // Canvas
            var canvasGO = new GameObject("DemoCanvas");
            var canvas   = canvasGO.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGO.AddComponent<CanvasScaler>().uiScaleMode =
                CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvasGO.AddComponent<GraphicRaycaster>();
            canvasGO.AddComponent<EventSystemBootstrap>(); // EventSystem 追加ヘルパー

            // スクロールビュー（全体）
            var scroll   = CreateScrollView(canvasGO.transform);
            var content  = scroll.content;

            // タイトル
            AddLabel(content, "AR Recorder Demo", 22, Color.white);
            AddSpacer(content, 8);

            // ---- キャプチャモード ----
            AddLabel(content, "キャプチャモード", 16, Color.yellow);
            var capModeDD = AddDropdown(content, new[]
                { "AR全体", "カメラのみ", "AR要素のみ（透明）" });

            AddSpacer(content, 12);

            // ---- 画像キャプチャ ----
            AddLabel(content, "■ 画像キャプチャ", 16, Color.cyan);
            var captureBtn      = AddButton(content, "📷 スクリーンショット撮影");
            var imageStatusTxt  = AddLabel(content, "待機中", 13, Color.gray);
            var imagePreview    = AddRawImage(content, 200);

            AddSpacer(content, 12);

            // ---- 動画録画 ----
            AddLabel(content, "■ 動画録画", 16, Color.cyan);
            var audioDD      = AddDropdown(content, new[] { "なし", "マイク", "アプリ内音声" });
            var startVidBtn  = AddButton(content, "⏺ 録画開始");
            var stopVidBtn   = AddButton(content, "⏹ 録画停止");
            var videoStatus  = AddLabel(content, "待機中", 13, Color.gray);

            AddSpacer(content, 12);

            // ---- YouTube Live ----
            AddLabel(content, "■ YouTube Live", 16, Color.red);
            var streamKeyInput = AddInputField(content, "Stream Key");
            var startYTBtn     = AddButton(content, "▶ 配信開始");
            var stopYTBtn      = AddButton(content, "■ 配信停止");
            var ytStatus       = AddLabel(content, "待機中", 13, Color.gray);

            AddSpacer(content, 12);

            // ---- LiveKit Publisher ----
            AddLabel(content, "■ LiveKit 送信（WebRTC）", 16, new Color(0.4f, 1f, 0.4f));
            var lkServer   = AddInputField(content, "Server URL",   "ws://localhost:7880");
            var lkRoom     = AddInputField(content, "Room Name",    "ar-room");
            var lkName     = AddInputField(content, "Participant",  "AR-Publisher");
            var lkKey      = AddInputField(content, "API Key",      "devkey");
            var lkSecret   = AddInputField(content, "API Secret",   "secret");
            var lkConnBtn  = AddButton(content, "🔗 接続・配信開始");
            var lkDiscBtn  = AddButton(content, "✕ 切断");
            var lkMicTog   = AddToggle(content, "マイク ON");
            var lkPauTog   = AddToggle(content, "ビデオ一時停止");
            var lkPubSt    = AddLabel(content, "待機中", 13, Color.gray);

            AddSpacer(content, 12);

            // ---- LiveKit Receiver ----
            AddLabel(content, "■ LiveKit 受信（WebRTC）", 16, new Color(0.4f, 0.8f, 1f));
            var rxServer   = AddInputField(content, "Server URL",  "ws://localhost:7880");
            var rxRoom     = AddInputField(content, "Room Name",   "ar-room");
            var rxName     = AddInputField(content, "Participant", "Viewer");
            var rxConnBtn  = AddButton(content, "🔗 視聴開始");
            var rxDiscBtn  = AddButton(content, "✕ 切断");
            var lkRxSt     = AddLabel(content, "待機中", 13, Color.gray);
            var rxPreview  = AddRawImage(content, 200);
            lkReceiver.GetType().GetField("primaryDisplay",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                ?.SetValue(lkReceiver, rxPreview);

            AddSpacer(content, 12);

            // ---- Local Mirror Sender ----
            AddLabel(content, "■ ローカルミラー 送信", 16, new Color(1f, 0.8f, 0.2f));
            var mirStartBtn = AddButton(content, "📡 ミラーリング開始");
            var mirStopBtn  = AddButton(content, "■ 停止");
            var mirSendSt   = AddLabel(content, "停止中", 13, Color.gray);

            AddSpacer(content, 12);

            // ---- Local Mirror Receiver ----
            AddLabel(content, "■ ローカルミラー 受信", 16, new Color(1f, 0.6f, 0.2f));
            var mirAddrIn   = AddInputField(content, "送信側 IP",  "192.168.1.100");
            var mirPortIn   = AddInputField(content, "Port",        "9000");
            var mirConBtn   = AddButton(content, "📺 受信開始");
            var mirDisBtn   = AddButton(content, "✕ 切断");
            var mirRxSt     = AddLabel(content, "停止中", 13, Color.gray);
            var mirPreview  = AddRawImage(content, 200);
            mirrorReceiver.GetType().GetField("displayImage",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)
                ?.SetValue(mirrorReceiver, mirPreview);

            // ---- コントローラーにバインド ----
            var ctrlGO = new GameObject("DemoController");
            var ctrl   = ctrlGO.AddComponent<ARRecorderDemoController>();

            // リフレクションで SerializeField を設定
            var t = typeof(ARRecorderDemoController);
            var bf = System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance;

            SetField(ctrl, t, "captureSystem",    captureSystem,   bf);
            SetField(ctrl, t, "captureModeDropdown", capModeDD,   bf);
            SetField(ctrl, t, "imageRecorder",    imageRecorder,   bf);
            SetField(ctrl, t, "captureImageBtn",  captureBtn,      bf);
            SetField(ctrl, t, "imageStatusTxt",   imageStatusTxt,  bf);
            SetField(ctrl, t, "imagePreview",     imagePreview,    bf);
            SetField(ctrl, t, "videoRecorder",    videoRecorder,   bf);
            SetField(ctrl, t, "startVideoBtn",    startVidBtn,     bf);
            SetField(ctrl, t, "stopVideoBtn",     stopVidBtn,      bf);
            SetField(ctrl, t, "audioModeDropdown",audioDD,         bf);
            SetField(ctrl, t, "videoStatusTxt",   videoStatus,     bf);
            SetField(ctrl, t, "youtubeStreamer",  youtubeStreamer,  bf);
            SetField(ctrl, t, "streamKeyInput",   streamKeyInput,  bf);
            SetField(ctrl, t, "startYouTubeBtn",  startYTBtn,      bf);
            SetField(ctrl, t, "stopYouTubeBtn",   stopYTBtn,       bf);
            SetField(ctrl, t, "youtubeStatusTxt", ytStatus,        bf);
            SetField(ctrl, t, "lkPublisher",      lkPublisher,     bf);
            SetField(ctrl, t, "lkServerInput",    lkServer,        bf);
            SetField(ctrl, t, "lkRoomInput",      lkRoom,          bf);
            SetField(ctrl, t, "lkNameInput",      lkName,          bf);
            SetField(ctrl, t, "lkKeyInput",       lkKey,           bf);
            SetField(ctrl, t, "lkSecretInput",    lkSecret,        bf);
            SetField(ctrl, t, "lkConnectBtn",     lkConnBtn,       bf);
            SetField(ctrl, t, "lkDisconnectBtn",  lkDiscBtn,       bf);
            SetField(ctrl, t, "lkMicToggle",      lkMicTog,        bf);
            SetField(ctrl, t, "lkVideoPauseToggle",lkPauTog,       bf);
            SetField(ctrl, t, "lkPubStatusTxt",   lkPubSt,         bf);
            SetField(ctrl, t, "lkReceiver",       lkReceiver,      bf);
            SetField(ctrl, t, "rxServerInput",    rxServer,        bf);
            SetField(ctrl, t, "rxRoomInput",      rxRoom,          bf);
            SetField(ctrl, t, "rxNameInput",      rxName,          bf);
            SetField(ctrl, t, "rxConnectBtn",     rxConnBtn,       bf);
            SetField(ctrl, t, "rxDisconnectBtn",  rxDiscBtn,       bf);
            SetField(ctrl, t, "lkRxStatusTxt",    lkRxSt,          bf);
            SetField(ctrl, t, "mirrorSender",     mirrorSender,    bf);
            SetField(ctrl, t, "mirrorStartBtn",   mirStartBtn,     bf);
            SetField(ctrl, t, "mirrorStopBtn",    mirStopBtn,      bf);
            SetField(ctrl, t, "mirrorSenderStatusTxt", mirSendSt,  bf);
            SetField(ctrl, t, "mirrorReceiver",   mirrorReceiver,  bf);
            SetField(ctrl, t, "mirrorAddrInput",  mirAddrIn,       bf);
            SetField(ctrl, t, "mirrorPortInput",  mirPortIn,       bf);
            SetField(ctrl, t, "mirrorConnectBtn", mirConBtn,       bf);
            SetField(ctrl, t, "mirrorDisconnectBtn", mirDisBtn,    bf);
            SetField(ctrl, t, "mirrorRxStatusTxt", mirRxSt,        bf);
        }

        // ================================================================
        // UI ファクトリーヘルパー
        // ================================================================

        private static ScrollRect CreateScrollView(Transform parent)
        {
            var go = new GameObject("ScrollView");
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>();
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero; rt.offsetMax = Vector2.zero;
            var img = go.AddComponent<Image>(); img.color = new Color(0.05f, 0.05f, 0.08f, 0.95f);
            var sr  = go.AddComponent<ScrollRect>();

            // Viewport
            var vpGO = new GameObject("Viewport");
            vpGO.transform.SetParent(go.transform, false);
            var vpRT = vpGO.AddComponent<RectTransform>();
            vpRT.anchorMin = Vector2.zero; vpRT.anchorMax = Vector2.one;
            vpRT.offsetMin = new Vector2(0, 0); vpRT.offsetMax = new Vector2(-20, 0);
            vpGO.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            vpGO.AddComponent<Mask>().showMaskGraphic = false;

            // Content
            var ctGO = new GameObject("Content");
            ctGO.transform.SetParent(vpGO.transform, false);
            var ctRT = ctGO.AddComponent<RectTransform>();
            ctRT.anchorMin = new Vector2(0, 1); ctRT.anchorMax = new Vector2(1, 1);
            ctRT.pivot     = new Vector2(0.5f, 1f);
            ctRT.offsetMin = new Vector2(10, 0); ctRT.offsetMax = new Vector2(-10, 0);
            var vlg = ctGO.AddComponent<VerticalLayoutGroup>();
            vlg.padding    = new RectOffset(8, 8, 12, 20);
            vlg.spacing    = 6;
            vlg.childControlWidth  = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth  = true;
            vlg.childForceExpandHeight = false;
            ctGO.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            sr.viewport   = vpRT;
            sr.content    = ctRT;
            sr.horizontal = false;
            sr.vertical   = true;
            sr.scrollSensitivity = 30;

            // Scrollbar
            var sbGO = new GameObject("Scrollbar");
            sbGO.transform.SetParent(go.transform, false);
            var sbRT = sbGO.AddComponent<RectTransform>();
            sbRT.anchorMin = new Vector2(1, 0); sbRT.anchorMax = Vector2.one;
            sbRT.offsetMin = new Vector2(-20, 0); sbRT.offsetMax = Vector2.zero;
            sbGO.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.2f);
            var sb = sbGO.AddComponent<Scrollbar>();
            sb.direction = Scrollbar.Direction.BottomToTop;
            var sbHandle = new GameObject("Handle");
            sbHandle.transform.SetParent(sbGO.transform, false);
            sbHandle.AddComponent<RectTransform>();
            sbHandle.AddComponent<Image>().color = new Color(0.5f, 0.5f, 0.5f);
            sb.handleRect = sbHandle.GetComponent<RectTransform>();
            sr.verticalScrollbar = sb;

            return sr;
        }

        private static TextMeshProUGUI AddLabel(Transform parent, string text, int size, Color color)
        {
            var go  = new GameObject("Label_" + text.Substring(0, Mathf.Min(text.Length, 12)));
            go.transform.SetParent(parent, false);
            var rt  = go.AddComponent<RectTransform>(); rt.sizeDelta = new Vector2(0, size + 8);
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.text      = text;
            tmp.fontSize  = size;
            tmp.color     = color;
            tmp.alignment = TextAlignmentOptions.Left;
            go.AddComponent<LayoutElement>().preferredHeight = size + 8;
            return tmp;
        }

        private static Button AddButton(Transform parent, string label)
        {
            var go = new GameObject("Btn_" + label.Substring(0, Mathf.Min(label.Length, 12)));
            go.transform.SetParent(parent, false);
            var rt = go.AddComponent<RectTransform>(); rt.sizeDelta = new Vector2(0, 40);
            var img = go.AddComponent<Image>(); img.color = new Color(0.2f, 0.35f, 0.55f);
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            go.AddComponent<LayoutElement>().preferredHeight = 40;

            var textGO = new GameObject("Text");
            textGO.transform.SetParent(go.transform, false);
            var trt = textGO.AddComponent<RectTransform>();
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
            trt.offsetMin = trt.offsetMax = Vector2.zero;
            var tmp = textGO.AddComponent<TextMeshProUGUI>();
            tmp.text      = label;
            tmp.fontSize  = 14;
            tmp.color     = Color.white;
            tmp.alignment = TextAlignmentOptions.Center;
            return btn;
        }

        private static TMP_InputField AddInputField(Transform parent, string placeholder, string defaultVal = "")
        {
            var go = new GameObject("Input_" + placeholder);
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>().sizeDelta = new Vector2(0, 36);
            go.AddComponent<Image>().color = new Color(0.15f, 0.15f, 0.2f);
            var field = go.AddComponent<TMP_InputField>();
            go.AddComponent<LayoutElement>().preferredHeight = 36;

            var textAreaGO = new GameObject("TextArea");
            textAreaGO.transform.SetParent(go.transform, false);
            var taRT = textAreaGO.AddComponent<RectTransform>();
            taRT.anchorMin = Vector2.zero; taRT.anchorMax = Vector2.one;
            taRT.offsetMin = new Vector2(6, 2); taRT.offsetMax = new Vector2(-6, -2);
            textAreaGO.AddComponent<RectMask2D>();

            var phGO  = new GameObject("Placeholder");
            phGO.transform.SetParent(textAreaGO.transform, false);
            SetFullStretch(phGO.AddComponent<RectTransform>());
            var ph   = phGO.AddComponent<TextMeshProUGUI>();
            ph.text  = placeholder; ph.fontSize = 13;
            ph.color = new Color(0.5f, 0.5f, 0.5f);
            ph.alignment = TextAlignmentOptions.Left;

            var txtGO = new GameObject("Text");
            txtGO.transform.SetParent(textAreaGO.transform, false);
            SetFullStretch(txtGO.AddComponent<RectTransform>());
            var txt  = txtGO.AddComponent<TextMeshProUGUI>();
            txt.fontSize = 13; txt.color = Color.white;
            txt.alignment = TextAlignmentOptions.Left;

            field.textViewport    = taRT;
            field.textComponent   = txt;
            field.placeholder     = ph;
            field.text            = defaultVal;
            return field;
        }

        private static TMP_Dropdown AddDropdown(Transform parent, string[] options)
        {
            var go = new GameObject("Dropdown");
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>().sizeDelta = new Vector2(0, 36);
            go.AddComponent<Image>().color = new Color(0.15f, 0.15f, 0.2f);
            var dd = go.AddComponent<TMP_Dropdown>();
            go.AddComponent<LayoutElement>().preferredHeight = 36;
            dd.ClearOptions();
            dd.AddOptions(new System.Collections.Generic.List<string>(options));
            return dd;
        }

        private static Toggle AddToggle(Transform parent, string label)
        {
            var go = new GameObject("Toggle_" + label);
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>().sizeDelta = new Vector2(0, 30);
            var tg = go.AddComponent<Toggle>();
            go.AddComponent<LayoutElement>().preferredHeight = 30;

            var bg = new GameObject("Background");
            bg.transform.SetParent(go.transform, false);
            var bgRT = bg.AddComponent<RectTransform>();
            bgRT.anchorMin = new Vector2(0, 0.5f); bgRT.anchorMax = new Vector2(0, 0.5f);
            bgRT.sizeDelta = new Vector2(20, 20); bgRT.anchoredPosition = new Vector2(10, 0);
            bg.AddComponent<Image>().color = new Color(0.2f, 0.2f, 0.3f);

            var ck = new GameObject("Checkmark");
            ck.transform.SetParent(bg.transform, false);
            var ckRT = ck.AddComponent<RectTransform>();
            ckRT.anchorMin = Vector2.zero; ckRT.anchorMax = Vector2.one;
            ckRT.offsetMin = new Vector2(2,2); ckRT.offsetMax = new Vector2(-2,-2);
            var ckImg = ck.AddComponent<Image>(); ckImg.color = Color.green;

            var lbGO = new GameObject("Label");
            lbGO.transform.SetParent(go.transform, false);
            var lbRT = lbGO.AddComponent<RectTransform>();
            lbRT.anchorMin = new Vector2(0,0); lbRT.anchorMax = new Vector2(1,1);
            lbRT.offsetMin = new Vector2(28, 0); lbRT.offsetMax = Vector2.zero;
            var lbTMP = lbGO.AddComponent<TextMeshProUGUI>();
            lbTMP.text = label; lbTMP.fontSize = 13; lbTMP.color = Color.white;
            lbTMP.alignment = TextAlignmentOptions.Left;

            tg.graphic        = ckImg;
            tg.targetGraphic  = bg.GetComponent<Image>();
            tg.isOn           = true;
            return tg;
        }

        private static RawImage AddRawImage(Transform parent, int height)
        {
            var go = new GameObject("RawImage");
            go.transform.SetParent(parent, false);
            go.AddComponent<RectTransform>().sizeDelta = new Vector2(0, height);
            go.AddComponent<LayoutElement>().preferredHeight = height;
            var ri = go.AddComponent<RawImage>();
            ri.color = new Color(0.1f, 0.1f, 0.15f);
            return ri;
        }

        private static void AddSpacer(Transform parent, int height)
        {
            var go = new GameObject("Spacer");
            go.transform.SetParent(parent, false);
            var le = go.AddComponent<LayoutElement>();
            le.preferredHeight = height;
            le.minHeight       = height;
            go.AddComponent<RectTransform>().sizeDelta = new Vector2(0, height);
        }

        private static void SetFullStretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }

        private static void SetField(object obj, System.Type type, string name,
                                     object value, System.Reflection.BindingFlags bf)
        {
            var fi = type.GetField(name, bf);
            fi?.SetValue(obj, value);
        }
    }

    /// <summary>EventSystem を自動追加するヘルパー</summary>
    internal class EventSystemBootstrap : MonoBehaviour
    {
        private void Awake()
        {
            if (UnityEngine.EventSystems.EventSystem.current != null) return;
            var go = new GameObject("EventSystem");
            go.AddComponent<UnityEngine.EventSystems.EventSystem>();
            go.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
        }
    }
}

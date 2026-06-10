// Assets/ARRecorder/_Demo/Scripts/ARRecorderDemoController.cs
//
// Play ボタンを押すと全機能のUIが表示され、エディター上で動作確認できる。
// 実機では各コンポーネントが実際のARCore/ARKitと連動する。

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
    public class ARRecorderDemoController : MonoBehaviour
    {
        // ---- AR Core ----
        [Header("Core")]
        [SerializeField] private ARCaptureSystem    captureSystem;
        [SerializeField] private TMP_Dropdown       captureModeDropdown;

        // ---- Image ----
        [Header("Image Recording")]
        [SerializeField] private ARImageRecorder    imageRecorder;
        [SerializeField] private Button             captureImageBtn;
        [SerializeField] private TextMeshProUGUI    imageStatusTxt;
        [SerializeField] private RawImage           imagePreview;

        // ---- Video ----
        [Header("Video Recording")]
        [SerializeField] private ARVideoRecorder    videoRecorder;
        [SerializeField] private Button             startVideoBtn;
        [SerializeField] private Button             stopVideoBtn;
        [SerializeField] private TMP_Dropdown       audioModeDropdown;
        [SerializeField] private TextMeshProUGUI    videoStatusTxt;

        // ---- YouTube ----
        [Header("YouTube Live")]
        [SerializeField] private ARYouTubeStreamer  youtubeStreamer;
        [SerializeField] private TMP_InputField     streamKeyInput;
        [SerializeField] private Button             startYouTubeBtn;
        [SerializeField] private Button             stopYouTubeBtn;
        [SerializeField] private TextMeshProUGUI    youtubeStatusTxt;

        // ---- LiveKit Publisher ----
        [Header("LiveKit Publisher")]
        [SerializeField] private ARLiveKitPublisher lkPublisher;
        [SerializeField] private TMP_InputField     lkServerInput;
        [SerializeField] private TMP_InputField     lkRoomInput;
        [SerializeField] private TMP_InputField     lkNameInput;
        [SerializeField] private TMP_InputField     lkKeyInput;
        [SerializeField] private TMP_InputField     lkSecretInput;
        [SerializeField] private Button             lkConnectBtn;
        [SerializeField] private Button             lkDisconnectBtn;
        [SerializeField] private Toggle             lkMicToggle;
        [SerializeField] private Toggle             lkVideoPauseToggle;
        [SerializeField] private TextMeshProUGUI    lkPubStatusTxt;

        // ---- LiveKit Receiver ----
        [Header("LiveKit Receiver")]
        [SerializeField] private ARLiveKitReceiver  lkReceiver;
        [SerializeField] private TMP_InputField     rxServerInput;
        [SerializeField] private TMP_InputField     rxRoomInput;
        [SerializeField] private TMP_InputField     rxNameInput;
        [SerializeField] private Button             rxConnectBtn;
        [SerializeField] private Button             rxDisconnectBtn;
        [SerializeField] private TextMeshProUGUI    lkRxStatusTxt;

        // ---- Local Mirror Sender ----
        [Header("Local Mirror Sender")]
        [SerializeField] private ARLocalMirrorSender mirrorSender;
        [SerializeField] private Button              mirrorStartBtn;
        [SerializeField] private Button              mirrorStopBtn;
        [SerializeField] private TextMeshProUGUI     mirrorSenderStatusTxt;

        // ---- Local Mirror Receiver ----
        [Header("Local Mirror Receiver")]
        [SerializeField] private ARLocalMirrorReceiver mirrorReceiver;
        [SerializeField] private TMP_InputField        mirrorAddrInput;
        [SerializeField] private TMP_InputField        mirrorPortInput;
        [SerializeField] private Button                mirrorConnectBtn;
        [SerializeField] private Button                mirrorDisconnectBtn;
        [SerializeField] private TextMeshProUGUI       mirrorRxStatusTxt;

        // ================================================================
        // Unity Lifecycle
        // ================================================================

        private void Start()
        {
            SetupCaptureModeUI();
            SetupImageUI();
            SetupVideoUI();
            SetupYouTubeUI();
            SetupLKPublisherUI();
            SetupLKReceiverUI();
            SetupMirrorSenderUI();
            SetupMirrorReceiverUI();

            // AR キャプチャの毎フレームをプレビューに流す
            if (captureSystem != null)
                captureSystem.OnFrameCaptured += rt =>
                {
                    // 必要に応じて RawImage にプレビュー表示
                };
        }

        // ================================================================
        // Capture Mode
        // ================================================================

        private void SetupCaptureModeUI()
        {
            if (captureModeDropdown == null || captureSystem == null) return;
            captureModeDropdown.ClearOptions();
            captureModeDropdown.AddOptions(new System.Collections.Generic.List<string>
            {
                "AR全体（カメラ + ARオーバーレイ）",
                "カメラのみ",
                "AR要素のみ（透明背景）"
            });
            captureModeDropdown.onValueChanged.AddListener(i =>
            {
                captureSystem.CaptureMode = (ARCaptureMode)i;
                SetStatus(imageStatusTxt, $"キャプチャモード: {(ARCaptureMode)i}");
            });
        }

        // ================================================================
        // Image
        // ================================================================

        private void SetupImageUI()
        {
            if (imageRecorder != null)
            {
                imageRecorder.OnImageSaved += path =>
                {
                    SetStatus(imageStatusTxt, $"保存完了:\n{System.IO.Path.GetFileName(path)}");
                    // エディター上でプレビュー表示
                    if (imagePreview != null)
                    {
                        var tex = new Texture2D(2, 2);
                        tex.LoadImage(System.IO.File.ReadAllBytes(path));
                        imagePreview.texture = tex;
                    }
                };
                imageRecorder.OnError += e => SetStatus(imageStatusTxt, $"エラー: {e}");
            }

            Bind(captureImageBtn, () =>
            {
                SetStatus(imageStatusTxt, "キャプチャ中...");
                imageRecorder?.CaptureAndSave();
            });
        }

        // ================================================================
        // Video
        // ================================================================

        private void SetupVideoUI()
        {
            if (videoRecorder != null)
            {
                videoRecorder.OnRecordingStarted += path =>
                    SetStatus(videoStatusTxt, $"録画中:\n{System.IO.Path.GetFileName(path)}");
                videoRecorder.OnRecordingStopped += path =>
                    SetStatus(videoStatusTxt, $"保存完了:\n{System.IO.Path.GetFileName(path)}");
                videoRecorder.OnError += e => SetStatus(videoStatusTxt, $"エラー: {e}");
            }

            if (audioModeDropdown != null)
            {
                audioModeDropdown.ClearOptions();
                audioModeDropdown.AddOptions(new System.Collections.Generic.List<string>
                    { "なし", "マイク", "アプリ内音声" });
                audioModeDropdown.onValueChanged.AddListener(i =>
                {
                    if (videoRecorder != null) videoRecorder.AudioMode = (AudioCaptureMode)i;
                });
            }

            Bind(startVideoBtn, () =>
            {
                videoRecorder?.StartRecording();
                SetInteractable(startVideoBtn, false);
                SetInteractable(stopVideoBtn,  true);
            });

            Bind(stopVideoBtn, () =>
            {
                videoRecorder?.StopRecording();
                SetInteractable(startVideoBtn, true);
                SetInteractable(stopVideoBtn,  false);
            });
            SetInteractable(stopVideoBtn, false);
        }

        // ================================================================
        // YouTube Live
        // ================================================================

        private void SetupYouTubeUI()
        {
            if (youtubeStreamer != null)
            {
                youtubeStreamer.OnStreamStarted  += ()  => { SetStatus(youtubeStatusTxt, "配信中"); SetInteractable(startYouTubeBtn, false); SetInteractable(stopYouTubeBtn, true); };
                youtubeStreamer.OnStreamStopped  += ()  => { SetStatus(youtubeStatusTxt, "停止");   SetInteractable(startYouTubeBtn, true);  SetInteractable(stopYouTubeBtn, false); };
                youtubeStreamer.OnError          += e   => SetStatus(youtubeStatusTxt, $"エラー: {e}");
                youtubeStreamer.OnStateChanged   += s   => SetStatus(youtubeStatusTxt, s.ToString());
            }

            Bind(startYouTubeBtn, () =>
            {
                if (youtubeStreamer == null) return;
                if (streamKeyInput != null) youtubeStreamer.SetStreamKey(streamKeyInput.text);
                youtubeStreamer.StartStreaming();
            });

            Bind(stopYouTubeBtn, () => youtubeStreamer?.StopStreaming());
            SetInteractable(stopYouTubeBtn, false);
        }

        // ================================================================
        // LiveKit Publisher
        // ================================================================

        private void SetupLKPublisherUI()
        {
            if (lkServerInput  != null) lkServerInput.text  = "ws://localhost:7880";
            if (lkRoomInput    != null) lkRoomInput.text    = "ar-room";
            if (lkNameInput    != null) lkNameInput.text    = "AR-Publisher";
            if (lkKeyInput     != null) lkKeyInput.text     = "devkey";
            if (lkSecretInput  != null) lkSecretInput.text  = "secret";

            if (lkPublisher != null)
            {
                lkPublisher.OnConnected       += () => { SetStatus(lkPubStatusTxt, "配信中"); SetInteractable(lkConnectBtn, false); SetInteractable(lkDisconnectBtn, true); };
                lkPublisher.OnDisconnected    += () => { SetStatus(lkPubStatusTxt, "切断");   SetInteractable(lkConnectBtn, true);  SetInteractable(lkDisconnectBtn, false); };
                lkPublisher.OnParticipantJoined += id => SetStatus(lkPubStatusTxt, $"参加: {id}");
                lkPublisher.OnError           += e  => SetStatus(lkPubStatusTxt, $"エラー: {e}");
            }

            Bind(lkConnectBtn, () =>
            {
                if (lkPublisher == null) return;
                lkPublisher.SetConnection(
                    lkServerInput?.text  ?? "ws://localhost:7880",
                    lkRoomInput?.text    ?? "ar-room",
                    lkNameInput?.text    ?? "AR-Publisher",
                    lkKeyInput?.text     ?? "",
                    lkSecretInput?.text  ?? "");
                lkPublisher.ConnectAndPublish();
                SetStatus(lkPubStatusTxt, "接続中...");
            });

            Bind(lkDisconnectBtn, () => lkPublisher?.Disconnect());
            SetInteractable(lkDisconnectBtn, false);

            if (lkMicToggle       != null) lkMicToggle.onValueChanged.AddListener(on => lkPublisher?.SetMicrophoneMuted(!on));
            if (lkVideoPauseToggle != null) lkVideoPauseToggle.onValueChanged.AddListener(p  => lkPublisher?.SetVideoPaused(p));
        }

        // ================================================================
        // LiveKit Receiver
        // ================================================================

        private void SetupLKReceiverUI()
        {
            if (rxServerInput != null) rxServerInput.text = "ws://localhost:7880";
            if (rxRoomInput   != null) rxRoomInput.text   = "ar-room";
            if (rxNameInput   != null) rxNameInput.text   = "Viewer";

            if (lkReceiver != null)
            {
                lkReceiver.OnConnected       += () => { SetStatus(lkRxStatusTxt, "視聴中"); SetInteractable(rxConnectBtn, false); SetInteractable(rxDisconnectBtn, true); };
                lkReceiver.OnDisconnected    += () => { SetStatus(lkRxStatusTxt, "切断");   SetInteractable(rxConnectBtn, true);  SetInteractable(rxDisconnectBtn, false); };
                lkReceiver.OnParticipantJoined += id => SetStatus(lkRxStatusTxt, $"配信者入室: {id}");
                lkReceiver.OnError           += e  => SetStatus(lkRxStatusTxt, $"エラー: {e}");
            }

            Bind(rxConnectBtn, () =>
            {
                if (lkReceiver == null) return;
                lkReceiver.SetServerUrl(rxServerInput?.text ?? "ws://localhost:7880");
                lkReceiver.SetRoomName(rxRoomInput?.text    ?? "ar-room");
                lkReceiver.SetParticipantName(rxNameInput?.text ?? "Viewer");
                lkReceiver.Connect();
                SetStatus(lkRxStatusTxt, "接続中...");
            });

            Bind(rxDisconnectBtn, () => lkReceiver?.Disconnect());
            SetInteractable(rxDisconnectBtn, false);
        }

        // ================================================================
        // Local Mirror Sender
        // ================================================================

        private void SetupMirrorSenderUI()
        {
            if (mirrorSender != null)
            {
                mirrorSender.OnClientConnected    += addr => SetStatus(mirrorSenderStatusTxt, $"クライアント接続\n{mirrorSender.LocalIPAddress}:{mirrorSender.Port}");
                mirrorSender.OnClientDisconnected += addr => SetStatus(mirrorSenderStatusTxt, $"クライアント切断: {addr}");
                mirrorSender.OnError              += e    => SetStatus(mirrorSenderStatusTxt, $"エラー: {e}");
            }

            Bind(mirrorStartBtn, () =>
            {
                mirrorSender?.StartServer();
                SetStatus(mirrorSenderStatusTxt, $"配信中\nIP: {mirrorSender?.LocalIPAddress}:{mirrorSender?.Port}");
                SetInteractable(mirrorStartBtn, false);
                SetInteractable(mirrorStopBtn,  true);
            });

            Bind(mirrorStopBtn, () =>
            {
                mirrorSender?.StopServer();
                SetStatus(mirrorSenderStatusTxt, "停止");
                SetInteractable(mirrorStartBtn, true);
                SetInteractable(mirrorStopBtn,  false);
            });
            SetInteractable(mirrorStopBtn, false);
        }

        // ================================================================
        // Local Mirror Receiver
        // ================================================================

        private void SetupMirrorReceiverUI()
        {
            if (mirrorAddrInput != null) mirrorAddrInput.text = "192.168.1.100";
            if (mirrorPortInput != null) mirrorPortInput.text = "9000";

            if (mirrorReceiver != null)
            {
                mirrorReceiver.OnConnected    += () => { SetStatus(mirrorRxStatusTxt, "受信中"); SetInteractable(mirrorConnectBtn, false); SetInteractable(mirrorDisconnectBtn, true); };
                mirrorReceiver.OnDisconnected += () => { SetStatus(mirrorRxStatusTxt, "切断");   SetInteractable(mirrorConnectBtn, true);  SetInteractable(mirrorDisconnectBtn, false); };
                mirrorReceiver.OnError        += e  => SetStatus(mirrorRxStatusTxt, $"エラー: {e}");
            }

            Bind(mirrorConnectBtn, () =>
            {
                if (mirrorReceiver == null) return;
                mirrorReceiver.SetServerAddress(mirrorAddrInput?.text ?? "127.0.0.1");
                if (int.TryParse(mirrorPortInput?.text, out int p)) mirrorReceiver.SetServerPort(p);
                mirrorReceiver.Connect();
                SetStatus(mirrorRxStatusTxt, "接続中...");
            });

            Bind(mirrorDisconnectBtn, () => mirrorReceiver?.Disconnect());
            SetInteractable(mirrorDisconnectBtn, false);
        }

        // ================================================================
        // ヘルパー
        // ================================================================

        private static void Bind(Button btn, System.Action action)
        {
            if (btn != null) btn.onClick.AddListener(() => action());
        }

        private static void SetStatus(TextMeshProUGUI txt, string msg)
        {
            if (txt != null) txt.text = msg;
        }

        private static void SetInteractable(Button btn, bool v)
        {
            if (btn != null) btn.interactable = v;
        }
    }
}

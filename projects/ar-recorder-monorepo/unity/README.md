# Unity プロジェクト — AR Recorder

## Play ボタンで確認する手順

1. Unity Hub で `unity/` フォルダを **Open** して開く（Unity 2021.3 LTS 以上）
2. Package Manager の依存解決が完了するまで待つ
3. `Assets/ARRecorder/_Demo/Scenes/ARRecorderDemo.unity` を開く
4. **Play ▶** を押す

エディター上では `EditorARSimulator` が AR カメラの代替として起動し、
回転するサンプルキューブが表示されます。  
右クリック＋ドラッグでカメラ回転、WASD で移動できます。

---

## フォルダ構成

```
Assets/ARRecorder/
├── Core/                   # 共通基盤
│   ├── ARCaptureSystem.cs          キャプチャシステム本体
│   ├── ARRecorderEnums.cs          列挙型定義
│   ├── EditorARSimulator.cs        エディター用 AR 擬似環境
│   └── UnityMainThreadDispatcher.cs スレッド橋渡し
│
├── Recording/              # 記録機能
│   ├── Image/
│   │   └── ARImageRecorder.cs      PNG/JPEG 静止画保存
│   └── Video/
│       └── ARVideoRecorder.cs      MP4 動画録画
│                                   （エディターはフレームシーケンス保存）
│
├── Streaming/              # 配信・送信
│   ├── YouTube/
│   │   └── ARYouTubeStreamer.cs    YouTube Live RTMP 配信
│   └── LiveKit/
│       └── ARLiveKitPublisher.cs   LiveKit WebRTC 送信側
│
├── WebRTC/                 # 受信
│   └── ARLiveKitReceiver.cs        LiveKit WebRTC 受信・表示
│
├── Mirror/                 # ローカルネットワークミラーリング
│   ├── Sender/
│   │   └── ARLocalMirrorSender.cs  TCP JPEG ストリーム送信
│   └── Receiver/
│       └── ARLocalMirrorReceiver.cs TCP JPEG ストリーム受信
│
└── _Demo/                  # Play ボタンで動作確認できるデモ
    ├── Scenes/
    │   └── ARRecorderDemo.unity    ← ここを開いて Play
    └── Scripts/
        ├── DemoSceneBootstrapper.cs 全コンポーネント・UI を自動生成
        └── ARRecorderDemoController.cs UI ↔ コンポーネント のバインド
```

---

## 機能別クイックリファレンス

### 画像キャプチャ
```csharp
var capture = GetComponent<ARCaptureSystem>();
var recorder = GetComponent<ARImageRecorder>();

// モード変更（配信中でも即切り替え）
capture.CaptureMode = ARCaptureMode.CameraOnly;

// 撮影
recorder.OnImageSaved += path => Debug.Log("Saved: " + path);
recorder.CaptureAndSave();
```

### 動画録画
```csharp
var video = GetComponent<ARVideoRecorder>();
video.AudioMode = AudioCaptureMode.Microphone;
video.StartRecording();
// ...
video.StopRecording();
```

### YouTube Live
```csharp
var yt = GetComponent<ARYouTubeStreamer>();
yt.SetStreamKey("xxxx-xxxx-xxxx-xxxx");
yt.StartStreaming();
```

### LiveKit WebRTC 送信
```csharp
var pub = GetComponent<ARLiveKitPublisher>();
pub.SetConnection("ws://localhost:7880", "ar-room", "MyName", "devkey", "secret");
pub.ConnectAndPublish();
pub.SetMicrophoneMuted(true);  // マイクミュート
pub.SetVideoPaused(false);     // ビデオ再開
pub.Disconnect();
```

### LiveKit WebRTC 受信
```csharp
var recv = GetComponent<ARLiveKitReceiver>();
recv.SetServerUrl("ws://localhost:7880");
recv.SetRoomName("ar-room");
recv.Connect();
```

### ローカルミラーリング 送信
```csharp
var sender = GetComponent<ARLocalMirrorSender>();
sender.StartServer();
Debug.Log($"Connect to: {sender.LocalIPAddress}:{sender.Port}");
```

### ローカルミラーリング 受信
```csharp
var recv = GetComponent<ARLocalMirrorReceiver>();
recv.SetServerAddress("192.168.1.100");
recv.SetServerPort(9000);
recv.Connect();
```

---

## LiveKit SDK のインポート

`Packages/manifest.json` に以下が記述済みです。  
インターネット接続がある状態で Unity を開くと自動インポートされます。

```json
"io.livekit.unity": "https://github.com/livekit/client-sdk-unity.git#main"
```

SDK がインポートされた後、各スクリプトの先頭にある
`#define LIVEKIT_AVAILABLE` を有効にしてください。

---

## 実機ビルド設定

### Android
- Minimum API Level: 24
- Scripting Backend: IL2CPP / Target: ARM64
- XR Plug-in Management → ARCore ✓

### iOS
- Minimum iOS: 12.0
- Scripting Backend: IL2CPP
- XR Plug-in Management → ARKit ✓
- Info.plist: NSCameraUsageDescription / NSMicrophoneUsageDescription

---

## エディター Play 時の制限

| 機能 | エディター動作 |
|------|--------------|
| 画像キャプチャ | ✅ 実際にファイル保存 |
| 動画録画 | ✅ JPEG フレームシーケンス保存 |
| YouTube Live | ⚠️ ログ出力のみ（FFmpeg 未統合） |
| LiveKit 送信 | ⚠️ SDK なし → スタブ動作 / SDK あり → 実接続 |
| LiveKit 受信 | ⚠️ SDK なし → グラデーション表示 / SDK あり → 実受信 |
| ローカルミラー送信 | ✅ TCP サーバー実動作 |
| ローカルミラー受信 | ✅ TCP 受信・表示実動作 |

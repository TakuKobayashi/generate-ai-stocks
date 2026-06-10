# AR Recorder Monorepo

ARCore/ARKit 対応の AR 画面記録・共有ライブラリのモノリポジトリです。

## リポジトリ構成

```
ar-recorder-monorepo/
├── unity/                   # Unity プロジェクト（メイン）
│   └── Assets/ARRecorder/
│       ├── Core/            # AR キャプチャシステム共通基盤
│       ├── Recording/       # 画像・動画記録
│       │   ├── Image/       # スクリーンショット
│       │   └── Video/       # 動画録画（ネイティブプラグイン連携）
│       ├── Streaming/       # ライブ配信
│       │   ├── YouTube/     # YouTube Live（RTMP）
│       │   └── LiveKit/     # LiveKit WebRTC 送信
│       ├── WebRTC/          # LiveKit 受信・ルーム管理
│       ├── Mirror/          # ローカルネットワーク TCP ミラーリング
│       │   ├── Sender/
│       │   └── Receiver/
│       └── _Demo/           # Play ボタンで動作確認できるデモシーン
├── services/
│   ├── livekit/             # LiveKit サーバー（Docker Compose）
│   └── signaling/           # カスタムシグナリングサーバー（Node.js）
└── docs/                    # 技術ドキュメント
```

## クイックスタート

### 1. LiveKit サーバーを起動

```bash
cd services/livekit
docker compose up -d
```

### 2. Unity プロジェクトを開く

1. Unity Hub → **Open** → `unity/` フォルダを選択
2. Unity 2021.3 LTS 以上で開く
3. Package Manager が自動的に依存関係を解決

### 3. デモシーンを実行

```
Assets/ARRecorder/_Demo/Scenes/ARRecorderDemo.unity
```

を開いて **Play** ボタンを押すと全機能をエディター上で確認できます。

## 各プロジェクトの詳細

- [Unity プロジェクト](unity/README.md)
- [LiveKit サービス](services/livekit/README.md)
- [シグナリングサーバー](services/signaling/README.md)
- [技術ドキュメント](docs/LIVEKIT_AND_MIRRORING.md)

# doc-scanner

ドキュメントスキャン補正（OpenCV）と OCR（Tesseract.js）を行うツール。  
**CLI** と **Web API** の両方で利用でき、Cloud Run へのデプロイも1コマンドで行えます。

---

## プロジェクト構成

```
src/
├── core/              # CLI・API 共通のコアロジック
│   ├── scanner.ts     # OpenCV 輪郭検出 + 透視変換
│   ├── ocr.ts         # Tesseract.js OCR
│   ├── image.ts       # 画像フォーマット変換
│   ├── temp.ts        # 一時ファイル管理
│   └── processor.ts   # スキャン + OCR パイプライン
├── cli/
│   └── index.ts       # CLI エントリポイント（commander）
├── api/
│   ├── server.ts      # Hono サーバー
│   └── routes/        # ocr.ts / scan.ts / process.ts
└── deploy/
    └── index.ts       # Cloud Run デプロイスクリプト（クロスプラットフォーム）
```

---

## セットアップ

```bash
npm install
```

> `@u4/opencv4nodejs` のネイティブビルドが走るため数分かかります。

---

## CLI

`tsx` で TypeScript を直接実行します。

### コマンド一覧

| コマンド | 説明 |
|---------|------|
| `process <patterns>` | スキャン補正 + OCR を一括処理（デフォルト） |
| `ocr     <patterns>` | OCR テキスト抽出のみ |
| `scan    <patterns>` | スキャン補正のみ |

### 共通オプション

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `-o, --output <dir>` | `./output` | 出力ディレクトリ |
| `-l, --lang <lang>`  | `jpn+eng`  | OCR 言語 (`jpn` / `eng` / `jpn+eng`) |
| `--flat`             | false      | フラットに出力（サブディレクトリなし） |
| `-v, --verbose`      | false      | 詳細ログを表示 |

`process` コマンドのみ追加オプションあり:

| オプション | 説明 |
|-----------|------|
| `--skip-scan` | スキャン補正をスキップ |
| `--skip-ocr`  | OCR 処理をスキップ |

### 使用例

```bash
# カレントディレクトリの全 JPG を一括処理
npm run cli -- process "*.jpg"

# サブディレクトリ含む全 PNG、出力先指定
npm run cli -- process "photos/**/*.png" -o ./results -l jpn -v

# OCR のみ（英語）
npm run cli -- ocr "scan*.jpg" -l eng

# スキャン補正のみ、フラット出力
npm run cli -- scan "doc*.png" -o ./scanned --flat

# ヘルプ表示
npm run cli -- --help
npm run cli -- process --help
```

### 出力ファイル

```
output/
├── photo1/
│   ├── photo1.txt            # OCR 抽出テキスト
│   └── photo1_scanned.jpg    # スキャン補正済み画像（元フォーマット）
└── photo2/
    ├── photo2.txt
    └── photo2_scanned.png
```

---

## Web API

```bash
npm run serve
# → http://localhost:8080
```

### エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| `GET`  | `/`        | API 概要 |
| `GET`  | `/health`  | ヘルスチェック |
| `POST` | `/ocr`     | OCR テキスト抽出 |
| `POST` | `/scan`    | ドキュメントスキャン補正 |
| `POST` | `/process` | スキャン + OCR 一括 |

#### POST /ocr
```bash
curl -F "file=@document.jpg" "http://localhost:8080/ocr?lang=jpn+eng"
# → { "text": "...", "confidence": 87.3, "lang": "jpn+eng" }
```

#### POST /scan
```bash
curl -F "file=@document.jpg" http://localhost:8080/scan -o scanned.jpg
# → 補正済み画像バイナリ（元フォーマット）
```

#### POST /process
```bash
curl -F "file=@document.jpg" "http://localhost:8080/process?lang=jpn+eng" | jq

# スキャン補正画像を保存
curl -F "file=@document.jpg" http://localhost:8080/process \
  | jq -r '.scan.image' | base64 -d > scanned.jpg
```

---

## Cloud Run デプロイ

### 事前準備

```bash
# gcloud CLI インストール
# https://cloud.google.com/sdk/docs/install

# Windows の場合: Google Cloud SDK インストーラーを使用
# https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### デプロイ実行（Windows / macOS / Linux 共通）

```bash
npm run deploy
```

### オプション指定

```bash
npm run deploy -- --project my-gcp-project
npm run deploy -- --project my-project --region us-central1 --memory 4Gi
npm run deploy -- --service my-scanner --no-allow-unauthenticated
npm run deploy -- --help
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--project <id>`      | gcloud のデフォルト | GCP プロジェクト ID |
| `--region <region>`   | `asia-northeast1`  | デプロイリージョン（東京）|
| `--service <name>`    | `doc-scanner-api`  | Cloud Run サービス名 |
| `--memory <size>`     | `2Gi`              | メモリ割り当て |
| `--cpu <n>`           | `2`                | CPU 数 |
| `--min-instances <n>` | `0`                | 最小インスタンス数 |
| `--max-instances <n>` | `10`               | 最大インスタンス数 |
| `--timeout <sec>`     | `300`              | タイムアウト（秒） |
| `--no-allow-unauthenticated` | false      | 認証を必須にする |

---

## 対応フォーマット

`jpg`, `jpeg`, `png`, `webp`, `tiff`, `bmp`, `avif`

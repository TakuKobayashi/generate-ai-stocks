# gmail-calendar-sync

Gmail に届いた **予約確認・旅程・イベント案内・病院の予約・会議招待** などのメールを、
**ローカル LLM (Ollama + 7B〜8B モデル)** で読み取り、**Google カレンダーに自動登録** するサンプルプロジェクトです。

- 実行環境: **GitHub Actions のホストランナー (ubuntu-latest, CPU のみ)** で定期実行 (外部の LLM API 不要・メール本文を外部 AI に送らない)
- 言語: TypeScript (tsx で直接実行)
- 既定モデル: `qwen2.5:7b-instruct` (`llama3.1:8b` などに変更可)

> ⚠️ これはサンプルです。`samples/` のメールやテストの文面はすべて **架空のデータ** です。

---

## できること

| 機能 | 内容 |
|---|---|
| 対象メール | 予約確認・旅行 (フライト / ホテル / Airbnb / ツアー)・レストラン・イベント・病院・会議招待 |
| 抽出項目 | 日付・時刻・タイムゾーン・場所・予約番号・連絡先・メモ |
| 日本語 / 転送 / 海外 | 日本語メール、Yahoo!メール等からの転送 (`----- 転送メッセージ -----`)、海外ホテル (現地時間)、出発地と到着地でタイムゾーンが違うフライト |
| 重複防止 | Gmail ラベルで 1 通 1 回 + カレンダーの extendedProperties (予約番号・メッセージ ID・内容ハッシュ) + あいまい一致 |
| 変更 / キャンセル | 変更メールは既存予定を更新、キャンセルメールはタイトルに `【キャンセル】` (設定で削除も可) |
| 低信頼度 | `【要確認】` 付きの仮 (tentative) 予定として登録 + Gmail に `calendar-sync/needs-review` ラベル |
| DRY RUN | 書き込みせず予定アクションだけ表示。結果は `$GITHUB_STEP_SUMMARY` に表で出力 |

---

## アーキテクチャ

```mermaid
flowchart TD
    A[GitHub Actions<br/>cron 2 時間ごと] --> B{前段チェック<br/>--count-only<br/>対象メールあり?}
    B -- なし --> Z[終了<br/>Ollama を起動しない]
    B -- あり --> C[Ollama インストール<br/>モデルをキャッシュから復元 / pull]
    C --> D[Gmail 検索<br/>GMAIL_QUERY + -label:processed]
    D --> E[前処理 mime.ts<br/>MIME デコード / HTML→テキスト<br/>転送ヘッダ展開 / ノイズ除去 / 賢い切り詰め]
    E --> F{ヒューリスティック<br/>日付表記ある?}
    F -- ない --> L[processed ラベル]
    F -- ある --> G[LLM: classify<br/>種別 + confidence]
    G -- not_schedule --> L
    G --> H[LLM: extract<br/>本文の文字列を<br/>そのままコピー + few-shot]
    H --> I[逐語チェック (コード)<br/>本文に無い値を削除<br/>+ 任意で LLM 自己検証]
    I --> J[日時解決 dates.ts / timezones.ts<br/>年補完・曜日照合・IANA TZ<br/>LLM に計算させない]
    J --> K[重複検出 dedupe.ts<br/>extendedProperties 完全一致<br/>→ 前後1日のスコア計算<br/>→ 曖昧な候補だけ LLM]
    K --> M[Google Calendar<br/>作成 / 更新 / キャンセル]
    M --> L
    L --> N[Step Summary に結果表]
```

### ディレクトリ構成

```
gmail-calendar-sync/
├── .github/workflows/sync.yml   # 定期実行ワークフロー
├── scripts/get-refresh-token.ts # リフレッシュトークン取得 (ローカルで 1 回)
├── samples/*.eml                # 架空のサンプルメール (デモ・テスト用)
├── src/
│   ├── main.ts        # エントリポイント (--count-only 対応)
│   ├── pipeline.ts    # 1 通のメールの処理フロー
│   ├── config.ts      # 環境変数 → 設定 (zod で検証)
│   ├── gmail.ts       # Gmail API / モック / DRY RUN
│   ├── calendar.ts    # Calendar API / メモリ実装 / DRY RUN
│   ├── mime.ts        # 前処理 (デコード・転送展開・ノイズ除去・切り詰め)
│   ├── dates.ts       # 日付・時刻の決定的パース
│   ├── timezones.ts   # 地名・空港コード・オフセット → IANA
│   ├── planner.ts     # 逐語チェック・信頼度・カレンダー予定の組み立て
│   ├── dedupe.ts      # 重複検出 (スコアリング)
│   ├── logger.ts      # ログ・Step Summary
│   └── llm/
│       ├── ollama.ts  # /api/chat + 構造化出力 + 検証リトライ
│       ├── prompts.ts # プロンプトと few-shot
│       └── schemas.ts # zod スキーマ (→ JSON Schema)
└── tests/             # vitest (Ollama / Google 不要)
```

---

## セットアップ

### 1. Google Cloud プロジェクト

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「API とサービス」→「ライブラリ」で **Gmail API** と **Google Calendar API** を有効化

### 2. OAuth 同意画面

1. 「API とサービス」→「OAuth 同意画面」(Google Auth Platform)
2. ユーザーの種類
   - **Google Workspace のアカウントなら「内部 (Internal)」を推奨** — 審査不要・トークンの 7 日失効なし
   - 個人の Gmail なら「外部 (External)」
3. スコープ: `https://www.googleapis.com/auth/gmail.modify` と `https://www.googleapis.com/auth/calendar.events`
4. 「外部」の場合、テストユーザーに自分のアドレスを追加

> ⚠️ **重要: 「外部」かつ公開ステータスが「テスト」のままだと、リフレッシュトークンは 7 日で失効します。**
> 毎週トークンを取り直すのが面倒なら、公開ステータスを **「本番環境 (In production)」に変更** してください。
> 自分だけで使う場合は Google の審査を受けなくても使えます (同意時に「確認されていないアプリ」の警告が出るので
> 「詳細」→「(安全ではないページ) に移動」で続行。未確認アプリはユーザー数 100 人までの制限あり)。
> 本番環境に変更した後は **トークンを取り直して** ください (テスト中に発行したトークンは 7 日で失効します)。

### 3. OAuth クライアント ID

「認証情報」→「認証情報を作成」→「OAuth クライアント ID」→ 種類 **「デスクトップ アプリ」**。
クライアント ID とシークレットを控えます (デスクトップ アプリはループバック `http://127.0.0.1:<port>` へのリダイレクトが許可されています)。

### 4. リフレッシュトークンを取得 (ローカル PC で 1 回)

```bash
npm ci
cp .env.example .env   # GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を記入
npm run get-token
```

表示された URL をブラウザで開いて許可すると、ターミナルにリフレッシュトークンが表示されます。
(返ってこない場合は https://myaccount.google.com/permissions でアプリのアクセス権を削除して再実行)

### 5. GitHub に登録

リポジトリ (**プライベート推奨**、理由は「セキュリティ」参照) の Settings → Secrets and variables → Actions

**Secrets**

| 名前 | 値 |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | OAuth クライアント シークレット |
| `GOOGLE_REFRESH_TOKEN` | 手順 4 で取得したトークン |

**Variables (任意)**

| 名前 | 既定値 | 説明 |
|---|---|---|
| `MODEL` | `qwen2.5:7b-instruct` | Ollama のモデル名 |
| `CALENDAR_ID` | `primary` | 登録先カレンダー |
| `REVIEW_CALENDAR_ID` | (空) | 要確認の予定を入れる別カレンダー |
| `GMAIL_QUERY` | (下記参照) | 事前フィルタの検索クエリ |
| `MAX_MESSAGES` | `10` | 1 回で処理する最大件数 |
| `NUM_CTX` / `SELF_CHECK` / `LODGING_MODE` / `CANCEL_MODE` / `DEFAULT_TIMEZONE` / `REDACT_LOGS` | | 「設定一覧」参照 |

### 6. 動作確認

Actions タブ → `gmail-calendar-sync` → **Run workflow** (`dry_run` にチェック) で実行し、
ジョブの Summary に予定アクションの表が出ることを確認します。問題なければ定期実行 (cron) に任せます。
(cron 実行は常に本番モード。cron 式は **UTC** です)

---

## ローカルで試す

```bash
# 1) Ollama を入れてモデルを取得 (https://ollama.com)
ollama pull qwen2.5:7b-instruct

# 2) Google なしのデモ: samples/*.eml を読み、メモリ上の偽カレンダーに登録
MOCK_GOOGLE=true npm start

# 3) 本物の Gmail / カレンダーに対して DRY RUN
DRY_RUN=true npm start

# 4) 本番
npm start
```

---

## 設定一覧 (環境変数)

| 変数 | 既定値 | 説明 |
|---|---|---|
| `DRY_RUN` | `false` | `true` で書き込み (ラベル・予定) を一切しない |
| `MOCK_GOOGLE` | `false` | `true` で `samples/` とメモリカレンダーを使う |
| `GMAIL_QUERY` | `newer_than:14d -category:promotions -category:social (予約 OR 確認 OR …)` | 事前フィルタ。処理済みラベルの除外は自動付与 |
| `PROCESSED_LABEL` | `calendar-sync/processed` | 処理済みラベル |
| `REVIEW_LABEL` | `calendar-sync/needs-review` | 要確認ラベル |
| `MAX_MESSAGES` | `10` | 1 回の最大処理件数 (古い順に処理) |
| `CALENDAR_ID` | `primary` | 登録先 |
| `REVIEW_CALENDAR_ID` | (空) | 指定すると低信頼度の予定はこちらへ (接頭辞なし) |
| `DEFAULT_TIMEZONE` | `Asia/Tokyo` | タイムゾーンの手がかりが無い時 |
| `LODGING_MODE` | `span` | `span`: チェックイン日〜チェックアウト日の終日 1 件 / `separate`: チェックイン・チェックアウトを別々の 2 件 (時刻があれば時刻指定) |
| `CANCEL_MODE` | `mark` | `mark`: タイトルに `【キャンセル】` / `delete`: 削除 |
| `MIN_CONFIDENCE` | `0.6` | これ未満は要確認 |
| `DEFAULT_EVENT_MINUTES` | `60` | 終了時刻が無い時の長さ (レストラン・イベント 120 分、ツアー 180 分などは種別ごとに上書き) |
| `MODEL` | `qwen2.5:7b-instruct` | |
| `NUM_CTX` | `8192` | コンテキスト長 |
| `MAX_BODY_CHARS` | `6000` | LLM に渡す本文の最大文字数 (さらに `NUM_CTX` から自動で絞る) |
| `SELF_CHECK` | `auto` | `auto`: 逐語チェックで問題 / 分類が低信頼度の時だけ LLM 自己検証 / `always` / `never` |
| `LLM_TIMEOUT_MS` | `900000` | 1 リクエストのタイムアウト |
| `LOG_LEVEL` | `info` | `debug` で LLM のトークン数・候補スコアも出力 |
| `REDACT_LOGS` | `false` | `true` でログ・Summary の件名をハッシュ化 |

---

## モデルの選び方と RAM

GitHub ホストランナー (ubuntu-latest) の目安:

| リポジトリ | vCPU | RAM |
|---|---|---|
| パブリック | 4 | 16 GB |
| プライベート | 2 | 7 GB |

モデル (Ollama 既定の Q4_K_M 量子化) のメモリ目安:

| モデル | 重み | KV キャッシュ (8192 tok, q8_0) | 7 GB ランナー | 備考 |
|---|---|---|---|---|
| `qwen2.5:3b` | 約 1.9 GB | 約 0.15 GB | ◎ 速い | 精度は一段落ちる。まず動かしたい時に |
| **`qwen2.5:7b-instruct`** (既定) | 約 4.7 GB | 約 0.25 GB | ○ | 日本語・JSON 出力が安定。おすすめ |
| `llama3.1:8b` | 約 4.9 GB | 約 0.5 GB | ○ (余裕少なめ) | 英語メールが多いなら候補。日本語は qwen2.5 が有利なことが多い |
| 13B 級 (例 `llama2:13b`) | 約 7.4 GB | 約 0.8 GB | ✕ (スワップ / OOM) | 16 GB のパブリックランナーなら動くが非常に遅い |

- ワークフローでは `OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0` で KV キャッシュを半分にしています。
- `OLLAMA_NUM_PARALLEL=1` / `OLLAMA_MAX_LOADED_MODELS=1` で余計なメモリを確保させません。
- モデルファイルは `actions/cache` (キー = モデル名) でキャッシュします。リポジトリのキャッシュ上限は 10 GB なので、7B 1 個なら十分収まります。モデルを変えたら古いキャッシュは自動で追い出されます。

## 実行時間の目安

> 以下は **見積もり** です (このリポジトリでは CPU 2 vCPU のランナーで実測していません)。

- セットアップ (npm ci + Ollama インストール + モデル復元 + ロード): 2〜5 分。**対象メールが 0 件なら前段チェックで約 1 分で終了**
- 7B / 2 vCPU: プロンプト処理 おおよそ 15〜40 token/秒、生成 2〜5 token/秒
  - classify: 約 400 token + 本文冒頭 → 20〜60 秒
  - extract: few-shot 約 2,000 token + 本文 + 出力 200〜400 token → 1〜4 分
  - 1 通あたり 2〜5 分程度 → `MAX_MESSAGES=10` で最大 30〜50 分 (`timeout-minutes: 120`)
- 参考 (実測): 8 コアの開発機で `qwen2.5:1.5b-instruct` の場合、サンプル 8 通 (LLM 呼び出し 17 回) が約 70 秒
- **Ollama のプロンプトキャッシュ**: few-shot などプロンプトの先頭が同じ部分は KV キャッシュが再利用されます
  (実測: 2,000 token の extract プロンプトが初回 4.8 秒 → 2 回目以降 0.3 秒。間に classify を挟んでも維持)。
  そのためプロンプトは「固定部分を先頭、メール本文を末尾」に並べています。
- プライベートリポジトリは Actions の無料分数に上限があります (Free プランで月 2,000 分)。2 時間ごと × 対象メール無し 1 分 ≒ 月 360 分。メールが多い場合は cron 間隔や `MAX_MESSAGES` を調整してください。

---

## 精度を上げるための工夫 (小さいモデル向け)

1. **事前フィルタで LLM に渡す量を減らす**
   Gmail 検索クエリ (キーワード・`-category:promotions`・期間) と処理済みラベル、さらに「日付表記が 1 つも無いメールは捨てる」安価なヒューリスティック。
2. **前処理で本文をきれいにする**
   MIME デコード (ISO-2022-JP 等)、HTML→テキスト (表は列を保持・URL/画像は除去)、引用・フッター (配信停止・著作権表示) の除去、
   転送ヘッダ (`From:` / `Date:` / `Subject:`、`差出人:` / `件名:` も) から元メールの情報を取り出し、**元メールの日付を年補完の基準日** にする。
   長いメールは「先頭 + 日付・時刻・予約番号を含む行とその前後」を元の順序で残して切り詰め (トークン予算は `NUM_CTX` から自動計算)。
3. **1 ステップ 1 タスク + 構造化出力**
   classify → extract → (verify) → (same-event) と仕事を小さく分け、各ステップで Ollama の `format` に **JSON Schema** を渡して
   文法制約付きで生成 (壊れた JSON が出ない)。temperature 0・seed 固定。zod で検証し、失敗したら **エラー内容を伝えて 1 回だけ再試行**。
   スキーマは「無い値は空文字」「reason を先に書かせてから結論」にして、小さいモデルでも形が揃うようにしています。
4. **LLM には計算させず「コピー」させる**
   日付・時刻・タイムゾーンは本文の文字列を **一字一句そのまま** 抜き出させます (`date_text: "11/2(月)"` など)。
   年の補完 (次に来る日付)・曜日の照合・令和→西暦・午前/午後・`25:30` 表記・範囲表記 (`18:00〜21:00`)・
   タイムゾーン (地名 / 空港コード / `GMT+7` → IANA)・フライトの出発地/到着地タイムゾーン・宿泊の終日スパンは、すべて TypeScript で決定的に計算します。
5. **逐語チェックで幻覚を落とす**
   抜き出した文字列が本当に本文にあるかを NFKC 正規化 (全角/半角・空白を無視) して照合。
   無い値は削除し、日付が本文に無い場合は登録せず要確認に回します。書式だけ変えて写した日付・時刻は「同じ月日 / 時刻が本文にあるか」で救済。
   (実際に 1.5B モデルでの試験中、本文に無い「現地時間」をタイムゾーン欄に入れた幻覚がこのチェックで除去されました)
6. **信頼度の合成**
   classify の confidence から、曜日の矛盾・逐語チェックの問題・自己検証の指摘・不自然な長さなどで減点。閾値未満は `【要確認】` + tentative + needs-review ラベル。
7. **重複検出はまずコードで**
   予約番号・Gmail メッセージ ID・内容ハッシュを `extendedProperties.private` に保存して完全一致検索 → 前後 1 日の予定とスコア計算
   (タイトルの文字 bigram / 文字集合の類似度、時間の重なり、場所、予約番号) → **スコアが曖昧な候補だけ** LLM に 1 組ずつ「同じ予定?」と聞きます。
8. **few-shot**
   日本のホテル (現地時間)・国際線 (両端の現地時刻)・レストラン (全角括弧)・病院 (令和・午前)・キャンセル通知 の 5 例。
   すべて架空の値なので、モデルが例をそのまま写しても逐語チェックで弾かれます。

## チューニングのヒント

- **見逃しが多い**: `GMAIL_QUERY` のキーワードを増やす / 期間 (`newer_than`) を延ばす / 送信元で絞る (`from:(jetstar.com OR trip.com)`)
- **誤登録が多い**: `MIN_CONFIDENCE` を上げる、`SELF_CHECK=always`、`REVIEW_CALENDAR_ID` で別カレンダーに隔離して様子を見る
- **長いメールで情報が切れる**: `NUM_CTX=12288` + `MAX_BODY_CHARS=9000` (7B なら 7 GB ランナーでも KV q8_0 で収まる見込み。遅くはなる)
- **遅い**: `MODEL=qwen2.5:3b`、`SELF_CHECK=never`、`MAX_MESSAGES` を減らす、パブリックリポジトリ (4 vCPU) やセルフホストランナーを使う
- **特定サービスの形式**: `src/llm/prompts.ts` の few-shot に (架空化した) 例を追加。`src/timezones.ts` に地名を追加
- 迷ったら `LOG_LEVEL=debug` + `DRY_RUN=true` で抽出結果・候補スコア・トークン数を確認

## 制限事項

- 7B〜8B モデルは完璧ではありません。**要確認ラベル / 【要確認】予定は人が確認する前提** です。
- 年が書かれていない日付は「受信日 (転送なら元メールの日付) から見て次に来る日付」(14 日前まではその年) と推定します。曜日があれば曜日優先。
- 年なしの `M/D` は日本式 (月/日) とみなします。欧州式 `D/M/YYYY` は誤解釈の可能性があります。
- タイムゾーンは対応表 (主要都市・空港・国) で解決し、見つからなければ `DEFAULT_TIMEZONE`。夏時間は IANA 名なら luxon が正しく扱いますが、`GMT+1` のような固定オフセットは固定のままです。
- 変更通知で日付が大きく動いた場合、予約番号が無いと元の予定を見つけられず新規作成になることがあります。
- 繰り返し予定 (毎週の会議など) や .ics 添付の解析には対応していません (本文のみを読みます)。
- LLM/API エラーになったメールには処理済みラベルを付けないため次回再試行されます。恒常的に失敗するメールは手動で処理済みラベルを付けてください。
- Gmail の検索結果は 1 回 `MAX_MESSAGES` 件まで。古い順に処理するので、溜まっていても次回以降で追いつきます。

## セキュリティ

- Actions のログと Step Summary にはメールの件名・予定名が出ます。**プライベートリポジトリで使う** か `REDACT_LOGS=true` にしてください。
- `gmail.modify` はメールの読み取りとラベル変更ができる強い権限です。リフレッシュトークンは必ず Secrets に保存し、不要になったら Google アカウントの「サードパーティ アクセス」から取り消してください。
- メール本文は外部の LLM API には送られません (ランナー上の Ollama で処理)。ただし GitHub のランナー上で処理される点は理解した上で利用してください。
- メール本文中の「指示」に LLM が従ってしまうリスク (プロンプトインジェクション) は、出力をスキーマで制約し、値の逐語チェックをし、
  カレンダーへの書き込み以外の操作をさせない設計で抑えています。

## 開発

```bash
npm ci
npm run typecheck   # tsc --noEmit
npm test            # vitest (Ollama / Google 不要)
MOCK_GOOGLE=true MODEL=qwen2.5:1.5b-instruct npm start   # 小さいモデルでのスモークテスト
```

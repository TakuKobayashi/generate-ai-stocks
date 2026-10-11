/**
 * プロンプト定義。
 * 小さいモデル (7B〜8B) で精度を出すため、1 ステップ = 1 つの小さな仕事 にしている。
 * - classify: 予定メールかどうか / 種別 (本文の冒頭だけ渡して安く)
 * - extract : 本文から「文字列をそのままコピー」させる (日付計算はさせない) + few-shot
 * - verify  : 抽出結果が本文に書かれているかの自己検証 (任意)
 * - same    : 既存の予定と同一かの判定 (曖昧な候補 1 組ずつ)
 */
import type { ChatMessage } from "./ollama.js";
import type { ExtractedEvent, Extraction } from "./schemas.js";

export interface EmailForPrompt {
  subject: string;
  from: string;
  receivedDate: string; // 例: "2026-10-05 (月)"
  forwarded: boolean;
  body: string;
}

function emailBlock(e: EmailForPrompt): string {
  return [
    `受信日: ${e.receivedDate}`,
    `差出人: ${e.from}`,
    `件名: ${e.subject}`,
    e.forwarded ? "(このメールは転送されたものです。以下は元のメール本文)" : "",
    "本文:",
    "<<<",
    e.body,
    ">>>",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// classify
// ---------------------------------------------------------------------------
export const CLASSIFY_SYSTEM = `あなたはメール仕分けアシスタントです。メールがカレンダーに登録すべき予定に関するものかを判定し、JSON で答えます。

kind の選び方:
- travel_flight: 航空券・搭乗券・フライト旅程
- travel_lodging: ホテル・旅館・Airbnb などの宿泊予約
- reservation: レストラン・ツアー・チケット・美容院などの予約確認
- event: イベント・セミナー・コンサート・飲み会などの案内/参加確定
- appointment: 病院・歯科・役所・修理などのアポイント
- meeting: 会議・打ち合わせ・カレンダー招待
- change: 既存の予約/予定の日時・内容の変更通知
- cancellation: 予約/予定のキャンセル・取消の通知
- not_schedule: 広告・メルマガ・領収書のみ・ポイント通知・アンケートなど、具体的な日時の予定が無いもの

注意:
- 「予約」「確認」という単語があっても、具体的な予定の日時が無ければ not_schedule。
- 予約リクエスト (承認待ち) は reservation とし、confidence を下げる。
- confidence は 0〜1。迷う場合は 0.5 前後にする。`;

export function classifyMessages(e: EmailForPrompt): ChatMessage[] {
  return [
    { role: "system", content: CLASSIFY_SYSTEM },
    { role: "user", content: emailBlock({ ...e, body: e.body.slice(0, 1800) }) },
  ];
}

// ---------------------------------------------------------------------------
// extract
// ---------------------------------------------------------------------------
export const EXTRACT_SYSTEM = `あなたはメールから予定情報を抜き出すアシスタントです。JSON で答えます。

最重要ルール:
1. *_text、location、reservation_number、contact、source_quote は、本文に書かれている文字列を一字一句そのままコピーする。言い換え・翻訳・補完・計算をしない。
2. 日付の年を補ったり、曜日を計算したり、時差を計算したりしない。書かれている通りにコピーする (年が書かれていなければ年なしのまま)。
3. 本文に無い値は空文字 "" にする。推測で埋めない。
4. title だけは自分で短く作る (例: "鮨さいとう 2名", "JL407 成田→フランクフルト", "内科 受診")。

予定の分け方:
- フライト: 1 区間 = 1 件。date_text/start_time_text は出発、end_date_text/end_time_text は到着。location は出発空港、end_location は到着空港。到着が翌日なら到着日もコピー。
- 宿泊: 1 件。date_text/start_time_text はチェックイン、end_date_text/end_time_text はチェックアウト。all_day は true。
- 開始〜終了が「18:00-21:00」のように書かれていれば start_time_text と end_time_text に分ける。
- 時刻が無い予定は all_day を true。
- キャンセル通知は status を "cancelled"、変更通知は変更後の日時を抜き出して status を "changed"。予約リクエスト (未確定) は "tentative"。
- 「現地時間」「GMT+7」「日本時間」などの記載があれば timezone_text にコピー。
- 広告・領収書など予定が無いメールは events を空配列 [] にする。`;

const E = (p: Partial<ExtractedEvent> & Pick<ExtractedEvent, "kind" | "title" | "date_text">): ExtractedEvent => ({
  status: "confirmed",
  start_time_text: "",
  end_date_text: "",
  end_time_text: "",
  timezone_text: "",
  end_timezone_text: "",
  location: "",
  end_location: "",
  reservation_number: "",
  contact: "",
  all_day: false,
  notes: "",
  source_quote: "",
  ...p,
});

/** few-shot 例 (すべて架空のデータ) */
const FEW_SHOTS: Array<{ email: EmailForPrompt; answer: Extraction }> = [
  {
    email: {
      subject: "【予約確認】ホテルのご予約が確定しました",
      from: "Trip.com <noreply@trip.example>",
      receivedDate: "2026-10-01 (木)",
      forwarded: false,
      body: `予約番号：1288123456
ホテル名：アマリ ウォーターゲート バンコク
住所：847 Petchburi Road, Bangkok
チェックイン：2026年12月28日(月) 14:00以降
チェックアウト：2026年12月31日(木) 12:00まで
※記載の時間はすべて現地時間です
ホテル電話番号：+66 2 653 9000`,
    },
    answer: {
      events: [
        E({
          kind: "lodging",
          title: "アマリ ウォーターゲート バンコク 宿泊",
          date_text: "2026年12月28日(月)",
          start_time_text: "14:00",
          end_date_text: "2026年12月31日(木)",
          end_time_text: "12:00",
          timezone_text: "現地時間",
          location: "847 Petchburi Road, Bangkok",
          reservation_number: "1288123456",
          contact: "+66 2 653 9000",
          all_day: true,
          source_quote: "チェックイン：2026年12月28日(月) 14:00以降",
        }),
      ],
    },
  },
  {
    email: {
      subject: "ご搭乗案内 / e-ticket itinerary",
      from: "JAL <info@jal.example>",
      receivedDate: "2026-10-02 (金)",
      forwarded: false,
      body: `予約番号 (PNR): K7XQ2M
便名: JL407
出発: 2026年11月20日 11:25 東京(成田) NRT
到着: 2026年11月20日 16:40 フランクフルト FRA
※時刻はすべて現地時刻です
座席: 34K`,
    },
    answer: {
      events: [
        E({
          kind: "flight",
          title: "JL407 成田→フランクフルト",
          date_text: "2026年11月20日",
          start_time_text: "11:25",
          end_date_text: "2026年11月20日",
          end_time_text: "16:40",
          timezone_text: "現地時刻",
          end_timezone_text: "現地時刻",
          location: "東京(成田) NRT",
          end_location: "フランクフルト FRA",
          reservation_number: "K7XQ2M",
          notes: "座席: 34K",
          source_quote: "出発: 2026年11月20日 11:25 東京(成田) NRT",
        }),
      ],
    },
  },
  {
    email: {
      subject: "ご予約ありがとうございます",
      from: "鮨 さいとう <yoyaku@sushi.example>",
      receivedDate: "2026-11-01 (日)",
      forwarded: false,
      body: `ご予約日時：12月5日（土）19:00〜
人数：2名
店舗：鮨 さいとう 銀座店
TEL：03-1234-5678`,
    },
    answer: {
      events: [
        E({
          kind: "restaurant",
          title: "鮨 さいとう 2名",
          date_text: "12月5日（土）",
          start_time_text: "19:00",
          location: "鮨 さいとう 銀座店",
          contact: "03-1234-5678",
          notes: "人数：2名",
          source_quote: "ご予約日時：12月5日（土）19:00〜",
        }),
      ],
    },
  },
  {
    email: {
      subject: "Fwd: ご予約完了のお知らせ",
      from: "〇〇内科クリニック <no-reply@clinic.example>",
      receivedDate: "2026-11-02 (月)",
      forwarded: true,
      body: `予約日時：令和8年11月10日(火) 午前10時30分
診療科：内科
ご来院の際は保険証をお持ちください。
〇〇内科クリニック 電話 045-000-1111`,
    },
    answer: {
      events: [
        E({
          kind: "medical",
          title: "〇〇内科クリニック 内科 受診",
          date_text: "令和8年11月10日(火)",
          start_time_text: "午前10時30分",
          location: "〇〇内科クリニック",
          contact: "045-000-1111",
          notes: "保険証を持参",
          source_quote: "予約日時：令和8年11月10日(火) 午前10時30分",
        }),
      ],
    },
  },
  {
    email: {
      subject: "予約キャンセルのお知らせ",
      from: "ホットペッパー <info@hp.example>",
      receivedDate: "2026-11-05 (木)",
      forwarded: false,
      body: `以下のご予約はキャンセルされました。
予約番号：YD5512345
来店日時：11/14(土) 18:30
店舗：炭火焼鳥 とり源`,
    },
    answer: {
      events: [
        E({
          kind: "restaurant",
          status: "cancelled",
          title: "炭火焼鳥 とり源",
          date_text: "11/14(土)",
          start_time_text: "18:30",
          location: "炭火焼鳥 とり源",
          reservation_number: "YD5512345",
          source_quote: "以下のご予約はキャンセルされました。",
        }),
      ],
    },
  },
];

export function extractMessages(e: EmailForPrompt, kindHint: string): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: "system", content: EXTRACT_SYSTEM }];
  for (const ex of FEW_SHOTS) {
    msgs.push({ role: "user", content: emailBlock(ex.email) });
    msgs.push({ role: "assistant", content: JSON.stringify(ex.answer) });
  }
  msgs.push({
    role: "user",
    content: `${emailBlock(e)}\n\n(参考: 事前分類は "${kindHint}")`,
  });
  return msgs;
}

// ---------------------------------------------------------------------------
// verify (自己検証)
// ---------------------------------------------------------------------------
export const VERIFY_SYSTEM = `あなたは校正係です。メール本文と、そこから抜き出された予定 (JSON) を比べ、誤りを指摘します。

確認すること:
- 各フィールドの値が本文に実際に書かれているか (作られた値・別の予定の値が混ざっていないか)
- 開始と終了 (チェックイン/チェックアウト、出発/到着) が入れ替わっていないか
- キャンセル/変更の status が正しいか
誤りが無ければ issues は空配列、ok は true。`;

export function verifyMessages(e: EmailForPrompt, events: ExtractedEvent[]): ChatMessage[] {
  const slim = events.map((ev, i) => ({
    event_index: i,
    kind: ev.kind,
    status: ev.status,
    date_text: ev.date_text,
    start_time_text: ev.start_time_text,
    end_date_text: ev.end_date_text,
    end_time_text: ev.end_time_text,
    location: ev.location,
    reservation_number: ev.reservation_number,
  }));
  return [
    { role: "system", content: VERIFY_SYSTEM },
    { role: "user", content: `${emailBlock(e)}\n\n抜き出された予定:\n${JSON.stringify(slim, null, 1)}` },
  ];
}

// ---------------------------------------------------------------------------
// same event? (重複判定)
// ---------------------------------------------------------------------------
export const SAME_SYSTEM = `2 つの予定 A (メールから抽出) と B (カレンダーに既にある予定) が、同じ予約/予定を指しているかを判定します。
日時・場所・名称・予約番号を比べてください。同じ店や施設でも日付が違えば別の予定です。メールが日時の変更通知の場合、日時が違っても同じ予約番号・同じ施設なら同一とみなします。`;

export interface EventSummaryForCompare {
  title: string;
  when: string;
  location: string;
  reservation: string;
  description?: string;
}

export function sameEventMessages(a: EventSummaryForCompare, b: EventSummaryForCompare, isChange: boolean): ChatMessage[] {
  const fmt = (x: EventSummaryForCompare) =>
    `タイトル: ${x.title}\n日時: ${x.when}\n場所: ${x.location || "(なし)"}\n予約番号: ${x.reservation || "(なし)"}` +
    (x.description ? `\n説明(抜粋): ${x.description.slice(0, 300)}` : "");
  return [
    { role: "system", content: SAME_SYSTEM },
    {
      role: "user",
      content: `${isChange ? "(メールは変更通知です)\n" : ""}A:\n${fmt(a)}\n\nB:\n${fmt(b)}`,
    },
  ];
}

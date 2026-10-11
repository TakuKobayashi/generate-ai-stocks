/**
 * メールの前処理。
 * - MIME デコード (mailparser: ISO-2022-JP / Shift_JIS / quoted-printable / base64 も処理)
 * - text/plain 優先、無ければ HTML → テキスト (html-to-text)
 * - 引用・フッター等のノイズ除去
 * - 転送メール (「----- 転送メッセージ -----」等) の元ヘッダ (From/Date/Subject) の抽出
 * - 日付・時刻・予約番号を含む部分を優先して残す賢い切り詰め
 */
import { simpleParser, type AddressObject } from "mailparser";
import { convert } from "html-to-text";
import { DateTime } from "luxon";
import { normalizeText, parseDate, parseTime } from "./dates.js";

export interface ParsedEmail {
  messageIdHeader: string | null;
  from: string;
  subject: string;
  date: Date | null;
  text: string;
}

export interface ForwardInfo {
  isForwarded: boolean;
  originalFrom: string | null;
  originalDate: string | null;
  originalSubject: string | null;
  /** 転送ヘッダより後ろの本文 (元メール本文) */
  body: string;
}

export interface PreparedEmail {
  gmailId: string;
  threadId: string;
  messageIdHeader: string | null;
  from: string;
  subject: string;
  /** 予定解釈の基準日 (転送メールなら元メールの日付) */
  referenceDate: DateTime;
  receivedAt: DateTime;
  forward: ForwardInfo;
  /** ノイズ除去後の全文 (逐語チェック用。切り詰めない) */
  fullText: string;
  /** LLM に渡す本文 (切り詰め済み) */
  llmText: string;
}

function addressText(a: AddressObject | AddressObject[] | undefined): string {
  if (!a) return "";
  return (Array.isArray(a) ? a : [a]).map((x) => x.text).join(", ");
}

/** HTML → プレーンテキスト。リンク URL や画像は捨ててトークンを節約する。 */
export function htmlToPlain(html: string): string {
  return convert(html, {
    wordwrap: false,
    preserveNewlines: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "head", format: "skip" },
      // 表は予約メールで多用される。列を " | " で区切ったテキストにする。
      { selector: "table", format: "dataTable", options: { uppercaseHeaderCells: false, colSpacing: 2 } },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
    ],
  });
}

/** RFC822 の生メールをパースする (Gmail API の format=raw をデコードしたもの) */
export async function parseRawEmail(raw: Buffer | string): Promise<ParsedEmail> {
  const mail = await simpleParser(raw, { skipImageLinks: true, skipTextToHtml: true });
  let text = (mail.text ?? "").trim();
  const html = typeof mail.html === "string" ? mail.html : "";
  // text/plain が無い、または「HTML 版をご覧ください」程度しかない場合は HTML から作る
  if (html && (text.length < 200 || /HTML.{0,10}(形式|版|メール)|view (it )?in (your )?browser/i.test(text.slice(0, 300)))) {
    const fromHtml = htmlToPlain(html);
    if (fromHtml.length > text.length) text = fromHtml;
  }
  return {
    messageIdHeader: mail.messageId ?? null,
    from: addressText(mail.from),
    subject: mail.subject ?? "",
    date: mail.date ?? null,
    text,
  };
}

const FORWARD_MARKERS: RegExp[] = [
  /^-{2,}\s*転送(?:された)?メッセージ\s*-{2,}\s*$/m,
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/im,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^-{2,}\s*元のメッセージ\s*-{2,}\s*$/m,
  /^Begin forwarded message:\s*$/im,
  /^転送されたメッセージ[:：]?\s*$/m,
];

const HEADER_KEYS: Record<string, "from" | "date" | "subject" | "to"> = {
  from: "from", 差出人: "from", 送信者: "from", 送信元: "from",
  date: "date", sent: "date", 日付: "date", 送信日時: "date", 日時: "date",
  subject: "subject", 件名: "subject", 題名: "subject",
  to: "to", 宛先: "to", cc: "to",
};

/**
 * 転送メールを解析して元の From/Date/Subject と本文を取り出す。
 * Yahoo!メール・Gmail・Outlook・Apple Mail の典型的な形式に対応。
 */
export function unwrapForward(text: string): ForwardInfo {
  for (const re of FORWARD_MARKERS) {
    const m = re.exec(text);
    if (!m) continue;
    const after = text.slice(m.index + m[0].length).replace(/^\s*\n/, "");
    const lines = after.split("\n");
    const info: ForwardInfo = { isForwarded: true, originalFrom: null, originalDate: null, originalSubject: null, body: after };
    let i = 0;
    let seenHeader = false;
    for (; i < Math.min(lines.length, 15); i++) {
      // 引用記号付きの転送 ("> From: ...") にも対応
      const line = lines[i]!.replace(/^>\s?/, "").trim();
      if (line === "") {
        if (seenHeader) break;
        continue;
      }
      const h = line.match(/^([A-Za-z]+|[^\x00-\x7F]{2,4})\s*[:：]\s*(.*)$/);
      const key = h ? HEADER_KEYS[h[1]!.toLowerCase()] ?? HEADER_KEYS[h[1]!] : undefined;
      if (!h || !key) {
        if (seenHeader) break;
        continue;
      }
      seenHeader = true;
      const v = h[2]!.trim();
      if (key === "from") info.originalFrom = v;
      if (key === "date") info.originalDate = v;
      if (key === "subject") info.originalSubject = v;
    }
    if (seenHeader) info.body = lines.slice(i).join("\n").trim();
    return info;
  }
  return { isForwarded: false, originalFrom: null, originalDate: null, originalSubject: null, body: text };
}

const FOOTER_MARKERS: RegExp[] = [
  /このメールは.{0,20}(送信専用|配信専用)/,
  /本メールは.{0,20}(送信専用|配信専用)/,
  /配信(停止|解除)/,
  /メール(配信|マガジン)の(停止|解除|変更)/,
  /unsubscribe/i,
  /privacy policy|プライバシーポリシー|個人情報(保護方針|の取り扱い)/i,
  /^\s*(©|\(c\)|copyright)\s*\d{4}/im,
  /all rights reserved/i,
];

/**
 * ノイズ除去:
 * - URL を [URL] に短縮
 * - 返信の引用 (">" 行) を削除 (ただし本文の大半が引用なら引用記号を外して残す)
 * - 末尾付近のフッター (配信停止・著作権表示など) を切り落とす
 * - 罫線・空行の連続を圧縮
 */
export function cleanBody(text: string): string {
  let t = text.replace(/\r\n?/g, "\n");
  t = t.replace(/https?:\/\/[^\s<>"')\]]+/g, "[URL]");
  t = t.replace(/^[ \t]*[-=_*~━─＝]{6,}[ \t]*$/gm, "---");

  const lines = t.split("\n");
  const quoted = lines.filter((l) => /^\s*>/.test(l));
  const unquoted = lines.filter((l) => !/^\s*>/.test(l));
  const unquotedLen = unquoted.join("").replace(/\s/g, "").length;
  if (quoted.length > 0) {
    t = unquotedLen > 200 ? unquoted.join("\n") : lines.map((l) => l.replace(/^\s*(>\s?)+/, "")).join("\n");
  }

  // 「2026年10月5日 10:12 Foo <foo@example.com>:」形式の返信ヘッダ以降は過去のやり取りなので落とす (本文が十分ある時のみ)
  const replyHdr = t.search(/^.{0,80}(wrote|のメッセージ|書きました)[:：]\s*$/m);
  if (replyHdr > 300) t = t.slice(0, replyHdr);

  // フッター: 全体の後ろ 40% にある最初のマーカー行以降を削る
  const cutFrom = Math.floor(t.length * 0.6);
  let cut = t.length;
  for (const re of FOOTER_MARKERS) {
    const tail = t.slice(cutFrom);
    const m = re.exec(tail);
    if (m) {
      const lineStart = t.lastIndexOf("\n", cutFrom + m.index) + 1;
      cut = Math.min(cut, lineStart);
    }
  }
  t = t.slice(0, cut);

  return t
    .split("\n")
    .map((l) => l.replace(/[ \t\u3000]+/g, " ").trimEnd())
    .join("\n")
    .replace(/(\[URL\]\s*){2,}/g, "[URL] ")
    .replace(/(---\n)(\s*---\n)+/g, "---\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 予定情報を含みそうな行かどうかのスコア (切り詰め時の優先度) */
const IMPORTANT_LINE =
  /(\d{1,4}\s*[年/.-]\s*\d{1,2}|\d{1,2}\s*月\s*\d{1,2}|\d{1,2}\s*[:時]\s*\d{0,2}|予約|番号|確認|チェック|check-?in|check-?out|出発|到着|搭乗|便|flight|depart|arriv|日時|日程|開始|終了|会場|場所|住所|所在地|集合|受付|診察|受診|time|date|venue|address|location|booking|reservation|confirmation|itinerary|ticket|チケット|キャンセル|取消|変更|cancel|change|電話|TEL|phone|contact|連絡)/i;

/**
 * 文字数上限に収まるよう切り詰める。
 * 先頭部分は常に残し、残りは日付・時刻・予約番号などを含む行とその前後を元の順序で残す。
 */
export function truncateSmart(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split("\n");
  const headBudget = Math.floor(maxChars * 0.3);
  const keep = new Set<number>();
  let used = 0;
  // 1) 先頭
  for (let i = 0; i < lines.length && used + lines[i]!.length + 1 <= headBudget; i++) {
    keep.add(i);
    used += lines[i]!.length + 1;
  }
  // 2) 重要行とその前後 1 行 (スコアの高い順 = 出現順)
  const important: number[] = [];
  lines.forEach((l, i) => {
    if (IMPORTANT_LINE.test(l)) important.push(i);
  });
  outer: for (const i of important) {
    for (const j of [i, i - 1, i + 1]) {
      if (j < 0 || j >= lines.length || keep.has(j)) continue;
      const len = Math.min(lines[j]!.length, 300) + 1;
      if (used + len > maxChars - 50) break outer;
      keep.add(j);
      used += len;
    }
  }
  // 3) 元の順序で結合し、飛ばした箇所に省略記号
  const out: string[] = [];
  let prev = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (prev !== -1 && i !== prev + 1) out.push("…(中略)…");
    out.push(lines[i]!.length > 300 ? lines[i]!.slice(0, 300) + "…" : lines[i]!);
    prev = i;
  }
  return out.join("\n");
}

/**
 * 安価なヒューリスティック: 日付らしき表記が 1 つも無いメールは LLM に渡さない。
 */
export function looksLikeSchedule(subject: string, body: string): boolean {
  const t = normalizeText(`${subject}\n${body}`);
  const hasDate =
    /\d{4}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}|\d{1,2}\s*月\s*\d{1,2}\s*日|(?<![\d/])\d{1,2}\/\d{1,2}(?![\d/])|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|令和\s*\d+\s*年/i.test(
      t,
    );
  if (!hasDate) return false;
  const hasKeyword =
    /予約|確認|チケット|搭乗|宿泊|チェックイン|診察|受診|来院|招待|開催|会場|日時|日程|ご来店|キャンセル|変更|booking|reservation|confirm|itinerary|ticket|check-?in|flight|invitation|event|appointment|cancel/i.test(
      t,
    );
  const hasTime = /\d{1,2}\s*[:時]\s*\d{0,2}|\d{1,2}\s*(am|pm)/i.test(t);
  return hasKeyword || hasTime;
}

/** 転送ヘッダの Date 文字列を解釈 (失敗したら null) */
export function parseForwardDate(s: string | null, fallback: DateTime): DateTime | null {
  if (!s) return null;
  const d = parseDate(s, { reference: fallback });
  if (!d) {
    const js = new Date(s);
    return Number.isNaN(js.getTime()) ? null : DateTime.fromJSDate(js);
  }
  const t = parseTime(s.replace(/\d{4}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}\s*日?/, ""));
  return DateTime.fromObject({ year: d.year, month: d.month, day: d.day, hour: t?.hour ?? 0, minute: t?.minute ?? 0 });
}

/**
 * トークン数のざっくり見積もり。実測 (qwen2.5) で日本語は 1 文字 ≒ 1 token、英数字は 3〜4 文字 ≒ 1 token。
 * 安全側に倒して 日本語等 1.0 / ASCII 0.3 で数える。
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) < 128) ascii++;
    else other++;
  }
  return Math.ceil(other + ascii * 0.3);
}

export interface PrepareOptions {
  gmailId: string;
  threadId: string;
  internalDate: Date | null;
  maxBodyChars: number;
  /** 本文に使ってよいトークン数 (num_ctx から few-shot と出力分を引いたもの)。省略時は文字数上限のみ。 */
  bodyTokenBudget?: number;
  defaultTimezone: string;
}

/** 文字数上限とトークン予算の両方を満たす文字数 (本文の言語構成から比率を推定) */
export function bodyCharLimit(text: string, maxChars: number, tokenBudget?: number): number {
  if (!tokenBudget || text.length === 0) return maxChars;
  const tokensPerChar = Math.max(0.25, estimateTokens(text) / text.length);
  return Math.max(1000, Math.min(maxChars, Math.floor(tokenBudget / tokensPerChar)));
}

/** 生メール → LLM 投入用の整形済みデータ */
export async function prepareEmail(raw: Buffer | string, opts: PrepareOptions): Promise<PreparedEmail> {
  const parsed = await parseRawEmail(raw);
  const receivedJs = opts.internalDate ?? parsed.date ?? new Date();
  const receivedAt = DateTime.fromJSDate(receivedJs).setZone(opts.defaultTimezone);
  const forward = unwrapForward(parsed.text);
  const subject = forward.originalSubject || parsed.subject;
  const from = forward.originalFrom || parsed.from;
  const fwdDate = forward.isForwarded ? parseForwardDate(forward.originalDate, receivedAt) : null;
  const referenceDate = fwdDate && fwdDate <= receivedAt.plus({ days: 1 }) ? fwdDate : receivedAt;

  const fullText = cleanBody(forward.isForwarded ? forward.body : parsed.text);
  return {
    gmailId: opts.gmailId,
    threadId: opts.threadId,
    messageIdHeader: parsed.messageIdHeader,
    from,
    subject,
    referenceDate,
    receivedAt,
    forward,
    fullText,
    llmText: truncateSmart(fullText, bodyCharLimit(fullText, opts.maxBodyChars, opts.bodyTokenBudget)),
  };
}

/**
 * LLM の抽出結果 → 検証 → 日時解決 → カレンダー登録用の「計画」(PlannedEvent) を作る。
 * ここは純粋関数中心 (LLM / API を呼ばない) なのでユニットテストしやすい。
 */
import { DateTime, IANAZone } from "luxon";
import type { CalEvent } from "./calendar.js";
import { PROP, SOURCE_VALUE } from "./calendar.js";
import {
  describeWhen,
  findDatesInText,
  parseDate,
  parseTime,
  parseTimes,
  resolveWhen,
  type RawWhen,
  type ResolvedWhen,
} from "./dates.js";
import { contentHash, normalizeReservation, type Interval } from "./dedupe.js";
import type { Classification, ExtractedEvent } from "./llm/schemas.js";
import type { PreparedEmail } from "./mime.js";
import { resolveTimezoneFrom } from "./timezones.js";

/** 逐語チェック用の正規化: NFKC・空白除去・ダッシュ/波線統一・小文字化 */
export function normalizeVerbatim(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[〜~]/g, "~")
    .replace(/[‐‑‒–—―−ｰ]/g, "-")
    .replace(/[\s\u3000]+/g, "")
    .toLowerCase();
}

export interface VerifyIssue {
  field: string;
  severity: "minor" | "critical";
  message: string;
}

const TEXT_FIELDS = [
  "timezone_text",
  "end_timezone_text",
  "location",
  "end_location",
  "reservation_number",
  "contact",
] as const;

/** 値の大部分 (トークンの 80% 以上) が本文にあれば OK とみなす (複数行を連結した住所など) */
function mostlyPresent(value: string, hay: string): boolean {
  const tokens = value
    .normalize("NFKC")
    .split(/[\s,、，/|()（）]+/)
    .map((x) => normalizeVerbatim(x))
    .filter((x) => x.length >= 2);
  if (tokens.length === 0) return false;
  const hit = tokens.filter((x) => hay.includes(x)).length;
  return hit / tokens.length >= 0.8;
}

/**
 * 決定的な逐語チェック: LLM がコピーしたはずの文字列が本当に本文にあるか確認する。
 * 無い値は消し (幻覚対策)、問題を issues に記録する。
 */
export function verifyAgainstSource(
  ev: ExtractedEvent,
  sourceText: string,
  reference: DateTime,
): { event: ExtractedEvent; issues: VerifyIssue[] } {
  const hay = normalizeVerbatim(sourceText);
  const out: ExtractedEvent = { ...ev };
  const issues: VerifyIssue[] = [];
  const present = (v: string) => v.trim() === "" || hay.includes(normalizeVerbatim(v));

  // --- 日付 ---
  const sourceDates = findDatesInText(sourceText, reference);
  for (const f of ["date_text", "end_date_text"] as const) {
    const v = out[f];
    if (present(v)) continue;
    // 書式を変えて写した場合 (例: 本文 "11/2(月)" → 出力 "2026/11/02") は、同じ月日が本文にあれば許容
    const p = parseDate(v, { reference });
    const same = p && sourceDates.some((d) => d.month === p.month && d.day === p.day && (d.yearInferred || p.yearInferred || d.year === p.year));
    if (same) {
      issues.push({ field: f, severity: "minor", message: `書式が本文と異なる: "${v}"` });
    } else {
      issues.push({ field: f, severity: f === "date_text" ? "critical" : "minor", message: `本文に無い日付: "${v}"` });
      out[f] = "";
    }
  }

  // --- 時刻 ---
  const sourceTimes = parseTimes(sourceText).map((t) => t.hour * 60 + t.minute + t.dayOffset * 1440);
  for (const f of ["start_time_text", "end_time_text"] as const) {
    const v = out[f];
    if (present(v)) continue;
    const t = parseTime(v);
    if (t && sourceTimes.includes(t.hour * 60 + t.minute + t.dayOffset * 1440)) {
      issues.push({ field: f, severity: "minor", message: `書式が本文と異なる: "${v}"` });
    } else {
      issues.push({ field: f, severity: "critical", message: `本文に無い時刻: "${v}"` });
      out[f] = "";
    }
  }

  // --- その他の文字列 ---
  for (const f of TEXT_FIELDS) {
    const v = out[f];
    if (present(v) || mostlyPresent(v, hay)) continue;
    issues.push({ field: f, severity: "minor", message: `本文に無い値を削除: "${v}"` });
    out[f] = "";
  }
  return { event: out, issues };
}

export interface PlannedEvent {
  calendarId: string;
  /** 接頭辞なしのタイトル */
  baseTitle: string;
  /** カレンダーに表示するタイトル (【要確認】等の接頭辞付き) */
  summary: string;
  kind: ExtractedEvent["kind"];
  status: ExtractedEvent["status"];
  segment: string;
  when: ResolvedWhen;
  interval: Interval;
  location: string;
  reservation: string;
  rawReservation: string;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  hash: string;
  gmailId: string;
  calendarEvent: CalEvent;
}

export interface PlanOptions {
  calendarId: string;
  reviewCalendarId: string | null;
  defaultTimezone: string;
  defaultEventMinutes: number;
  lodgingMode: "span" | "separate";
  minConfidence: number;
  model: string;
}

export interface PlanFailure {
  title: string;
  reason: string;
}

const WARNING_PENALTY: Record<string, number> = {
  weekday_mismatch: 0.3,
  flight_too_long: 0.3,
  lodging_without_checkout: 0.2,
  end_before_start: 0.2,
  event_longer_than_24h: 0.15,
  assumed_overnight: 0.05,
};

export function gmailLink(email: Pick<PreparedEmail, "gmailId" | "messageIdHeader">): string {
  if (email.messageIdHeader) {
    const id = email.messageIdHeader.replace(/^<|>$/g, "");
    return `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(id)}`;
  }
  return `https://mail.google.com/mail/u/0/#all/${email.gmailId}`;
}

function flightSegment(ev: ExtractedEvent): string | null {
  const m = `${ev.title} ${ev.notes} ${ev.source_quote} ${ev.location}`.normalize("NFKC").match(/\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{1,4})\b/);
  return m ? `${m[1]}${m[2]}` : null;
}

function buildDescription(
  email: PreparedEmail,
  ev: ExtractedEvent,
  extra: { confidence: number; classKind: string; model: string; warnings: string[]; when: ResolvedWhen },
): string {
  const lines: string[] = [];
  lines.push(`📧 Gmail: ${gmailLink(email)}`);
  lines.push(`件名: ${email.subject}`);
  lines.push(`差出人: ${email.from}${email.forward.isForwarded ? " (転送メール)" : ""}`);
  if (ev.reservation_number) lines.push(`予約番号: ${ev.reservation_number}`);
  if (ev.contact) lines.push(`連絡先: ${ev.contact}`);
  if (extra.when.allDay && (extra.when.startTimeNote || extra.when.endTimeNote)) {
    lines.push(
      ev.kind === "lodging"
        ? `チェックイン: ${extra.when.startTimeNote ?? "-"} / チェックアウト: ${extra.when.endTimeNote ?? "-"} (${extra.when.timeZone})`
        : `時刻: ${extra.when.startTimeNote ?? "-"}〜${extra.when.endTimeNote ?? ""}`,
    );
  }
  if (ev.kind === "flight" && ev.location) lines.push(`出発: ${ev.location}${ev.end_location ? ` → 到着: ${ev.end_location}` : ""}`);
  if (ev.notes) lines.push(`メモ: ${ev.notes}`);
  if (ev.source_quote) lines.push("", "--- 抽出元 (本文より) ---", ev.source_quote);
  lines.push(
    "",
    "--- gmail-calendar-sync ---",
    `信頼度: ${extra.confidence.toFixed(2)} / 分類: ${extra.classKind} / モデル: ${extra.model}`,
  );
  if (extra.warnings.length) lines.push(`注意: ${extra.warnings.join(", ")}`);
  return lines.join("\n").slice(0, 7000);
}

function toEventTime(w: ResolvedWhen): Pick<CalEvent, "start" | "end"> {
  if (w.allDay) return { start: { date: w.startDate }, end: { date: w.endDateExclusive } };
  // luxon の固定オフセット (UTC+7 等) は Google の timeZone に渡せないので、IANA 名の時だけ付与
  const tz = (z: string) => (IANAZone.isValidZone(z) ? z : undefined);
  return {
    start: { dateTime: w.start.toISO({ suppressMilliseconds: true })!, timeZone: tz(w.timeZone) },
    end: { dateTime: w.end.toISO({ suppressMilliseconds: true })!, timeZone: tz(w.endTimeZone) },
  };
}

function toInterval(w: ResolvedWhen): Interval {
  if (w.allDay) {
    return {
      start: DateTime.fromISO(w.startDate, { zone: w.timeZone }).toMillis(),
      end: DateTime.fromISO(w.endDateExclusive, { zone: w.timeZone }).toMillis(),
    };
  }
  return { start: w.start.toMillis(), end: w.end.toMillis() };
}

/**
 * 1 通のメールの抽出結果からカレンダー登録計画を作る。
 */
export function planEvents(
  email: PreparedEmail,
  classification: Classification,
  extracted: Array<{ event: ExtractedEvent; issues: VerifyIssue[]; llmIssues: number }>,
  opts: PlanOptions,
): { planned: PlannedEvent[]; failures: PlanFailure[] } {
  const planned: PlannedEvent[] = [];
  const failures: PlanFailure[] = [];
  const tzResolver = (c: Array<string | null | undefined>, fb: string) => resolveTimezoneFrom(c, fb);

  extracted.forEach(({ event: ev, issues, llmIssues }, index) => {
    // 分類が cancellation / change なら status を上書き
    const status: ExtractedEvent["status"] =
      classification.kind === "cancellation" ? "cancelled" : classification.kind === "change" && ev.status === "confirmed" ? "changed" : ev.status;
    const baseTitleRaw = ev.title.trim() || [ev.kind, ev.location].filter(Boolean).join(" ") || email.subject;

    // 宿泊の separate モードは チェックイン / チェックアウト の 2 件に分ける
    type Variant = { raw: RawWhen; title: string; segment: string };
    const raw: RawWhen = { ...ev };
    const variants: Variant[] = [];
    if (ev.kind === "lodging" && opts.lodgingMode === "separate") {
      variants.push({
        raw: { ...raw, kind: "other", end_date_text: "", end_time_text: "", all_day: !ev.start_time_text },
        title: `チェックイン: ${baseTitleRaw}`,
        segment: "lodging-in",
      });
      if (ev.end_date_text) {
        variants.push({
          raw: { ...raw, kind: "other", date_text: ev.end_date_text, start_time_text: ev.end_time_text, end_date_text: "", end_time_text: "", all_day: !ev.end_time_text },
          title: `チェックアウト: ${baseTitleRaw}`,
          segment: "lodging-out",
        });
      }
    } else {
      const seg = ev.kind === "flight" ? flightSegment(ev) ?? `flight-${index}` : ev.kind === "lodging" ? "lodging" : `${ev.kind}-${index}`;
      variants.push({ raw, title: baseTitleRaw, segment: seg });
    }

    for (const v of variants) {
      const res = resolveWhen(
        v.raw,
        { reference: email.referenceDate, defaultTimezone: opts.defaultTimezone, defaultEventMinutes: opts.defaultEventMinutes },
        tzResolver,
      );
      if (!res.ok) {
        failures.push({ title: v.title, reason: res.reason });
        continue;
      }
      const when = res.when;
      const warnings = [...when.warnings, ...issues.map((i) => `${i.field}:${i.severity}`)];

      // --- 信頼度 ---
      let confidence = classification.kind === "not_schedule" ? 0.5 : classification.confidence;
      for (const w of when.warnings) {
        const key = Object.keys(WARNING_PENALTY).find((k) => w.startsWith(k));
        if (key) confidence -= WARNING_PENALTY[key]!;
      }
      for (const i of issues) confidence -= i.severity === "critical" ? 0.3 : 0.05;
      confidence -= llmIssues * 0.1;
      confidence = Math.max(0, Math.min(1, confidence));
      const needsReview = confidence < opts.minConfidence || status === "tentative";

      const useReviewCal = needsReview && opts.reviewCalendarId;
      const calendarId = useReviewCal ? opts.reviewCalendarId! : opts.calendarId;
      const prefix = needsReview && !useReviewCal ? "【要確認】" : "";
      const summary = `${prefix}${v.title}`;
      const reservation = normalizeReservation(ev.reservation_number);
      const times = toEventTime(when);
      const location = ev.location;
      const hash = contentHash({
        title: v.title,
        start: times.start?.date ?? times.start?.dateTime ?? "",
        end: times.end?.date ?? times.end?.dateTime ?? "",
        location,
      });

      const privateProps: Record<string, string> = {
        [PROP.source]: SOURCE_VALUE,
        [PROP.messageId]: email.gmailId,
        [PROP.kind]: ev.kind,
        [PROP.segment]: v.segment,
        [PROP.hash]: hash,
      };
      if (reservation) privateProps[PROP.reservation] = reservation.slice(0, 200);

      const calendarEvent: CalEvent = {
        summary,
        location: location || undefined,
        description: buildDescription(email, ev, {
          confidence,
          classKind: classification.kind,
          model: opts.model,
          warnings,
          when,
        }),
        ...times,
        status: needsReview ? "tentative" : "confirmed",
        // 宿泊の終日予定は「予定なし」(透過) にして他の予定と衝突表示させない
        transparency: when.allDay ? "transparent" : "opaque",
        source: { title: email.subject.slice(0, 200), url: gmailLink(email) },
        extendedProperties: { private: privateProps },
      };

      planned.push({
        calendarId,
        baseTitle: v.title,
        summary,
        kind: ev.kind,
        status,
        segment: v.segment,
        when,
        interval: toInterval(when),
        location,
        reservation,
        rawReservation: ev.reservation_number,
        confidence,
        needsReview,
        warnings,
        hash,
        gmailId: email.gmailId,
        calendarEvent,
      });
    }
  });
  return { planned, failures };
}

export { describeWhen };

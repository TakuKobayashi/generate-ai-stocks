/**
 * 日付・時刻の決定的な解析。
 * LLM には「メールに書かれた文字列そのまま」(例: "11/2(月)", "午後6時半", "2026年11月2日") を抜き出させ、
 * 年の補完・曜日の照合・タイムゾーン適用・終了時刻の計算などはすべてここで行う。
 * (7B クラスのモデルは日付計算・曜日計算を頻繁に間違えるため)
 */
import { DateTime } from "luxon";

export interface DateParts {
  year: number;
  month: number;
  day: number;
  /** 文字列中に曜日があれば 1=月 ... 7=日 (luxon と同じ) */
  weekday?: number;
  /** 年が書かれておらず補完した場合 true */
  yearInferred: boolean;
  /** 曜日が日付と矛盾している等の警告 */
  warnings: string[];
}

export interface TimeParts {
  hour: number;
  minute: number;
  /** "25:30" のような深夜表記の場合の日跨ぎ (+1) */
  dayOffset: number;
  /** 午後/PM が明示されていたか (終了時刻の補完に使う) */
  meridiem?: "am" | "pm";
}

const JA_WEEKDAY: Record<string, number> = { 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 7 };
const EN_WEEKDAY: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const EN_MONTH: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?(?![a-z])";

/**
 * 全角/半角・各種ダッシュ・波ダッシュを正規化する。
 * NFKC で全角英数字→半角、「～」→「~」。「〜」(波ダッシュ) や各種ダッシュも揃える。
 */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[〜~]/g, "~")
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/[ \t\u3000]+/g, " ");
}

function extractWeekday(t: string): number | undefined {
  const ja = t.match(/[(]\s*([月火水木金土日])(?:曜日?)?\s*[)]/) ?? t.match(/([月火水木金土日])曜日?/);
  if (ja) {
    // 「11月」の「月」を曜日と誤認しないよう、括弧なしの場合は「曜」が必須 (上の 2 つ目の正規表現)
    if (ja[0].includes("(") || ja[0].includes("曜")) return JA_WEEKDAY[ja[1]!];
  }
  const en = t.match(/\b(mon|tue|wed|thu|fri|sat|sun)(?:day|sday|nesday|rsday|urday)?\b\.?/i);
  if (en) return EN_WEEKDAY[en[1]!.toLowerCase()];
  return undefined;
}

function valid(y: number, m: number, d: number): boolean {
  return DateTime.fromObject({ year: y, month: m, day: d }).isValid;
}

export interface ParseDateOptions {
  /** 年の補完の基準日 (通常はメール受信日) */
  reference: DateTime;
  /**
   * 年を補完する際、基準日よりこの日数以上前になる場合は翌年とみなす (「次に来るその日付」)。
   * 例: 12/20 受信のメールに「1/5」→ 翌年 1/5。
   */
  pastGraceDays?: number;
  /** この日付より前にならないように年を補完 (チェックアウト日など) */
  notBefore?: DateTime;
}

/**
 * 日本語・英語の日付表記をパースする。対応例:
 * 2026年11月2日 / 2026/11/02 / 2026-11-02 / 2026.11.2 / 令和8年11月2日 / R8.11.2 /
 * 11月2日(月) / 11/2(月) / Nov 2, 2026 / 2 November 2026 / Mon, Nov 2
 */
export function parseDate(text: string | null | undefined, opts: ParseDateOptions): DateParts | null {
  if (!text) return null;
  const t = normalizeText(text);
  const weekday = extractWeekday(t);
  let y: number | undefined;
  let m: number | undefined;
  let d: number | undefined;
  let r: RegExpMatchArray | null;

  if ((r = t.match(/(令和|平成|R|H)\s*(\d{1,2}|元)\s*[年./]\s*(\d{1,2})\s*[月./]\s*(\d{1,2})/))) {
    const n = r[2] === "元" ? 1 : Number(r[2]);
    y = (r[1] === "令和" || r[1] === "R" ? 2018 : 1988) + n;
    m = Number(r[3]);
    d = Number(r[4]);
  } else if ((r = t.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/))) {
    y = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else if ((r = t.match(/(?<!\d)(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?!\d)/))) {
    y = Number(r[1]);
    m = Number(r[2]);
    d = Number(r[3]);
  } else if ((r = t.match(new RegExp(`(?<![\\d])(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE},?\\s*(\\d{4})?`, "i")))) {
    d = Number(r[1]);
    m = EN_MONTH[r[2]!.toLowerCase().slice(0, 3)];
    y = r[3] ? Number(r[3]) : undefined;
  } else if ((r = t.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s*(\\d{4}))?`, "i")))) {
    m = EN_MONTH[r[1]!.toLowerCase().slice(0, 3)];
    d = Number(r[2]);
    y = r[3] ? Number(r[3]) : undefined;
  } else if ((r = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
    m = Number(r[1]);
    d = Number(r[2]);
  } else if ((r = t.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/))) {
    // 年なしの M/D は日本式 (月/日) とみなす
    m = Number(r[1]);
    d = Number(r[2]);
  }

  if (m === undefined || d === undefined || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const warnings: string[] = [];
  if (y !== undefined) {
    if (!valid(y, m, d)) return null;
    if (weekday !== undefined) {
      const wd = DateTime.fromObject({ year: y, month: m, day: d }).weekday;
      if (wd !== weekday) warnings.push(`weekday_mismatch: ${y}-${m}-${d} は曜日 ${wd} だが本文は ${weekday}`);
    }
    return { year: y, month: m, day: d, weekday, yearInferred: false, warnings };
  }

  // --- 年の補完 ---
  const ref = opts.reference.startOf("day");
  const grace = opts.pastGraceDays ?? 14;
  const candidates = [ref.year, ref.year + 1, ref.year - 1];
  const notBefore = opts.notBefore?.startOf("day");
  const scoreYear = (yy: number): number => {
    if (!valid(yy, m!, d!)) return -Infinity;
    const dt = DateTime.fromObject({ year: yy, month: m, day: d });
    let s = 0;
    if (notBefore) {
      if (dt < notBefore) return -Infinity;
      s -= dt.diff(notBefore, "days").days / 365; // 近い方を優先
    } else {
      if (dt < ref.minus({ days: grace })) s -= 10; // 過去すぎる → 来年の可能性が高い
      s -= Math.abs(dt.diff(ref, "days").days) / 365;
    }
    if (weekday !== undefined && dt.weekday === weekday) s += 20; // 曜日一致は最優先
    return s;
  };
  let bestYear = candidates[0]!;
  let bestScore = -Infinity;
  for (const yy of candidates) {
    const s = scoreYear(yy);
    if (s > bestScore) {
      bestScore = s;
      bestYear = yy;
    }
  }
  if (bestScore === -Infinity) return null;
  if (weekday !== undefined && DateTime.fromObject({ year: bestYear, month: m, day: d }).weekday !== weekday) {
    warnings.push(`weekday_mismatch: 年補完後も曜日が一致しません (${bestYear}-${m}-${d})`);
  }
  return { year: bestYear, month: m, day: d, weekday, yearInferred: true, warnings };
}

const TIME_RE =
  /(午前|午後|朝|昼|夕方|夜|深夜)?\s*(\d{1,2})(?:\s*:\s*(\d{2})|\s*時(?!間)\s*(?:(\d{1,2})\s*分|(半))?)\s*(am|pm|a\.m\.|p\.m\.)?|(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)|(正午)/gi;

function toTimeParts(m: RegExpMatchArray): TimeParts | null {
  if (m[9]) return { hour: 12, minute: 0, dayOffset: 0, meridiem: "pm" };
  let hour: number;
  let minute = 0;
  let mer: string | undefined;
  let jaPrefix: string | undefined;
  if (m[7]) {
    hour = Number(m[7]);
    mer = m[8];
  } else {
    jaPrefix = m[1];
    hour = Number(m[2]);
    if (m[3]) minute = Number(m[3]);
    else if (m[4]) minute = Number(m[4]);
    else if (m[5]) minute = 30;
    mer = m[6];
  }
  let meridiem: "am" | "pm" | undefined;
  const merL = mer?.toLowerCase().replace(/\./g, "");
  if (merL === "pm" || jaPrefix === "午後" || jaPrefix === "夕方" || jaPrefix === "夜") meridiem = "pm";
  if (merL === "am" || jaPrefix === "午前" || jaPrefix === "朝") meridiem = "am";
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (jaPrefix === "深夜" && hour < 6) hour += 24;
  if (minute >= 60 || hour > 30) return null;
  let dayOffset = 0;
  if (hour >= 24) {
    hour -= 24;
    dayOffset = 1;
  }
  return { hour, minute, dayOffset, meridiem };
}

/** 文字列中の時刻をすべて取り出す (日付部分の "2026/11/02" は ":" や "時" を含まないので拾わない) */
export function parseTimes(text: string | null | undefined): TimeParts[] {
  if (!text) return [];
  const t = normalizeText(text);
  const out: TimeParts[] = [];
  for (const m of t.matchAll(TIME_RE)) {
    const p = toTimeParts(m);
    if (p) out.push(p);
  }
  return out;
}

/** 最初の時刻 */
export function parseTime(text: string | null | undefined): TimeParts | null {
  return parseTimes(text)[0] ?? null;
}

/**
 * "18:00-21:00" / "18時〜21時" / "午後6時～9時" のような範囲表記。
 * 終了側に午前午後が無く開始が午後の場合は、終了も午後とみなす。
 */
export function parseTimeRange(text: string | null | undefined): { start: TimeParts; end: TimeParts } | null {
  const ts = parseTimes(text);
  if (ts.length < 2) return null;
  const start = ts[0]!;
  let end = ts[1]!;
  if (start.meridiem === "pm" && end.meridiem === undefined && end.hour < 12 && end.hour + 12 > start.hour) {
    end = { ...end, hour: end.hour + 12, meridiem: "pm" };
  }
  return { start, end };
}

export type EventKind = "flight" | "lodging" | "restaurant" | "medical" | "meeting" | "event" | "tour" | "other";

/** LLM が抜き出した生文字列 (schemas.ts の ExtractedEvent のうち日付解決に必要な部分) */
export interface RawWhen {
  kind: EventKind;
  date_text: string;
  start_time_text: string;
  end_date_text: string;
  end_time_text: string;
  timezone_text: string;
  end_timezone_text: string;
  location: string;
  end_location: string;
  all_day: boolean;
}

export type ResolvedWhen =
  | {
      allDay: true;
      /** YYYY-MM-DD */
      startDate: string;
      /** YYYY-MM-DD (Google Calendar と同じく排他的: 最終日の翌日) */
      endDateExclusive: string;
      /** 宿泊などで分かった時刻 (説明欄用) */
      startTimeNote?: string;
      endTimeNote?: string;
      timeZone: string;
      warnings: string[];
    }
  | {
      allDay: false;
      start: DateTime;
      end: DateTime;
      timeZone: string;
      endTimeZone: string;
      warnings: string[];
    };

export interface ResolveOptions {
  reference: DateTime;
  defaultTimezone: string;
  defaultEventMinutes: number;
}

/** 種別ごとの既定の所要時間 (終了時刻が書かれていない場合) */
const KIND_DEFAULT_MINUTES: Partial<Record<EventKind, number>> = {
  restaurant: 120,
  event: 120,
  tour: 180,
  flight: 120,
};

const fmtTime = (t: TimeParts) => `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;

/** import 循環を避けるため timezones.ts は呼び出し側から注入する */
export type TzResolver = (candidates: Array<string | null | undefined>, fallback: string) => { zone: string };

/**
 * 生文字列 → 実際の開始・終了日時。失敗時は理由付きで null 相当を返す。
 */
export function resolveWhen(
  raw: RawWhen,
  opts: ResolveOptions,
  tz: TzResolver,
): { ok: true; when: ResolvedWhen } | { ok: false; reason: string } {
  const warnings: string[] = [];
  const startDate = parseDate(raw.date_text, { reference: opts.reference });
  if (!startDate) return { ok: false, reason: `日付を解釈できません: "${raw.date_text}"` };
  warnings.push(...startDate.warnings);
  if (startDate.yearInferred) warnings.push("year_inferred");
  const startDay = DateTime.fromObject({ year: startDate.year, month: startDate.month, day: startDate.day });

  // 時刻: start_time_text → (無ければ) date_text 内の時刻
  let startTime = parseTime(raw.start_time_text) ?? parseTime(raw.date_text);
  let endTime = parseTime(raw.end_time_text);
  const range = parseTimeRange(raw.start_time_text) ?? (raw.end_time_text ? null : parseTimeRange(raw.date_text));
  if (range && !raw.end_time_text) {
    startTime = range.start;
    endTime = range.end;
  }
  // 終了日: end_date_text → end_time_text 内の日付
  const endDate =
    parseDate(raw.end_date_text, { reference: opts.reference, notBefore: startDay }) ??
    parseDate(raw.end_time_text, { reference: opts.reference, notBefore: startDay });
  if (endDate) warnings.push(...endDate.warnings);

  const startZone = tz([raw.timezone_text, raw.location], opts.defaultTimezone).zone;
  // フライトは到着地のタイムゾーンで終了時刻を解釈する。その他は開始と同じ。
  const endZone =
    raw.kind === "flight"
      ? tz([raw.end_timezone_text, raw.end_location], startZone).zone
      : tz([raw.end_timezone_text], startZone).zone;

  const endDay = endDate ? DateTime.fromObject({ year: endDate.year, month: endDate.month, day: endDate.day }) : null;

  // --- 終日 ---
  if (raw.kind === "lodging" || raw.all_day || !startTime) {
    const last = endDay && endDay >= startDay ? endDay : startDay;
    if (raw.kind === "lodging" && !endDay) warnings.push("lodging_without_checkout");
    return {
      ok: true,
      when: {
        allDay: true,
        startDate: startDay.toISODate()!,
        endDateExclusive: last.plus({ days: 1 }).toISODate()!,
        startTimeNote: startTime ? fmtTime(startTime) : undefined,
        endTimeNote: endTime ? fmtTime(endTime) : undefined,
        timeZone: startZone,
        warnings,
      },
    };
  }

  // --- 時刻指定 ---
  const start = DateTime.fromObject(
    { year: startDate.year, month: startDate.month, day: startDate.day, hour: startTime.hour, minute: startTime.minute },
    { zone: startZone },
  ).plus({ days: startTime.dayOffset });
  if (!start.isValid) return { ok: false, reason: `開始日時が不正です (${start.invalidExplanation})` };

  let end: DateTime;
  if (endTime) {
    const base = endDay ?? startDay;
    end = DateTime.fromObject(
      { year: base.year, month: base.month, day: base.day, hour: endTime.hour, minute: endTime.minute },
      { zone: endZone },
    ).plus({ days: endTime.dayOffset });
    if (!endDay && end <= start) {
      // 終了日が無く終了が開始より前 → 日跨ぎ (夜行便・深夜イベント)
      end = end.plus({ days: 1 });
      warnings.push("assumed_overnight");
    }
  } else {
    end = start.plus({ minutes: KIND_DEFAULT_MINUTES[raw.kind] ?? opts.defaultEventMinutes });
    warnings.push("end_time_defaulted");
  }
  if (!end.isValid || end <= start) {
    warnings.push("end_before_start");
    end = start.plus({ minutes: opts.defaultEventMinutes });
  }
  const hours = end.diff(start, "hours").hours;
  if (raw.kind === "flight" && hours > 30) warnings.push("flight_too_long");
  if (raw.kind !== "flight" && hours > 24) warnings.push("event_longer_than_24h");

  return { ok: true, when: { allDay: false, start, end, timeZone: startZone, endTimeZone: endZone, warnings } };
}

/** ログ・サマリ用の短い表示 */
export function describeWhen(w: ResolvedWhen): string {
  if (w.allDay) {
    const last = DateTime.fromISO(w.endDateExclusive).minus({ days: 1 }).toISODate();
    return last === w.startDate ? `${w.startDate} (終日)` : `${w.startDate}〜${last} (終日)`;
  }
  const s = w.start.toFormat("yyyy-MM-dd HH:mm");
  const e = w.end.toFormat(w.start.hasSame(w.end, "day") && w.timeZone === w.endTimeZone ? "HH:mm" : "yyyy-MM-dd HH:mm");
  const tz = w.timeZone === w.endTimeZone ? w.timeZone : `${w.timeZone} → ${w.endTimeZone}`;
  return `${s}〜${e} [${tz}]`;
}

const DATE_TOKEN_RE = new RegExp(
  [
    "(?:令和|平成)\\s*(?:\\d{1,2}|元)\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日",
    "\\d{4}\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日?",
    "(?<!\\d)\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2}(?!\\d)",
    "\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日",
    "(?<![\\d/])\\d{1,2}/\\d{1,2}(?![\\d/])",
    `(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_RE},?\\s*(?:\\d{4})?`,
    `\\b${MONTH_RE}\\s+\\d{1,2}(?:st|nd|rd|th)?(?!\\d)(?:,?\\s*\\d{4})?`,
  ].join("|"),
  "gi",
);

/** 本文中に現れる日付をすべて (月日・年) で列挙する。LLM が書式を変えて写した場合の照合用。 */
export function findDatesInText(text: string, reference: DateTime): DateParts[] {
  const t = normalizeText(text);
  const out: DateParts[] = [];
  for (const m of t.matchAll(DATE_TOKEN_RE)) {
    const d = parseDate(m[0], { reference });
    if (d) out.push(d);
  }
  return out;
}

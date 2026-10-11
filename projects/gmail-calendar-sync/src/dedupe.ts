/**
 * 重複・既存予定の検出。
 * (i)  完全一致: extendedProperties.private に保存した予約番号 / Gmail メッセージ ID / 内容ハッシュで検索
 * (ii) あいまい一致: 前後 1 日の予定を取得し、タイトル類似度・時間の重なり・場所・予約番号でスコア計算 (コード)
 *      → スコアが曖昧な候補だけ LLM に「同じ予定か?」を 1 組ずつ聞く
 */
import { createHash } from "node:crypto";
import { DateTime } from "luxon";
import { type CalEvent, type CalendarApi, PROP, eventInterval } from "./calendar.js";
import { log } from "./logger.js";

/** 比較用の正規化: NFKC・小文字化・【】などの接頭辞と記号・空白を除去 */
export function normalizeForCompare(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]/g, "")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 予約番号の正規化 (空白・ハイフン除去、大文字化) */
export function normalizeReservation(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").toUpperCase().replace(/[\s\-_#:：]/g, "");
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  if (s.length === 1) m.set(s, 1);
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 文字 bigram の Dice 係数 (0〜1)。日本語でも分かち書き不要。 */
export function diceSimilarity(a: string, b: string): number {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const bx = bigrams(x);
  const by = bigrams(y);
  let inter = 0;
  for (const [g, c] of bx) inter += Math.min(c, by.get(g) ?? 0);
  const total = [...bx.values()].reduce((p, c) => p + c, 0) + [...by.values()].reduce((p, c) => p + c, 0);
  return total === 0 ? 0 : (2 * inter) / total;
}

/** 文字 (unigram) 集合の Dice 係数。語順が違う短い日本語タイトル (「秋の日本酒会」⇔「日本酒の会」) 向け。 */
export function charSetSimilarity(a: string, b: string): number {
  const x = new Set(normalizeForCompare(a));
  const y = new Set(normalizeForCompare(b));
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const c of x) if (y.has(c)) inter++;
  return (2 * inter) / (x.size + y.size);
}

/**
 * タイトル類似度。bigram Dice と (割り引いた) 文字集合 Dice の大きい方。
 * 片方がもう片方を含む (4 文字以上) 場合は高めに評価。
 */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeForCompare(a);
  const y = normalizeForCompare(b);
  if (!x || !y) return 0;
  const dice = Math.max(diceSimilarity(x, y), charSetSimilarity(x, y) * 0.8);
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (shorter.length >= 4 && longer.includes(shorter)) return Math.max(dice, 0.9);
  return dice;
}

export interface Interval {
  start: number;
  end: number;
}

/** 時間の近さ (0〜1): 重なり率、開始時刻の一致、1 日以内の近さ */
export function timeScore(a: Interval, b: Interval): number {
  const lenA = Math.max(a.end - a.start, 60_000);
  const lenB = Math.max(b.end - b.start, 60_000);
  const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const overlapRatio = overlap / Math.min(lenA, lenB);
  const deltaH = Math.abs(a.start - b.start) / 3_600_000;
  const sameStart = deltaH <= 0.25 ? 1 : 0;
  const near = Math.max(0, 1 - deltaH / 24) * 0.5;
  return Math.min(1, Math.max(overlapRatio, sameStart, near));
}

export interface CompareTarget {
  title: string;
  interval: Interval;
  location: string;
  /** 正規化済み予約番号 (無ければ "") */
  reservation: string;
}

export interface CandidateScore {
  score: number;
  title: number;
  time: number;
  location: number | null;
  reservation: "match" | "conflict" | "unknown";
}

/** 抽出した予定 (planned) と既存予定 (existing) の類似度スコア */
export function scoreCandidate(planned: CompareTarget, existing: CalEvent, defaultTz = "Asia/Tokyo"): CandidateScore {
  const exInterval = eventInterval(existing, defaultTz);
  const title = titleSimilarity(planned.title, existing.summary ?? "");
  const time = exInterval ? timeScore(planned.interval, exInterval) : 0;
  const location =
    planned.location && existing.location ? diceSimilarity(planned.location, existing.location) : null;

  let reservation: CandidateScore["reservation"] = "unknown";
  const exRes = normalizeReservation(existing.extendedProperties?.private?.[PROP.reservation]);
  if (planned.reservation) {
    if (exRes && exRes === planned.reservation) reservation = "match";
    else if (exRes && exRes !== planned.reservation) reservation = "conflict";
    else if (normalizeReservation(`${existing.summary ?? ""} ${existing.description ?? ""}`).includes(planned.reservation))
      reservation = "match";
  }

  let score: number;
  if (location === null) score = (title * 0.5 + time * 0.5);
  else score = title * 0.4 + time * 0.4 + location * 0.2;
  if (reservation === "match") score = Math.max(score, 0.95);
  if (reservation === "conflict") score *= 0.3;
  return { score: Math.round(score * 1000) / 1000, title, time, location, reservation };
}

export const MATCH_THRESHOLD = 0.8;
export const AMBIGUOUS_THRESHOLD = 0.45;

export type MatchDecision = "match" | "ambiguous" | "none";
export function decide(score: number): MatchDecision {
  if (score >= MATCH_THRESHOLD) return "match";
  if (score >= AMBIGUOUS_THRESHOLD) return "ambiguous";
  return "none";
}

/** 内容ハッシュ (同じメール内容の再処理・同内容のリマインドメールを検出) */
export function contentHash(parts: { title: string; start: string; end: string; location: string }): string {
  const s = [normalizeForCompare(parts.title), parts.start, parts.end, normalizeForCompare(parts.location)].join("|");
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export interface ExistingMatch {
  event: CalEvent;
  calendarId: string;
  how: "reservation" | "message" | "hash" | "fuzzy" | "llm";
  score: number;
}

export interface FindExistingInput extends CompareTarget {
  kind: string;
  segment: string;
  gmailId: string;
  hash: string;
  isChange: boolean;
}

export type SameEventJudge = (planned: CompareTarget, existing: CalEvent, isChange: boolean) => Promise<boolean>;

/**
 * 既存予定を探す。見つからなければ null。
 */
export async function findExisting(
  input: FindExistingInput,
  api: CalendarApi,
  calendarIds: string[],
  judge: SameEventJudge | null,
  defaultTz: string,
): Promise<ExistingMatch | null> {
  // (i) 完全一致
  for (const calendarId of calendarIds) {
    if (input.reservation) {
      const hits = await api.findByPrivate(calendarId, { [PROP.reservation]: input.reservation });
      const sameKind = hits.filter((e) => e.extendedProperties?.private?.[PROP.kind] === input.kind);
      const pool = sameKind.length > 0 ? sameKind : hits;
      const sameSeg = pool.find((e) => e.extendedProperties?.private?.[PROP.segment] === input.segment);
      // 予約番号が同じでも区間 (往路/復路など) が違う予定はスコアで選ぶ
      const best = sameSeg ?? (pool.length === 1 ? pool[0] : bestByScore(input, pool, defaultTz));
      if (best) return { event: best, calendarId, how: "reservation", score: 1 };
    }
    const byMsg = await api.findByPrivate(calendarId, { [PROP.messageId]: input.gmailId, [PROP.segment]: input.segment });
    if (byMsg[0]) return { event: byMsg[0], calendarId, how: "message", score: 1 };
    const byHash = await api.findByPrivate(calendarId, { [PROP.hash]: input.hash });
    if (byHash[0]) return { event: byHash[0], calendarId, how: "hash", score: 1 };
  }

  // (ii) あいまい一致: 前後 1 日
  const timeMin = DateTime.fromMillis(input.interval.start).minus({ days: 1 }).toISO()!;
  const timeMax = DateTime.fromMillis(input.interval.end).plus({ days: 1 }).toISO()!;
  const scored: Array<{ ev: CalEvent; calendarId: string; s: CandidateScore }> = [];
  for (const calendarId of calendarIds) {
    for (const ev of await api.listWindow(calendarId, timeMin, timeMax)) {
      if (ev.status === "cancelled") continue;
      scored.push({ ev, calendarId, s: scoreCandidate(input, ev, defaultTz) });
    }
  }
  scored.sort((a, b) => b.s.score - a.s.score);
  for (const c of scored.slice(0, 5)) {
    log.debug(`候補 "${c.ev.summary}" score=${c.s.score}`, c.s);
  }
  const top = scored[0];
  if (top && decide(top.s.score) === "match") {
    return { event: top.ev, calendarId: top.calendarId, how: "fuzzy", score: top.s.score };
  }
  if (judge) {
    for (const c of scored.filter((x) => decide(x.s.score) === "ambiguous").slice(0, 3)) {
      if (await judge(input, c.ev, input.isChange)) {
        return { event: c.ev, calendarId: c.calendarId, how: "llm", score: c.s.score };
      }
    }
  }
  return null;
}

function bestByScore(input: CompareTarget, pool: CalEvent[], tz: string): CalEvent | undefined {
  let best: CalEvent | undefined;
  let bestScore = -1;
  for (const e of pool) {
    const s = scoreCandidate(input, e, tz).score;
    if (s > bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return bestScore >= AMBIGUOUS_THRESHOLD ? best : undefined;
}

/**
 * LLM 出力のスキーマ (zod)。
 * 同じ定義から JSON Schema を生成して Ollama の `format` に渡す (構造化出力 = 文法制約付き生成)。
 *
 * 小さいモデル向けの工夫:
 * - 「無い値」は null ではなく空文字 "" に統一 (全キー必須 → 毎回同じ形を出力させる)
 * - reason を先頭に置き、短い根拠を書いてから結論を出させる (キー順はスキーマ順に生成される)
 * - 日付は解釈させず、本文の文字列をそのままコピーさせる (*_text)
 */
import { z } from "zod";

export const CLASSIFY_KINDS = [
  "reservation",
  "event",
  "appointment",
  "meeting",
  "travel_flight",
  "travel_lodging",
  "cancellation",
  "change",
  "not_schedule",
] as const;

export const ClassifySchema = z.object({
  reason: z.string().max(300).describe("判断理由を日本語で 1 文"),
  kind: z.enum(CLASSIFY_KINDS),
  confidence: z.number().min(0).max(1).describe("0〜1"),
});
export type Classification = z.infer<typeof ClassifySchema>;

export const EVENT_KINDS = ["flight", "lodging", "restaurant", "medical", "meeting", "event", "tour", "other"] as const;
export const EVENT_STATUSES = ["confirmed", "tentative", "changed", "cancelled"] as const;

export const ExtractedEventSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  status: z.enum(EVENT_STATUSES),
  title: z.string().max(120).describe("カレンダーの予定名の案 (短く)"),
  date_text: z.string().describe("開始日 (宿泊はチェックイン日、フライトは出発日) を本文からそのままコピー"),
  start_time_text: z.string().describe("開始時刻を本文からそのままコピー。無ければ空文字"),
  end_date_text: z.string().describe("終了日 (チェックアウト日・到着日) を本文からそのままコピー。無ければ空文字"),
  end_time_text: z.string().describe("終了時刻 (チェックアウト時刻・到着時刻) を本文からそのままコピー。無ければ空文字"),
  timezone_text: z.string().describe("開始側のタイムゾーンの手がかり (例: 現地時間, GMT+7, 日本時間) をそのままコピー。無ければ空文字"),
  end_timezone_text: z.string().describe("終了側(到着地)のタイムゾーンの手がかり。無ければ空文字"),
  location: z.string().describe("場所・施設名・住所 (フライトは出発空港)。無ければ空文字"),
  end_location: z.string().describe("フライトの到着空港。それ以外は空文字"),
  reservation_number: z.string().describe("予約番号・確認番号をそのままコピー。無ければ空文字"),
  contact: z.string().describe("電話番号やメールなどの連絡先。無ければ空文字"),
  all_day: z.boolean(),
  notes: z.string().max(300).describe("人数・座席・持ち物など補足。無ければ空文字"),
  source_quote: z.string().max(400).describe("根拠となる本文の一節をそのままコピー"),
});
export type ExtractedEvent = z.infer<typeof ExtractedEventSchema>;

export const ExtractSchema = z.object({
  events: z.array(ExtractedEventSchema).max(8),
});
export type Extraction = z.infer<typeof ExtractSchema>;

export const VerifySchema = z.object({
  issues: z
    .array(
      z.object({
        event_index: z.number().int().min(0),
        field: z.string(),
        problem: z.string().max(200),
      }),
    )
    .max(20),
  ok: z.boolean(),
});
export type Verification = z.infer<typeof VerifySchema>;

export const SameEventSchema = z.object({
  reason: z.string().max(300),
  same: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type SameEventJudgement = z.infer<typeof SameEventSchema>;

/** zod → Ollama の format に渡す JSON Schema ($schema キーは除去) */
export function toOllamaFormat(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

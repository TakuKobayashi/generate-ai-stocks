/**
 * 設定の読み込み。
 * すべて環境変数 (ローカルでは .env、GitHub Actions では secrets / vars) から取得し、zod で検証する。
 */
import "dotenv/config";
import { z } from "zod";

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === "") return def;
      return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
    });

const num = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : Number(v)))
    .pipe(z.number().finite());

const str = (def: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : v.trim()));

export const DEFAULT_GMAIL_QUERY =
  "newer_than:14d -category:promotions -category:social " +
  "(予約 OR 確認 OR チケット OR 予約番号 OR 搭乗 OR 宿泊 OR 診察 OR 受診 OR 招待 OR " +
  "booking OR confirmation OR itinerary OR reservation OR ticket OR invitation)";

const EnvSchema = z.object({
  GOOGLE_CLIENT_ID: str(""),
  GOOGLE_CLIENT_SECRET: str(""),
  GOOGLE_REFRESH_TOKEN: str(""),

  DRY_RUN: bool(false),
  MOCK_GOOGLE: bool(false),
  MOCK_SAMPLES_DIR: str("samples"),

  GMAIL_QUERY: str(DEFAULT_GMAIL_QUERY),
  PROCESSED_LABEL: str("calendar-sync/processed"),
  REVIEW_LABEL: str("calendar-sync/needs-review"),
  MAX_MESSAGES: num(10),

  CALENDAR_ID: str("primary"),
  REVIEW_CALENDAR_ID: str(""),
  DEFAULT_TIMEZONE: str("Asia/Tokyo"),
  LODGING_MODE: str("span").pipe(z.enum(["span", "separate"])),
  CANCEL_MODE: str("mark").pipe(z.enum(["mark", "delete"])),
  MIN_CONFIDENCE: num(0.6),
  DEFAULT_EVENT_MINUTES: num(60),

  OLLAMA_HOST: str("http://127.0.0.1:11434"),
  MODEL: str("qwen2.5:7b-instruct"),
  NUM_CTX: num(8192),
  LLM_TIMEOUT_MS: num(900_000),
  SELF_CHECK: str("auto").pipe(z.enum(["auto", "always", "never"])),
  MAX_BODY_CHARS: num(6000),

  LOG_LEVEL: str("info").pipe(z.enum(["debug", "info", "warn", "error"])),
  REDACT_LOGS: bool(false),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`設定 (環境変数) が不正です:\n${msg}`);
  }
  const e = parsed.data;
  return {
    google: {
      clientId: e.GOOGLE_CLIENT_ID,
      clientSecret: e.GOOGLE_CLIENT_SECRET,
      refreshToken: e.GOOGLE_REFRESH_TOKEN,
    },
    dryRun: e.DRY_RUN,
    mockGoogle: e.MOCK_GOOGLE,
    mockSamplesDir: e.MOCK_SAMPLES_DIR,
    gmail: {
      query: e.GMAIL_QUERY,
      processedLabel: e.PROCESSED_LABEL,
      reviewLabel: e.REVIEW_LABEL,
      maxMessages: Math.max(1, Math.floor(e.MAX_MESSAGES)),
    },
    calendar: {
      calendarId: e.CALENDAR_ID,
      reviewCalendarId: e.REVIEW_CALENDAR_ID || null,
      defaultTimezone: e.DEFAULT_TIMEZONE,
      lodgingMode: e.LODGING_MODE,
      cancelMode: e.CANCEL_MODE,
      minConfidence: e.MIN_CONFIDENCE,
      defaultEventMinutes: e.DEFAULT_EVENT_MINUTES,
    },
    llm: {
      host: e.OLLAMA_HOST.replace(/\/+$/, ""),
      model: e.MODEL,
      numCtx: e.NUM_CTX,
      timeoutMs: e.LLM_TIMEOUT_MS,
      selfCheck: e.SELF_CHECK,
      maxBodyChars: e.MAX_BODY_CHARS,
    },
    log: {
      level: e.LOG_LEVEL,
      redact: e.REDACT_LOGS,
    },
  };
}

/** Google API を実際に使う場合に必要な認証情報が揃っているか確認する */
export function assertGoogleCredentials(cfg: AppConfig): void {
  const missing = Object.entries({
    GOOGLE_CLIENT_ID: cfg.google.clientId,
    GOOGLE_CLIENT_SECRET: cfg.google.clientSecret,
    GOOGLE_REFRESH_TOKEN: cfg.google.refreshToken,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(
      `Google の認証情報が不足しています: ${missing.join(", ")}\n` +
        "README の「セットアップ」を参照し、npm run get-token でリフレッシュトークンを取得してください。",
    );
  }
}

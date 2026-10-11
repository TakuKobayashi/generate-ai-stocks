/**
 * シンプルなロガーと、GitHub Actions の Step Summary ($GITHUB_STEP_SUMMARY) 出力。
 */
import { appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let currentLevel: Level = "info";
let redactEnabled = false;

export function configureLogger(opts: { level: Level; redact: boolean }): void {
  currentLevel = opts.level;
  redactEnabled = opts.redact;
}

function emit(level: Level, msg: string, extra?: unknown): void {
  if (ORDER[level] < ORDER[currentLevel]) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  const out = level === "error" || level === "warn" ? console.error : console.log;
  if (extra !== undefined) {
    out(line, typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
  } else {
    out(line);
  }
}

export const log = {
  debug: (m: string, e?: unknown) => emit("debug", m, e),
  info: (m: string, e?: unknown) => emit("info", m, e),
  warn: (m: string, e?: unknown) => emit("warn", m, e),
  error: (m: string, e?: unknown) => emit("error", m, e),
  /** GitHub Actions のログをグループ化 (折りたたみ) する */
  group: (title: string) => {
    if (process.env.GITHUB_ACTIONS) console.log(`::group::${title}`);
    else console.log(`\n=== ${title} ===`);
  },
  groupEnd: () => {
    if (process.env.GITHUB_ACTIONS) console.log("::endgroup::");
  },
};

/** 件名・差出人などの個人情報をログに出す前に伏せ字にする (REDACT_LOGS=true の時のみ) */
export function redact(s: string | undefined | null): string {
  const v = s ?? "";
  if (!redactEnabled || v === "") return v;
  return `<redacted:${createHash("sha256").update(v).digest("hex").slice(0, 8)}>`;
}

export interface SummaryRow {
  subject: string;
  kind: string;
  action: string;
  title: string;
  when: string;
  note: string;
}

/** 実行結果を集計し、最後に Markdown 表として出力する */
export class RunSummary {
  readonly rows: SummaryRow[] = [];
  readonly counters = {
    scanned: 0,
    skipped: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    duplicates: 0,
    review: 0,
    errors: 0,
  };

  add(row: SummaryRow): void {
    this.rows.push(row);
  }

  toMarkdown(meta: { dryRun: boolean; model: string; elapsedSec: number }): string {
    const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const c = this.counters;
    const lines = [
      `## 📅 gmail-calendar-sync ${meta.dryRun ? "(DRY RUN — 書き込みなし)" : ""}`,
      "",
      `モデル: \`${meta.model}\` / 所要時間: ${meta.elapsedSec.toFixed(0)} 秒`,
      "",
      `| 走査 | スキップ | 作成 | 更新 | キャンセル | 重複 | 要確認 | エラー |`,
      `|---:|---:|---:|---:|---:|---:|---:|---:|`,
      `| ${c.scanned} | ${c.skipped} | ${c.created} | ${c.updated} | ${c.cancelled} | ${c.duplicates} | ${c.review} | ${c.errors} |`,
      "",
    ];
    if (this.rows.length > 0) {
      lines.push("| 件名 | 分類 | アクション | 予定 | 日時 | 備考 |", "|---|---|---|---|---|---|");
      for (const r of this.rows) {
        lines.push(
          `| ${esc(redact(r.subject))} | ${esc(r.kind)} | ${esc(r.action)} | ${esc(redact(r.title))} | ${esc(r.when)} | ${esc(r.note)} |`,
        );
      }
    }
    return lines.join("\n") + "\n";
  }

  write(meta: { dryRun: boolean; model: string; elapsedSec: number }): void {
    const md = this.toMarkdown(meta);
    console.log("\n" + md);
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file) {
      try {
        appendFileSync(file, md, "utf8");
      } catch (err) {
        log.warn("GITHUB_STEP_SUMMARY への書き込みに失敗しました", String(err));
      }
    }
  }
}

/** $GITHUB_OUTPUT に key=value を書く (ワークフローの後続ステップの条件分岐用) */
export function setActionOutput(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${key}=${value}\n`, "utf8");
}

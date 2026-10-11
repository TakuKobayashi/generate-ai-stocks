/**
 * エントリポイント。
 *   npx tsx src/main.ts               … 通常実行
 *   npx tsx src/main.ts --count-only  … 処理対象メールの件数だけ数えて $GITHUB_OUTPUT に書く
 *                                       (ワークフローで「メールが無ければ Ollama を起動しない」ための前段チェック)
 */
import { assertGoogleCredentials, loadConfig } from "./config.js";
import { DryRunCalendarApi, GoogleCalendarApi, MemoryCalendarApi, summarizeEvent, type CalendarApi } from "./calendar.js";
import { buildQuery, createGoogleAuth, DryRunMailSource, FileMailSource, GoogleMailSource, type MailSource } from "./gmail.js";
import { OllamaClient } from "./llm/ollama.js";
import { configureLogger, log, RunSummary, setActionOutput } from "./logger.js";
import { processMessage } from "./pipeline.js";

async function main(): Promise<number> {
  const started = Date.now();
  const cfg = loadConfig();
  configureLogger(cfg.log);
  const countOnly = process.argv.includes("--count-only");

  // --- クライアント構築 ---
  let mail: MailSource;
  let cal: CalendarApi;
  let memCal: MemoryCalendarApi | null = null;
  if (cfg.mockGoogle) {
    log.info(`MOCK_GOOGLE: ${cfg.mockSamplesDir}/*.eml を読み、メモリ上のカレンダーに登録します`);
    mail = new FileMailSource(cfg.mockSamplesDir);
    memCal = new MemoryCalendarApi();
    cal = memCal;
  } else {
    assertGoogleCredentials(cfg);
    const auth = createGoogleAuth(cfg.google.clientId, cfg.google.clientSecret, cfg.google.refreshToken);
    mail = new GoogleMailSource(auth);
    cal = new GoogleCalendarApi(auth);
  }
  if (cfg.dryRun) {
    log.info("DRY_RUN: Gmail ラベル付与・カレンダー書き込みは行いません");
    mail = new DryRunMailSource(mail);
    cal = new DryRunCalendarApi(cal);
  }

  const query = buildQuery(cfg.gmail.query, cfg.gmail.processedLabel);
  log.info(`Gmail 検索: ${query}`);
  const refs = await mail.search(query, cfg.gmail.maxMessages);
  log.info(`対象メール: ${refs.length} 件 (上限 ${cfg.gmail.maxMessages})`);

  if (countOnly) {
    setActionOutput("count", String(refs.length));
    setActionOutput("has_mail", refs.length > 0 ? "true" : "false");
    return 0;
  }

  const summary = new RunSummary();
  if (refs.length > 0) {
    const llm = new OllamaClient({
      host: cfg.llm.host,
      model: cfg.llm.model,
      numCtx: cfg.llm.numCtx,
      timeoutMs: cfg.llm.timeoutMs,
    });
    await llm.ensureReady();
    const labels = {
      processed: await mail.ensureLabel(cfg.gmail.processedLabel),
      review: await mail.ensureLabel(cfg.gmail.reviewLabel),
    };
    for (const ref of refs) {
      try {
        await processMessage(ref.id, { cfg, mail, cal, llm, summary, labels });
      } catch (err) {
        // 失敗したメールには処理済みラベルを付けない → 次回の実行で再試行される
        summary.counters.errors++;
        summary.add({ subject: ref.id, kind: "-", action: "エラー", title: "", when: "", note: String(err).slice(0, 200) });
        log.error(`メール ${ref.id} の処理に失敗しました`, err instanceof Error ? err.stack : String(err));
      }
    }
    log.info(
      `LLM 統計: ${llm.stats.calls} 回 / prompt ${llm.stats.promptTokens} tok / 出力 ${llm.stats.outputTokens} tok / ` +
        `${(llm.stats.totalMs / 1000).toFixed(0)} 秒 / 再試行 ${llm.stats.retries} 回`,
    );
  }

  if (memCal) {
    log.group("モックカレンダーの内容");
    for (const [calId, evs] of memCal.events) {
      for (const ev of evs) log.info(`[${calId}]`, summarizeEvent(ev));
    }
    log.groupEnd();
  }

  summary.write({ dryRun: cfg.dryRun, model: cfg.llm.model, elapsedSec: (Date.now() - started) / 1000 });
  return summary.counters.errors > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    log.error("致命的なエラー", err instanceof Error ? err.stack : String(err));
    process.exit(1);
  });

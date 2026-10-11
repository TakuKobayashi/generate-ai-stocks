/**
 * パイプライン全体のテスト。LLM は偽物 (決め打ちの応答)、Gmail は samples/*.eml、カレンダーはメモリ上。
 * 「作成 → 変更メールで更新 → 再処理で重複スキップ → キャンセル」の流れを確認する。
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryCalendarApi } from "../src/calendar.js";
import { loadConfig } from "../src/config.js";
import { FileMailSource } from "../src/gmail.js";
import { configureLogger, RunSummary } from "../src/logger.js";
import type { OllamaClient } from "../src/llm/ollama.js";
import type { Classification, ExtractedEvent, Extraction } from "../src/llm/schemas.js";
import { processMessage, type PipelineDeps } from "../src/pipeline.js";

configureLogger({ level: "error", redact: false });

const ev = (p: Partial<ExtractedEvent> & Pick<ExtractedEvent, "kind" | "title" | "date_text">): ExtractedEvent => ({
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

type Script = { classify: Classification; extract: Extraction };

/** label ごとに決め打ちの応答を返す偽 LLM */
function fakeLlm(script: () => Script): OllamaClient {
  const calls: string[] = [];
  return {
    model: "fake",
    stats: { calls: 0, promptTokens: 0, outputTokens: 0, totalMs: 0, retries: 0 },
    calls,
    async ensureReady() {},
    async chatJson(_schema: unknown, _messages: unknown, opts: { label?: string } = {}) {
      calls.push(opts.label ?? "");
      const s = script();
      if (opts.label === "classify") return s.classify;
      if (opts.label === "extract") return s.extract;
      if (opts.label === "verify") return { issues: [], ok: true };
      if (opts.label === "same-event") return { reason: "", same: false, confidence: 0.9 };
      throw new Error(`unexpected ${opts.label}`);
    },
  } as unknown as OllamaClient;
}

const hotel = (date: string, out: string, status: ExtractedEvent["status"] = "confirmed"): Extraction => ({
  events: [
    ev({
      kind: "lodging",
      status,
      title: "Hotel Am Stephansplatz",
      date_text: date,
      start_time_text: "15:00以降",
      end_date_text: out,
      end_time_text: "11:00まで",
      timezone_text: "現地時間",
      location: "Hotel Am Stephansplatz",
      reservation_number: "1128899001234",
      all_day: true,
    }),
  ],
});

function deps(llm: OllamaClient, cal: MemoryCalendarApi, mail: FileMailSource): PipelineDeps {
  const cfg = loadConfig({ MODEL: "fake", SELF_CHECK: "never" } as NodeJS.ProcessEnv);
  return { cfg, mail, cal, llm, summary: new RunSummary(), labels: { processed: "P", review: "R" } };
}

describe("processMessage", () => {
  const mail = new FileMailSource(path.join(__dirname, "..", "samples"));

  it("ホテル予約 → 作成、変更メール → 更新、再処理 → 重複", async () => {
    const cal = new MemoryCalendarApi();
    let script: Script = {
      classify: { reason: "", kind: "travel_lodging", confidence: 0.95 },
      extract: hotel("2026年11月21日(土)", "2026年11月24日(火)"),
    };
    const d = deps(fakeLlm(() => script), cal, mail);

    await processMessage("02-tripcom-hotel.eml", d);
    let events = cal.events.get("primary")!;
    expect(events).toHaveLength(1);
    expect(events[0]!.start).toEqual({ date: "2026-11-21" });
    expect(events[0]!.end).toEqual({ date: "2026-11-25" });
    expect(mail.appliedLabels.get("02-tripcom-hotel.eml")).toEqual(["P"]);

    // 同じメールの再処理 → 重複
    await processMessage("02-tripcom-hotel.eml", d);
    expect(cal.events.get("primary")).toHaveLength(1);
    expect(d.summary.counters.duplicates).toBe(1);

    // 変更メール (同じ予約番号) → 既存の予定を更新
    script = { classify: { reason: "", kind: "change", confidence: 0.9 }, extract: hotel("2026年11月22日(日)", "2026年11月24日(火)", "changed") };
    await processMessage("08-tripcom-hotel-change.eml", d);
    events = cal.events.get("primary")!;
    expect(events).toHaveLength(1);
    expect(events[0]!.start).toEqual({ date: "2026-11-22" });
    expect(events[0]!.description).toContain("🔁 更新");
    expect(d.summary.counters).toMatchObject({ created: 1, updated: 1, duplicates: 1 });
  });

  it("キャンセル → タイトルに【キャンセル】(削除しない)", async () => {
    const cal = new MemoryCalendarApi();
    let script: Script = {
      classify: { reason: "", kind: "event", confidence: 0.9 },
      extract: {
        events: [ev({ kind: "event", title: "秋の日本酒会", date_text: "11月7日（土）", start_time_text: "18:00", end_time_text: "21:00", reservation_number: "SK-1107-042", location: "日本橋 酒蔵ダイニング「蔵」 2F" })],
      },
    };
    const d = deps(fakeLlm(() => script), cal, mail);
    await processMessage("05-sake-forwarded.eml", d);
    const created = cal.events.get("primary")![0]!;
    expect(created.start?.dateTime).toBe("2026-11-07T18:00:00+09:00");
    expect(created.end?.dateTime).toBe("2026-11-07T21:00:00+09:00");

    script = { ...script, classify: { reason: "", kind: "cancellation", confidence: 0.9 } };
    await processMessage("05-sake-forwarded.eml", d);
    expect(cal.events.get("primary")![0]!.summary).toBe("【キャンセル】秋の日本酒会");
    expect(d.summary.counters.cancelled).toBe(1);
  });

  it("日付の無いメルマガは LLM を呼ばずにスキップ", async () => {
    const cal = new MemoryCalendarApi();
    const llm = fakeLlm(() => {
      throw new Error("should not be called");
    });
    const d = deps(llm, cal, mail);
    await processMessage("07-newsletter.eml", d);
    expect(d.summary.counters.skipped).toBe(1);
    expect((llm as unknown as { calls: string[] }).calls).toEqual([]);
  });

  it("幻覚した日付 → 未登録 + needs-review ラベル", async () => {
    const cal = new MemoryCalendarApi();
    const d = deps(
      fakeLlm(() => ({
        classify: { reason: "", kind: "appointment", confidence: 0.9 },
        extract: { events: [ev({ kind: "medical", title: "内科", date_text: "2026年12月24日", start_time_text: "午前9時30分" })] },
      })),
      cal,
      mail,
    );
    await processMessage("06-clinic.eml", d);
    expect(cal.events.get("primary") ?? []).toHaveLength(0);
    expect(mail.appliedLabels.get("06-clinic.eml")).toEqual(["P", "R"]);
  });
});

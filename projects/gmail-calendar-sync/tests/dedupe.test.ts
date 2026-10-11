import { describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { MemoryCalendarApi, PROP, type CalEvent } from "../src/calendar.js";
import {
  contentHash,
  decide,
  diceSimilarity,
  findExisting,
  normalizeForCompare,
  normalizeReservation,
  scoreCandidate,
  timeScore,
  titleSimilarity,
  type FindExistingInput,
} from "../src/dedupe.js";

const ms = (iso: string) => DateTime.fromISO(iso, { zone: "Asia/Tokyo" }).toMillis();
const timed = (summary: string, s: string, e: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  summary,
  start: { dateTime: DateTime.fromISO(s, { zone: "Asia/Tokyo" }).toISO()!, timeZone: "Asia/Tokyo" },
  end: { dateTime: DateTime.fromISO(e, { zone: "Asia/Tokyo" }).toISO()!, timeZone: "Asia/Tokyo" },
  ...extra,
});

describe("正規化と類似度", () => {
  it("normalizeForCompare は接頭辞・記号・全角を除去", () => {
    expect(normalizeForCompare("【要確認】ＧＫ１１ 成田→札幌")).toBe("gk11成田札幌");
  });
  it("normalizeReservation", () => {
    expect(normalizeReservation(" sk-1107-042 ")).toBe("SK1107042");
  });
  it("Dice 係数", () => {
    expect(diceSimilarity("秋の日本酒会", "秋の日本酒会")).toBe(1);
    expect(diceSimilarity("秋の日本酒会", "日本酒会 (秋)")).toBeGreaterThan(0.6);
    expect(diceSimilarity("秋の日本酒会", "歯医者")).toBe(0);
  });
  it("包含関係は高評価", () => {
    expect(titleSimilarity("日本酒会", "【ご案内】秋の日本酒会 11/7")).toBeGreaterThanOrEqual(0.9);
  });
});

describe("timeScore", () => {
  it("同じ時間帯 = 1", () => {
    expect(timeScore({ start: ms("2026-11-07T18:00"), end: ms("2026-11-07T21:00") }, { start: ms("2026-11-07T18:00"), end: ms("2026-11-07T20:00") })).toBe(1);
  });
  it("半日ずれ = 低め", () => {
    const s = timeScore({ start: ms("2026-11-07T08:00"), end: ms("2026-11-07T09:00") }, { start: ms("2026-11-07T20:00"), end: ms("2026-11-07T21:00") });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.3);
  });
});

describe("scoreCandidate", () => {
  const planned = {
    title: "秋の日本酒会",
    interval: { start: ms("2026-11-07T18:00"), end: ms("2026-11-07T21:00") },
    location: "日本橋 酒蔵ダイニング「蔵」 2F",
    reservation: "SK1107042",
  };

  it("手入力の同じ予定 (タイトル少し違い・同時刻) → match", () => {
    const s = scoreCandidate(planned, timed("日本酒会", "2026-11-07T18:00", "2026-11-07T21:00", { location: "日本橋 蔵" }));
    expect(decide(s.score)).toBe("match");
  });

  it("同時刻の別の予定 → none", () => {
    const s = scoreCandidate(planned, timed("歯医者", "2026-11-07T18:00", "2026-11-07T19:00"));
    expect(decide(s.score)).not.toBe("match");
    expect(s.title).toBe(0);
  });

  it("タイトルが似ていて時刻がずれる → ambiguous (LLM に確認)", () => {
    const s = scoreCandidate(planned, timed("日本酒の会", "2026-11-07T12:00", "2026-11-07T13:00"));
    expect(decide(s.score)).toBe("ambiguous");
  });

  it("予約番号一致は強い一致", () => {
    const s = scoreCandidate(planned, timed("飲み会", "2026-11-08T19:00", "2026-11-08T21:00", {
      extendedProperties: { private: { [PROP.reservation]: "SK1107042" } },
    }));
    expect(s.reservation).toBe("match");
    expect(decide(s.score)).toBe("match");
  });

  it("説明欄に予約番号があれば一致", () => {
    const s = scoreCandidate(planned, timed("飲み会", "2026-11-07T19:00", "2026-11-07T21:00", { description: "受付番号 SK-1107-042" }));
    expect(s.reservation).toBe("match");
  });

  it("予約番号が異なる → 減点", () => {
    const s = scoreCandidate(planned, timed("秋の日本酒会", "2026-11-07T18:00", "2026-11-07T21:00", {
      extendedProperties: { private: { [PROP.reservation]: "OTHER1" } },
    }));
    expect(s.reservation).toBe("conflict");
    expect(decide(s.score)).toBe("none");
  });

  it("終日予定 (宿泊) 同士", () => {
    const p = {
      title: "Hotel Am Stephansplatz 宿泊",
      interval: { start: DateTime.fromISO("2026-11-21", { zone: "Europe/Vienna" }).toMillis(), end: DateTime.fromISO("2026-11-25", { zone: "Europe/Vienna" }).toMillis() },
      location: "",
      reservation: "",
    };
    const s = scoreCandidate(p, { summary: "ウィーン Hotel Am Stephansplatz", start: { date: "2026-11-21" }, end: { date: "2026-11-25" } }, "Europe/Vienna");
    expect(decide(s.score)).toBe("match");
  });
});

describe("contentHash", () => {
  it("表記揺れに強く、内容が変われば変わる", () => {
    const a = contentHash({ title: "GK11 成田→札幌", start: "2026-11-02T07:30", end: "2026-11-02T09:10", location: "成田" });
    const b = contentHash({ title: "ＧＫ１１　成田→札幌", start: "2026-11-02T07:30", end: "2026-11-02T09:10", location: "成田" });
    const c = contentHash({ title: "GK11 成田→札幌", start: "2026-11-03T07:30", end: "2026-11-03T09:10", location: "成田" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("findExisting (メモリカレンダー)", () => {
  const base: FindExistingInput = {
    title: "秋の日本酒会",
    interval: { start: ms("2026-11-07T18:00"), end: ms("2026-11-07T21:00") },
    location: "",
    reservation: "",
    kind: "event",
    segment: "event-0",
    gmailId: "msg-1",
    hash: "h1",
    isChange: false,
  };

  it("予約番号 (extendedProperties) で完全一致", async () => {
    const cal = new MemoryCalendarApi();
    await cal.insert("primary", timed("別名の予定", "2026-12-01T10:00", "2026-12-01T11:00", {
      extendedProperties: { private: { [PROP.reservation]: "R1", [PROP.kind]: "event", [PROP.segment]: "event-0" } },
    }));
    const m = await findExisting({ ...base, reservation: "R1" }, cal, ["primary"], null, "Asia/Tokyo");
    expect(m?.how).toBe("reservation");
  });

  it("同じメールの再処理は messageId で一致", async () => {
    const cal = new MemoryCalendarApi();
    await cal.insert("primary", timed("x", "2026-12-01T10:00", "2026-12-01T11:00", {
      extendedProperties: { private: { [PROP.messageId]: "msg-1", [PROP.segment]: "event-0" } },
    }));
    expect((await findExisting(base, cal, ["primary"], null, "Asia/Tokyo"))?.how).toBe("message");
  });

  it("あいまい一致 (前後 1 日の予定からスコア)", async () => {
    const cal = new MemoryCalendarApi();
    await cal.insert("primary", timed("日本酒会", "2026-11-07T18:00", "2026-11-07T21:00"));
    await cal.insert("primary", timed("歯医者", "2026-11-07T10:00", "2026-11-07T11:00"));
    const m = await findExisting(base, cal, ["primary"], null, "Asia/Tokyo");
    expect(m?.how).toBe("fuzzy");
    expect(m?.event.summary).toBe("日本酒会");
  });

  it("曖昧な候補だけ LLM に聞く (1 組ずつ)", async () => {
    const cal = new MemoryCalendarApi();
    await cal.insert("primary", timed("日本酒の会", "2026-11-07T12:00", "2026-11-07T13:00"));
    await cal.insert("primary", timed("散髪", "2026-11-07T12:00", "2026-11-07T13:00"));
    const judge = vi.fn().mockResolvedValue(true);
    const m = await findExisting(base, cal, ["primary"], judge, "Asia/Tokyo");
    expect(judge).toHaveBeenCalledTimes(1);
    expect(m?.how).toBe("llm");
    expect(m?.event.summary).toBe("日本酒の会");
  });

  it("候補なし → null", async () => {
    const cal = new MemoryCalendarApi();
    await cal.insert("primary", timed("散髪", "2026-11-20T12:00", "2026-11-20T13:00"));
    expect(await findExisting(base, cal, ["primary"], null, "Asia/Tokyo")).toBeNull();
  });
});

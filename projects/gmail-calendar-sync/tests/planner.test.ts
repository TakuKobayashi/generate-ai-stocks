import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Classification, ExtractedEvent } from "../src/llm/schemas.js";
import { ClassifySchema, ExtractSchema, toOllamaFormat } from "../src/llm/schemas.js";
import { prepareEmail } from "../src/mime.js";
import { planEvents, verifyAgainstSource, type PlanOptions } from "../src/planner.js";
import { ref } from "./helpers.js";

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

const SOURCE = `予約番号：QX7K2P
便名：GK11
日付：2026/11/02（月）
出発：07:30 東京（成田）NRT 第3ターミナル
到着：09:10 札幌（新千歳）CTS`;

describe("verifyAgainstSource (決定的な逐語チェック)", () => {
  it("本文にある値はそのまま (全角/半角・空白の違いは許容)", () => {
    const r = verifyAgainstSource(
      ev({ kind: "flight", title: "GK11", date_text: "2026/11/02(月)", start_time_text: "07:30", reservation_number: "QX7K2P", location: "東京(成田) NRT" }),
      SOURCE,
      ref("2026-10-05"),
    );
    expect(r.issues).toEqual([]);
  });

  it("書式を変えて写した日付・時刻は minor", () => {
    const r = verifyAgainstSource(ev({ kind: "flight", title: "GK11", date_text: "2026年11月2日", start_time_text: "午前7時30分" }), SOURCE, ref("2026-10-05"));
    expect(r.issues.map((i) => i.severity)).toEqual(["minor", "minor"]);
    expect(r.event.date_text).toBe("2026年11月2日");
  });

  it("本文に無い値 (幻覚) は削除し critical", () => {
    const r = verifyAgainstSource(
      ev({ kind: "flight", title: "GK11", date_text: "2026/11/05", start_time_text: "13:00", reservation_number: "ZZZ999", contact: "0120-000-000" }),
      SOURCE,
      ref("2026-10-05"),
    );
    expect(r.event.date_text).toBe("");
    expect(r.event.start_time_text).toBe("");
    expect(r.event.reservation_number).toBe("");
    expect(r.event.contact).toBe("");
    expect(r.issues.filter((i) => i.severity === "critical").map((i) => i.field)).toEqual(["date_text", "start_time_text"]);
  });
});

const opts: PlanOptions = {
  calendarId: "primary",
  reviewCalendarId: null,
  defaultTimezone: "Asia/Tokyo",
  defaultEventMinutes: 60,
  lodgingMode: "span",
  minConfidence: 0.6,
  model: "test-model",
};
const cls = (kind: Classification["kind"], confidence = 0.9): Classification => ({ kind, confidence, reason: "test" });

async function email(f: string) {
  return prepareEmail(readFileSync(path.join(__dirname, "..", "samples", f)), {
    gmailId: f,
    threadId: f,
    internalDate: null,
    maxBodyChars: 6000,
    defaultTimezone: "Asia/Tokyo",
  });
}

describe("planEvents", () => {
  it("フライト: タイムゾーン付きの時刻指定予定 + extendedProperties", async () => {
    const e = await email("01-jetstar-itinerary.eml");
    const { planned, failures } = planEvents(
      e,
      cls("travel_flight"),
      [{ event: ev({ kind: "flight", title: "GK11 成田→札幌", date_text: "2026/11/02（月）", start_time_text: "07:30", end_time_text: "09:10", location: "東京（成田）NRT", end_location: "札幌（新千歳）CTS", reservation_number: "QX7K2P" }), issues: [], llmIssues: 0 }],
      opts,
    );
    expect(failures).toEqual([]);
    const p = planned[0]!;
    expect(p.segment).toBe("GK11");
    expect(p.needsReview).toBe(false);
    expect(p.calendarEvent.start).toEqual({ dateTime: "2026-11-02T07:30:00+09:00", timeZone: "Asia/Tokyo" });
    expect(p.calendarEvent.extendedProperties?.private).toMatchObject({ gcsReservation: "QX7K2P", gcsKind: "flight", gcsMessageId: "01-jetstar-itinerary.eml" });
    expect(p.calendarEvent.description).toContain("予約番号: QX7K2P");
    expect(p.calendarEvent.description).toContain("rfc822msgid");
  });

  it("宿泊 separate モード: チェックイン / チェックアウトの 2 件 (現地時間)", async () => {
    const e = await email("02-tripcom-hotel.eml");
    const { planned } = planEvents(
      e,
      cls("travel_lodging"),
      [{ event: ev({ kind: "lodging", title: "Hotel Am Stephansplatz", date_text: "2026年11月21日(土)", start_time_text: "15:00以降", end_date_text: "2026年11月24日(火)", end_time_text: "11:00まで", timezone_text: "現地時間", location: "Stephansplatz 9, 1010 Wien, Austria", all_day: true }), issues: [], llmIssues: 0 }],
      { ...opts, lodgingMode: "separate" },
    );
    expect(planned.map((p) => p.summary)).toEqual(["チェックイン: Hotel Am Stephansplatz", "チェックアウト: Hotel Am Stephansplatz"]);
    expect(planned[0]!.calendarEvent.start).toEqual({ dateTime: "2026-11-21T15:00:00+01:00", timeZone: "Europe/Vienna" });
    expect(planned[1]!.calendarEvent.start?.dateTime).toBe("2026-11-24T11:00:00+01:00");
  });

  it("低信頼度・予約リクエストは【要確認】+ tentative", async () => {
    const e = await email("03-airbnb-request.eml");
    const { planned } = planEvents(
      e,
      cls("travel_lodging", 0.55),
      [{ event: ev({ kind: "lodging", status: "tentative", title: "京町家 月白", date_text: "12月30日(水)", end_date_text: "1月2日(土)", all_day: true }), issues: [], llmIssues: 0 }],
      opts,
    );
    expect(planned[0]!.summary).toBe("【要確認】京町家 月白");
    expect(planned[0]!.calendarEvent.status).toBe("tentative");
    expect(planned[0]!.calendarEvent.end).toEqual({ date: "2027-01-03" });
  });

  it("REVIEW_CALENDAR_ID があれば別カレンダーへ (接頭辞なし)", async () => {
    const e = await email("03-airbnb-request.eml");
    const { planned } = planEvents(
      e,
      cls("travel_lodging", 0.3),
      [{ event: ev({ kind: "lodging", title: "京町家 月白", date_text: "12月30日(水)", all_day: true }), issues: [], llmIssues: 0 }],
      { ...opts, reviewCalendarId: "review@group.calendar.google.com" },
    );
    expect(planned[0]!.calendarId).toBe("review@group.calendar.google.com");
    expect(planned[0]!.summary).toBe("京町家 月白");
  });

  it("分類が cancellation なら status は cancelled", async () => {
    const e = await email("05-sake-forwarded.eml");
    const { planned } = planEvents(e, cls("cancellation"), [{ event: ev({ kind: "event", title: "日本酒会", date_text: "11月7日（土）" }), issues: [], llmIssues: 0 }], opts);
    expect(planned[0]!.status).toBe("cancelled");
  });

  it("日付が無い抽出結果は failure", async () => {
    const e = await email("05-sake-forwarded.eml");
    const { planned, failures } = planEvents(e, cls("event"), [{ event: ev({ kind: "event", title: "日本酒会", date_text: "" }), issues: [], llmIssues: 0 }], opts);
    expect(planned).toEqual([]);
    expect(failures).toHaveLength(1);
  });
});

describe("schemas → Ollama format", () => {
  it("JSON Schema に変換でき、キー順が保たれる (reason が先頭)", () => {
    const js = toOllamaFormat(ClassifySchema) as { properties: Record<string, unknown>; required: string[]; $schema?: string };
    expect(Object.keys(js.properties)).toEqual(["reason", "kind", "confidence"]);
    expect(js.required).toEqual(["reason", "kind", "confidence"]);
    expect(js.$schema).toBeUndefined();
    const ex = toOllamaFormat(ExtractSchema) as { properties: { events: { items: { required: string[] } } } };
    expect(ex.properties.events.items.required).toContain("date_text");
  });
});

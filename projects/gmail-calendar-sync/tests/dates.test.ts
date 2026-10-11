import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { describeWhen, findDatesInText, parseDate, parseTime, parseTimeRange, resolveWhen } from "../src/dates.js";
import { raw, ref, tz } from "./helpers.js";

const opts = (iso: string) => ({ reference: ref(iso), defaultTimezone: "Asia/Tokyo", defaultEventMinutes: 60 });

describe("parseDate", () => {
  const r = ref("2026-10-05T12:00");
  it.each([
    ["2026年11月2日(月)", [2026, 11, 2]],
    ["2026/11/02（月）", [2026, 11, 2]],
    ["2026-11-02", [2026, 11, 2]],
    ["２０２６年１１月２日", [2026, 11, 2]],
    ["令和8年11月10日(火)", [2026, 11, 10]],
    ["R8.11.10", [2026, 11, 10]],
    ["Nov 2, 2026", [2026, 11, 2]],
    ["Sunday, November 22, 2026", [2026, 11, 22]],
    ["2 November 2026", [2026, 11, 2]],
    ["11月7日（土）", [2026, 11, 7]],
    ["11/14(土)", [2026, 11, 14]],
  ])("%s", (text, [y, m, d]) => {
    const p = parseDate(text, { reference: r });
    expect(p).not.toBeNull();
    expect([p!.year, p!.month, p!.day]).toEqual([y, m, d]);
    expect(p!.warnings).toEqual([]);
  });

  it("年が無い日付は「次に来る日付」として補完する (12月受信の 1/5 は翌年)", () => {
    const p = parseDate("1/5", { reference: ref("2026-12-20") });
    expect([p!.year, p!.month, p!.day]).toEqual([2027, 1, 5]);
    expect(p!.yearInferred).toBe(true);
  });

  it("数日前の日付は同じ年のまま (猶予 14 日)", () => {
    const p = parseDate("10/1", { reference: ref("2026-10-05") });
    expect(p!.year).toBe(2026);
  });

  it("曜日があれば年の推定に使う", () => {
    // 2026/11/02 は月曜、2027/11/02 は火曜
    const p = parseDate("11/2(火)", { reference: ref("2026-10-05") });
    expect(p!.year).toBe(2027);
  });

  it("年が明示されていて曜日が矛盾する場合は警告", () => {
    const p = parseDate("2026年11月3日(月)", { reference: ref("2026-10-05") });
    expect(p!.warnings.join()).toMatch(/weekday_mismatch/);
  });

  it("notBefore (チェックアウト日) は開始日より後になる年を選ぶ", () => {
    const p = parseDate("1月2日(土)", { reference: ref("2026-10-07"), notBefore: DateTime.fromISO("2026-12-30") });
    expect([p!.year, p!.month, p!.day]).toEqual([2027, 1, 2]);
  });

  it("「11月」の「月」を曜日と誤認しない", () => {
    const p = parseDate("11月2日", { reference: ref("2026-10-05") });
    expect(p!.weekday).toBeUndefined();
  });

  it("日付が無ければ null", () => {
    expect(parseDate("近日中", { reference: ref("2026-10-05") })).toBeNull();
    expect(parseDate("13/45", { reference: ref("2026-10-05") })).toBeNull();
  });

  it("英単語の一部 (market 5) を月名と誤認しない", () => {
    expect(parseDate("market 5", { reference: ref("2026-10-05") })).toBeNull();
  });
});

describe("parseTime / parseTimeRange", () => {
  it.each([
    ["18:00", 18, 0],
    ["午後6時半", 18, 30],
    ["午前10時30分", 10, 30],
    ["6:30 PM", 18, 30],
    ["2:00 PM (local time)", 14, 0],
    ["12:00 AM", 0, 0],
    ["7pm", 19, 0],
    ["正午", 12, 0],
    ["１９：００〜", 19, 0],
    ["15:00以降", 15, 0],
  ])("%s → %i:%i", (text, h, m) => {
    const t = parseTime(text);
    expect(t).not.toBeNull();
    expect([t!.hour, t!.minute]).toEqual([h, m]);
  });

  it("25:30 は翌日 1:30", () => {
    expect(parseTime("25:30")).toMatchObject({ hour: 1, minute: 30, dayOffset: 1 });
  });

  it("「2時間」は時刻ではない", () => {
    expect(parseTime("所要時間 2時間")).toBeNull();
  });

  it("日付 (2026/11/02) を時刻と誤認しない", () => {
    expect(parseTime("2026/11/02")).toBeNull();
  });

  it("範囲表記", () => {
    expect(parseTimeRange("18:00〜21:00（受付17:30〜）")).toMatchObject({ start: { hour: 18 }, end: { hour: 21 } });
    expect(parseTimeRange("午後6時～9時")).toMatchObject({ start: { hour: 18 }, end: { hour: 21 } });
  });
});

describe("resolveWhen", () => {
  it("国内線 (Jetstar GK11 2026/11/02 成田→新千歳)", () => {
    const r = resolveWhen(
      raw({
        kind: "flight",
        date_text: "2026/11/02（月）",
        start_time_text: "07:30",
        end_time_text: "09:10",
        timezone_text: "現地時刻",
        location: "東京（成田）NRT 第3ターミナル",
        end_location: "札幌（新千歳）CTS",
      }),
      opts("2026-10-05"),
      tz,
    );
    expect(r.ok).toBe(true);
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.start.toISO()).toBe("2026-11-02T07:30:00.000+09:00");
    expect(r.when.end.toISO()).toBe("2026-11-02T09:10:00.000+09:00");
    expect(r.when.timeZone).toBe("Asia/Tokyo");
  });

  it("国際線: 出発は出発地、到着は到着地のタイムゾーン", () => {
    const r = resolveWhen(
      raw({
        kind: "flight",
        date_text: "2026年11月20日",
        start_time_text: "10:30",
        end_date_text: "2026年11月20日",
        end_time_text: "15:30",
        location: "東京(羽田) HND",
        end_location: "バンコク BKK",
      }),
      opts("2026-10-05"),
      tz,
    );
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.endTimeZone).toBe("Asia/Bangkok");
    expect(r.when.end.toISO()).toBe("2026-11-20T15:30:00.000+07:00");
    expect(r.when.end.diff(r.when.start, "hours").hours).toBe(7);
  });

  it("夜行便: 到着日が無く到着時刻が出発より前なら翌日", () => {
    const r = resolveWhen(
      raw({
        kind: "flight",
        date_text: "11/24(火)",
        start_time_text: "22:00",
        end_time_text: "06:15",
        location: "Bangkok BKK",
        end_location: "Tokyo HND",
      }),
      opts("2026-10-05"),
      tz,
    );
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.start.toISO()).toBe("2026-11-24T22:00:00.000+07:00");
    expect(r.when.end.toISO()).toBe("2026-11-25T06:15:00.000+09:00");
    expect(r.when.warnings).toContain("assumed_overnight");
  });

  it("宿泊 (Trip.com ウィーン): チェックイン〜チェックアウトの終日。終了は排他的", () => {
    const r = resolveWhen(
      raw({
        kind: "lodging",
        date_text: "2026年11月21日(土)",
        start_time_text: "15:00以降",
        end_date_text: "2026年11月24日(火)",
        end_time_text: "11:00まで",
        timezone_text: "現地時間",
        location: "Stephansplatz 9, 1010 Wien, Austria",
        all_day: true,
      }),
      opts("2026-10-06"),
      tz,
    );
    if (!r.ok || !r.when.allDay) throw new Error("all-day expected");
    expect(r.when.startDate).toBe("2026-11-21");
    expect(r.when.endDateExclusive).toBe("2026-11-25");
    expect(r.when.timeZone).toBe("Europe/Vienna");
    expect(r.when.startTimeNote).toBe("15:00");
    expect(describeWhen(r.when)).toBe("2026-11-21〜2026-11-24 (終日)");
  });

  it("Airbnb: 年末年始をまたぐ宿泊 (年なし)", () => {
    const r = resolveWhen(
      raw({ kind: "lodging", date_text: "12月30日(水)", end_date_text: "1月2日(土)", location: "京都市東山区", all_day: true }),
      opts("2026-10-07"),
      tz,
    );
    if (!r.ok || !r.when.allDay) throw new Error("all-day expected");
    expect(r.when.startDate).toBe("2026-12-30");
    expect(r.when.endDateExclusive).toBe("2027-01-03");
  });

  it("日本酒会 18:00〜21:00 (開始欄に範囲が入っていても分割)", () => {
    const r = resolveWhen(
      raw({ kind: "event", date_text: "11月7日（土）", start_time_text: "18:00〜21:00", location: "日本橋 酒蔵ダイニング「蔵」" }),
      opts("2026-10-08"),
      tz,
    );
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.start.toISO()).toBe("2026-11-07T18:00:00.000+09:00");
    expect(r.when.end.toISO()).toBe("2026-11-07T21:00:00.000+09:00");
  });

  it("GetYourGuide: 英語・現地時間 (ウィーン)", () => {
    const r = resolveWhen(
      raw({
        kind: "tour",
        date_text: "Sunday, November 22, 2026",
        start_time_text: "2:00 PM (local time)",
        timezone_text: "local time",
        location: "Wiener Staatsoper, Opernring 2, 1010 Vienna",
      }),
      opts("2026-10-08"),
      tz,
    );
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.start.toISO()).toBe("2026-11-22T14:00:00.000+01:00");
    expect(r.when.end.toISO()).toBe("2026-11-22T17:00:00.000+01:00"); // tour 既定 180 分
  });

  it("date_text に時刻が含まれていれば使う", () => {
    const r = resolveWhen(raw({ kind: "meeting", date_text: "2026/11/02 07:30" }), opts("2026-10-05"), tz);
    if (!r.ok || r.when.allDay) throw new Error("timed expected");
    expect(r.when.start.toFormat("HH:mm")).toBe("07:30");
  });

  it("時刻が無ければ終日", () => {
    const r = resolveWhen(raw({ kind: "event", date_text: "2026年11月3日(火)" }), opts("2026-10-05"), tz);
    expect(r.ok && r.when.allDay).toBe(true);
  });

  it("日付が解釈できなければ失敗", () => {
    const r = resolveWhen(raw({ kind: "event", date_text: "後日ご連絡します" }), opts("2026-10-05"), tz);
    expect(r.ok).toBe(false);
  });
});

describe("findDatesInText", () => {
  it("本文中の日付をすべて列挙", () => {
    const ds = findDatesInText("出発 2026/11/02 07:30 / 復路 11月5日(木) / Nov 8", ref("2026-10-05"));
    expect(ds.map((d) => `${d.month}/${d.day}`)).toEqual(["11/2", "11/5", "11/8"]);
  });
});

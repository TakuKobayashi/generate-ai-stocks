import { describe, expect, it } from "vitest";
import { resolveTimezone, resolveTimezoneFrom } from "../src/timezones.js";

describe("resolveTimezone", () => {
  it.each([
    ["Bangkok", "Asia/Bangkok"],
    ["バンコク BKK", "Asia/Bangkok"],
    ["東京（成田）NRT 第3ターミナル", "Asia/Tokyo"],
    ["札幌（新千歳）CTS", "Asia/Tokyo"],
    ["台北(桃園) TPE", "Asia/Taipei"],
    ["Stephansplatz 9, 1010 Wien, Austria", "Europe/Vienna"],
    ["Wiener Staatsoper, Opernring 2, 1010 Vienna", "Europe/Vienna"],
    ["JST", "Asia/Tokyo"],
    ["日本時間", "Asia/Tokyo"],
    ["10:00 (HST)", "Pacific/Honolulu"],
    ["America/New_York", "America/New_York"],
    ["ホノルル", "Pacific/Honolulu"],
    ["HKT", "Asia/Hong_Kong"],
  ])("%s → %s", (text, zone) => {
    expect(resolveTimezone(text)?.zone).toBe(zone);
  });

  it("明示オフセット", () => {
    expect(resolveTimezone("GMT+7")?.zone).toBe("UTC+7");
    expect(resolveTimezone("(UTC+05:30) Mumbai")?.zone).toBe("UTC+5:30");
    expect(resolveTimezone("2026-11-02T07:30:00-10:00")?.zone).toBe("UTC-10");
    expect(resolveTimezone("GMT+9")?.source).toBe("offset");
  });

  it("「現地時間」だけでは決まらない → null (場所から推定する)", () => {
    expect(resolveTimezone("現地時間")).toBeNull();
    expect(resolveTimezoneFrom(["現地時間", "Hilton Bangkok"], "Asia/Tokyo").zone).toBe("Asia/Bangkok");
  });

  it("誤検出しない (タイムズ駐車場・セブンイレブン・ウインドウ・中国地方)", () => {
    expect(resolveTimezone("タイムズ駐車場")).toBeNull();
    expect(resolveTimezone("セブンイレブン前で集合")).toBeNull();
    expect(resolveTimezone("受付ウインドウ")).toBeNull();
    expect(resolveTimezone("中国銀行 本店")).toBeNull();
    expect(resolveTimezone("see you at the hotel")).toBeNull();
  });

  it("複数の地名がある場合は先に出た方 (出発地)", () => {
    expect(resolveTimezone("成田 → ソウル(仁川)")?.zone).toBe("Asia/Tokyo");
    expect(resolveTimezone("ソウル(仁川) → 成田")?.zone).toBe("Asia/Seoul");
  });

  it("フォールバック", () => {
    expect(resolveTimezoneFrom(["", null, "銀座"], "Asia/Tokyo")).toEqual({ zone: "Asia/Tokyo", match: null });
  });
});

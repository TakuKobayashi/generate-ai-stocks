import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanBody,
  htmlToPlain,
  looksLikeSchedule,
  parseRawEmail,
  prepareEmail,
  truncateSmart,
  unwrapForward,
} from "../src/mime.js";

const sample = (f: string) => readFileSync(path.join(__dirname, "..", "samples", f));
const prep = (f: string, maxBodyChars = 6000) =>
  prepareEmail(sample(f), { gmailId: f, threadId: f, internalDate: null, maxBodyChars, defaultTimezone: "Asia/Tokyo" });

describe("parseRawEmail", () => {
  it("MIME エンコードされた件名と本文をデコード (例: Jetstar 旅程表)", async () => {
    const m = await parseRawEmail(sample("01-jetstar-itinerary.eml"));
    expect(m.subject).toBe("【ジェットスター】ご予約確認（旅程表）");
    expect(m.text).toContain("便名：GK11");
    expect(m.messageIdHeader).toBe("<sample-jetstar-001@jetstar.example>");
  });

  it("HTML のみのメールはテキスト化 (例: Trip.com)", async () => {
    const m = await parseRawEmail(sample("02-tripcom-hotel.eml"));
    expect(m.text).toContain("1128899001234");
    expect(m.text).toContain("2026年11月21日(土) 15:00以降");
    expect(m.text).not.toContain("<td>");
    expect(m.text).not.toContain("color:red");
  });

  it("ISO-2022-JP (JIS) の本文もデコードできる", async () => {
    // 本文 "予約 ABC123" を ISO-2022-JP (7bit) で手組み: ESC $ B + JIS コード + ESC ( B
    const raw = [
      "From: test@example.com",
      "Subject: =?ISO-2022-JP?B?GyRCTT1MczNORycbKEI=?=",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=ISO-2022-JP",
      "Content-Transfer-Encoding: 7bit",
      "",
      "\x1b$BM=Ls\x1b(B ABC123",
      "",
    ].join("\r\n");
    const m = await parseRawEmail(raw);
    expect(m.text).toContain("予約 ABC123");
    expect(m.subject).toBe("予約確認");
  });
});

describe("htmlToPlain", () => {
  it("表をテキストにし、リンク URL と画像を捨てる", () => {
    const t = htmlToPlain('<table><tr><td>日時</td><td>11/2 18:00</td></tr></table><a href="https://x.example/abc">詳細</a><img src="a.png">');
    expect(t).toContain("日時");
    expect(t).toContain("11/2 18:00");
    expect(t).not.toContain("https://");
  });
});

describe("unwrapForward", () => {
  it("Yahoo!メールの「----- 転送メッセージ -----」から元ヘッダを取り出す", async () => {
    const m = await parseRawEmail(sample("05-sake-forwarded.eml"));
    const f = unwrapForward(m.text);
    expect(f.isForwarded).toBe(true);
    expect(f.originalFrom).toContain("info@sake-kai.example");
    expect(f.originalSubject).toBe("【ご案内】秋の日本酒会 11/7(土)");
    expect(f.originalDate).toBe("2026/10/08, Thu 19:05");
    expect(f.body).toMatch(/^※これは動作確認用/);
    expect(f.body).not.toContain("カレンダーに入れておいて");
  });

  it("Gmail 形式 (---------- Forwarded message ---------) と日本語ヘッダ", () => {
    const f = unwrapForward(
      "FYI\n\n---------- Forwarded message ---------\n差出人: Shop <a@b.example>\n日付: 2026年10月1日(木) 10:00\n件名: ご予約確認\n宛先: me@example.com\n\n本文です",
    );
    expect(f.originalFrom).toBe("Shop <a@b.example>");
    expect(f.originalSubject).toBe("ご予約確認");
    expect(f.body).toBe("本文です");
  });

  it("転送でなければそのまま", () => {
    expect(unwrapForward("こんにちは").isForwarded).toBe(false);
  });
});

describe("cleanBody", () => {
  it("フッター・URL・引用を除去", () => {
    const body = [
      "ご予約ありがとうございます。",
      "日時：11月7日 18:00",
      "詳細: https://example.com/very/long/url?with=query",
      "これは本文の続きです。".repeat(20),
      "> 以前のメールの引用",
      "",
      "このメールは送信専用アドレスから配信されています。",
      "Copyright 2026 Example",
    ].join("\n");
    const t = cleanBody(body);
    expect(t).toContain("日時：11月7日 18:00");
    expect(t).toContain("[URL]");
    expect(t).not.toContain("https://");
    expect(t).not.toContain("送信専用");
    expect(t).not.toContain("以前のメールの引用");
  });

  it("本文のほとんどが引用なら引用記号だけ外す", () => {
    const t = cleanBody("> 予約番号: X1\n> 日時: 11/2 18:00");
    expect(t).toBe("予約番号: X1\n日時: 11/2 18:00");
  });
});

describe("truncateSmart", () => {
  it("上限内に収め、予約番号・日時の行を優先して残す", () => {
    const filler = Array.from({ length: 200 }, (_, i) => `ご案内文その${i}。特に重要ではない文章が続きます。`).join("\n");
    const text = `${filler}\n予約番号：ZZ9999\n日時：2026年11月2日 18:00\n${filler}`;
    const t = truncateSmart(text, 2000);
    expect(t.length).toBeLessThanOrEqual(2000);
    expect(t).toContain("予約番号：ZZ9999");
    expect(t).toContain("日時：2026年11月2日 18:00");
    expect(t).toContain("…(中略)…");
  });

  it("短ければそのまま", () => {
    expect(truncateSmart("abc", 10)).toBe("abc");
  });
});

describe("looksLikeSchedule", () => {
  it("予定らしいメール", () => {
    expect(looksLikeSchedule("ご予約確認", "日時：11月7日（土）18:00")).toBe(true);
    expect(looksLikeSchedule("Your booking", "Date: Nov 22, 2026 2:00 PM")).toBe(true);
  });
  it("日付の無いメルマガ", () => {
    expect(looksLikeSchedule("今週のおすすめ", "秋の新作コートが入荷しました。ポイント2倍")).toBe(false);
  });
});

describe("prepareEmail", () => {
  it("転送メールは元の件名・差出人・日付を使う", async () => {
    const e = await prep("05-sake-forwarded.eml");
    expect(e.forward.isForwarded).toBe(true);
    expect(e.subject).toBe("【ご案内】秋の日本酒会 11/7(土)");
    expect(e.from).toContain("sake-kai.example");
    expect(e.referenceDate.toISODate()).toBe("2026-10-08");
    expect(e.fullText).toContain("日時：11月7日（土）18:00〜21:00");
  });

  it("フッターを落とし、文字数上限を守る", async () => {
    const e = await prep("01-jetstar-itinerary.eml", 300);
    expect(e.fullText).not.toContain("送信専用");
    expect(e.llmText.length).toBeLessThanOrEqual(300);
    expect(e.llmText).toContain("予約番号：QX7K2P");
    expect(e.receivedAt.toISODate()).toBe("2026-10-05");
  });
});

describe("トークン予算", () => {
  it("日本語は 1 文字 ≒ 1 token、英語は少なめに見積もる", async () => {
    const { estimateTokens, bodyCharLimit } = await import("../src/mime.js");
    expect(estimateTokens("予約番号")).toBe(4);
    expect(estimateTokens("booking confirmation")).toBe(6);
    // 日本語本文: 予算 4,892 token → 約 4,892 文字まで
    expect(bodyCharLimit("あ".repeat(10000), 6000, 4892)).toBe(4892);
    // 英語本文: 文字数上限 6,000 が先に効く
    expect(bodyCharLimit("a".repeat(10000), 6000, 4892)).toBe(6000);
  });
});

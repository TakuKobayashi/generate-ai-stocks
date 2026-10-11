import { afterEach, describe, expect, it, vi } from "vitest";
import { configureLogger } from "../src/logger.js";
import { LlmError, OllamaClient } from "../src/llm/ollama.js";
import { ClassifySchema } from "../src/llm/schemas.js";

configureLogger({ level: "error", redact: false });

const reply = (content: string) =>
  new Response(JSON.stringify({ message: { content }, prompt_eval_count: 10, eval_count: 5 }), { status: 200 });

const client = () => new OllamaClient({ host: "http://ollama.test", model: "m", numCtx: 8192, timeoutMs: 1000 });

describe("OllamaClient.chatJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("format に JSON Schema、temperature 0、num_ctx を渡す", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"reason":"r","kind":"event","confidence":0.8}'));
    vi.stubGlobal("fetch", fetchMock);
    const out = await client().chatJson(ClassifySchema, [{ role: "user", content: "x" }]);
    expect(out.kind).toBe("event");
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.format.properties.kind.enum).toContain("not_schedule");
    expect(body.options).toMatchObject({ temperature: 0, num_ctx: 8192 });
    expect(body.stream).toBe(false);
  });

  it("検証エラーをフィードバックして 1 回だけ再試行", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply('{"reason":"r","kind":"party","confidence":3}'))
      .mockResolvedValueOnce(reply('{"reason":"r","kind":"event","confidence":0.7}'));
    vi.stubGlobal("fetch", fetchMock);
    const c = client();
    const out = await c.chatJson(ClassifySchema, [{ role: "user", content: "x" }]);
    expect(out.confidence).toBe(0.7);
    expect(c.stats.retries).toBe(1);
    const second = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(second.messages.at(-1).content).toMatch(/スキーマ検証に失敗/);
  });

  it("2 回とも失敗したら LlmError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => reply("not json")));
    await expect(client().chatJson(ClassifySchema, [{ role: "user", content: "x" }])).rejects.toBeInstanceOf(LlmError);
  });
});

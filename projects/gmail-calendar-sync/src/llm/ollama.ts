/**
 * Ollama /api/chat クライアント。
 * - format に JSON Schema を渡して構造化出力 (文法制約付きデコード)
 * - temperature 0 / seed 固定で決定的に
 * - zod で検証し、失敗したら検証エラーをフィードバックして 1 回だけ再試行
 */
import type { z } from "zod";
import { log } from "../logger.js";
import { toOllamaFormat } from "./schemas.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaOptions {
  host: string;
  model: string;
  numCtx: number;
  timeoutMs: number;
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
}

export class LlmError extends Error {}

export class OllamaClient {
  /** 実行全体の統計 (サマリ用) */
  readonly stats = { calls: 0, promptTokens: 0, outputTokens: 0, totalMs: 0, retries: 0 };

  constructor(private readonly opts: OllamaOptions) {}

  get model(): string {
    return this.opts.model;
  }

  /** サーバー起動確認と、モデルが pull 済みかの確認 */
  async ensureReady(): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${this.opts.host}/api/tags`, { signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      throw new LlmError(`Ollama (${this.opts.host}) に接続できません。ollama serve は起動していますか? ${String(err)}`);
    }
    const body = (await res.json()) as { models?: Array<{ name: string; model?: string }> };
    const names = (body.models ?? []).flatMap((m) => [m.name, m.model ?? ""]);
    const want = this.opts.model.includes(":") ? this.opts.model : `${this.opts.model}:latest`;
    if (!names.includes(want)) {
      throw new LlmError(`モデル ${this.opts.model} が見つかりません。\`ollama pull ${this.opts.model}\` を実行してください。`);
    }
  }

  private async rawChat(messages: ChatMessage[], format: Record<string, unknown>, numPredict: number): Promise<string> {
    const started = Date.now();
    const res = await fetch(`${this.opts.host}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(this.opts.timeoutMs),
      body: JSON.stringify({
        model: this.opts.model,
        messages,
        stream: false,
        format,
        keep_alive: "30m",
        options: {
          temperature: 0,
          top_p: 1,
          seed: 42,
          num_ctx: this.opts.numCtx,
          num_predict: numPredict,
        },
      }),
    });
    const data = (await res.json()) as OllamaChatResponse;
    if (!res.ok || data.error) throw new LlmError(`Ollama エラー (${res.status}): ${data.error ?? "unknown"}`);
    const ms = Date.now() - started;
    this.stats.calls++;
    this.stats.promptTokens += data.prompt_eval_count ?? 0;
    this.stats.outputTokens += data.eval_count ?? 0;
    this.stats.totalMs += ms;
    log.debug(
      `LLM 応答 ${ms}ms (prompt ${data.prompt_eval_count ?? "?"} tok / out ${data.eval_count ?? "?"} tok)`,
    );
    if ((data.prompt_eval_count ?? 0) >= this.opts.numCtx - 16) {
      log.warn(`プロンプトが num_ctx (${this.opts.numCtx}) に達しています。先頭が切られている可能性があります。`);
    }
    return data.message?.content ?? "";
  }

  /**
   * 構造化出力付きチャット。スキーマ検証に失敗したら、エラー内容を伝えて 1 回だけやり直す。
   */
  async chatJson<S extends z.ZodType>(
    schema: S,
    messages: ChatMessage[],
    opts: { numPredict?: number; label?: string } = {},
  ): Promise<z.infer<S>> {
    const format = toOllamaFormat(schema);
    const numPredict = opts.numPredict ?? 1024;
    let convo = [...messages];
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const content = await this.rawChat(convo, format, numPredict);
      let json: unknown;
      try {
        json = JSON.parse(content);
      } catch (err) {
        lastError = `JSON として解析できません: ${String(err)}`;
      }
      if (json !== undefined) {
        const parsed = schema.safeParse(json);
        if (parsed.success) return parsed.data;
        lastError = parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
      }
      log.warn(`[${opts.label ?? "llm"}] 出力の検証に失敗 (試行 ${attempt + 1}/2): ${lastError}`);
      this.stats.retries++;
      convo = [
        ...messages,
        { role: "assistant", content: content.slice(0, 4000) },
        {
          role: "user",
          content: `前回の出力はスキーマ検証に失敗しました: ${lastError}\nスキーマに厳密に従った JSON だけを出力し直してください。`,
        },
      ];
    }
    throw new LlmError(`[${opts.label ?? "llm"}] 2 回とも検証に失敗しました: ${lastError}`);
  }
}

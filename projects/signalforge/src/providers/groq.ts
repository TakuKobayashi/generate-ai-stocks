import axios from "axios";
import type { AIProvider } from "../types/index.js";

// ─── Groq Provider ────────────────────────────────────────────────────────────

export class GroqProvider implements AIProvider {
  readonly name = "groq";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(model?: string) {
    const key = process.env["GROQ_API_KEY"];
    if (!key) {
      throw new Error(
        "GROQ_API_KEY is not set.\n" +
        "Run: export GROQ_API_KEY=your_key\n" +
        "Get your key at: https://console.groq.com/"
      );
    }
    this.apiKey = key;
    this.model = model ?? "llama-3.3-70b-versatile";
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    );

    const text =
      response.data?.choices?.[0]?.message?.content ?? "";

    if (!text) {
      throw new Error("Groq returned empty response");
    }

    return text.trim();
  }
}

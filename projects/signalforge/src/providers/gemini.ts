import axios from "axios";
import type { AIProvider } from "../types/index.js";

// ─── Gemini Provider ──────────────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(model?: string) {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) {
      throw new Error(
        "GEMINI_API_KEY is not set.\n" +
        "Run: export GEMINI_API_KEY=your_key\n" +
        "Get your key at: https://aistudio.google.com/"
      );
    }
    this.apiKey = key;
    this.model = model ?? "gemini-1.5-flash";
  }

  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const contents = [];

    if (systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: `System: ${systemPrompt}\n\nUser: ${prompt}` }],
      });
    } else {
      contents.push({
        role: "user",
        parts: [{ text: prompt }],
      });
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30_000,
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!text) {
      throw new Error("Gemini returned empty response");
    }

    return text.trim();
  }
}

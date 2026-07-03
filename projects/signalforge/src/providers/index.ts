import type { AIProvider, SignalForgeConfig } from "../types/index.js";
import { GeminiProvider } from "./gemini.js";
import { GroqProvider } from "./groq.js";

export function createAIProvider(config: SignalForgeConfig): AIProvider {
  const { provider, model } = config.ai;

  switch (provider) {
    case "gemini":
      return new GeminiProvider(model);
    case "groq":
      return new GroqProvider(model);
    case "openrouter":
      // OpenRouter uses OpenAI-compatible API; implement similarly to Groq
      throw new Error("OpenRouter provider not yet implemented. Use gemini or groq.");
    default:
      throw new Error(`Unknown AI provider: ${provider as string}`);
  }
}

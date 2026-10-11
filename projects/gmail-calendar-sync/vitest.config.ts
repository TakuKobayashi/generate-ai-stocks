import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // テストは Ollama / Google API に一切依存しない (純粋関数のみ)
    environment: "node",
    testTimeout: 10_000,
  },
});

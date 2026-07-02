"use client";

import { ReactNode } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";

const ChatModelAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal: abortSignal,
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
            .filter((c) => c.type === "text")
            .map((c) => (c as { type: "text"; text: string }).text)
            .join(""),
        })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Chat request failed");
    }

    // Parse OpenAI SSE stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            yield { content: [{ type: "text", text }] };
          }
        } catch {
          // ignore parse errors in stream
        }
      }
    }
  },
};

export function ChatRuntimeProvider({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(ChatModelAdapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

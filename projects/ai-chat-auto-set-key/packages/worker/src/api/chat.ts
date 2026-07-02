import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { Env, KV_KEYS } from "../types";
import { requireAuth } from "../auth/router";

export const chatRouter = new Hono<{ Bindings: Env }>();

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

chatRouter.post("/", async (c) => {
  const token = getCookie(c, "session");
  if (!(await requireAuth(c.env, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { messages } = await c.req.json<{ messages: ChatMessage[] }>();

  // Fetch KV context to inject as system info
  const kvData = await c.env.KV.get(KV_KEYS.README_TABLE);
  let systemContext = "You are a helpful assistant.";
  if (kvData) {
    const parsed = JSON.parse(kvData);
    systemContext = `You are a helpful assistant. You have access to the following data fetched from the GitHub repository ${parsed.repo} on ${parsed.fetchedAt}.\n\nTable headers: ${parsed.table.headers.join(", ")}\n\nData:\n${JSON.stringify(parsed.table.rows, null, 2)}\n\nUse this data when relevant to answer questions.`;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemContext }, ...messages],
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return c.json({ error: `OpenAI error: ${err}` }, 502);
  }

  // Stream the response back as SSE
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

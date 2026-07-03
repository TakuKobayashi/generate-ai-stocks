import { Hono } from "hono";
import type { Env } from "../types";
import { createDb } from "../db";
import { LoadBalancerService } from "../services/loadBalancer";

const webhooks = new Hono<{ Bindings: Env }>();

// Vonage Answer Webhook - called when inbound call arrives
// GET or POST /api/webhooks/answer
webhooks.on(["GET", "POST"], "/answer", async (c) => {
  let params: {
    uuid: string;
    conversation_uuid: string;
    from: string;
    to: string;
  };

  if (c.req.method === "GET") {
    const query = c.req.query();
    params = {
      uuid: query.uuid ?? "",
      conversation_uuid: query.conversation_uuid ?? "",
      from: query.from ?? "",
      to: query.to ?? "",
    };
  } else {
    params = await c.req.json();
  }

  const db = createDb(c.env.DB);
  const requestUrl = new URL(c.req.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const lb = new LoadBalancerService(db, c.env, baseUrl);

  try {
    const ncco = await lb.handleInboundCall(params);
    return c.json(ncco);
  } catch (err) {
    console.error("Answer webhook error:", err);
    // Return a talk NCCO with error message
    return c.json([
      {
        action: "talk",
        text: "システムエラーが発生しました。しばらく経ってからおかけ直しください。",
        language: "ja-JP",
      },
    ]);
  }
});

// Vonage Event Webhook - called for call status updates
// POST /api/webhooks/call-event
webhooks.post("/call-event", async (c) => {
  let event: {
    uuid: string;
    conversation_uuid: string;
    status: string;
    direction: string;
    from?: string;
    to?: string;
    duration?: string;
  };

  try {
    event = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const db = createDb(c.env.DB);
  const requestUrl = new URL(c.req.url);
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
  const lb = new LoadBalancerService(db, c.env, baseUrl);

  try {
    await lb.handleCallEvent(event);
    return c.json({ ok: true });
  } catch (err) {
    console.error("Call event webhook error:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Vonage Fallback URL (for unanswered webhooks)
webhooks.on(["GET", "POST"], "/fallback", async (c) => {
  let params: { uuid?: string; conversation_uuid?: string } = {};
  if (c.req.method === "POST") {
    try {
      params = await c.req.json();
    } catch {}
  }
  console.warn("Fallback webhook called:", params);
  return c.json([
    {
      action: "talk",
      text: "申し訳ありません。接続に問題が発生しました。",
      language: "ja-JP",
    },
  ]);
});

export default webhooks;

import type { Env } from "../env";
import { getMessages, appendMessage } from "../utils/kv";
import type { Message } from "@chat-app/shared";

interface Session {
  userId: string;
  displayName: string;
  roomId: string;
}

export class ChatRoom {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") ?? "anonymous";
    const displayName = decodeURIComponent(url.searchParams.get("displayName") ?? "Anonymous");
    const roomId = url.searchParams.get("roomId") ?? this.state.id.toString();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ userId, displayName, roomId });

    // Send history from KV
    try {
      const history = await getMessages(this.env, roomId, 100);
      server.send(JSON.stringify({ type: "history", data: history }));
    } catch {
      server.send(JSON.stringify({ type: "history", data: [] }));
    }

    this.broadcast({ type: "join", data: { userId, displayName } }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const session: Session = ws.deserializeAttachment();

    let parsed: { type: string; content?: string };
    try {
      parsed = JSON.parse(message as string);
    } catch {
      ws.send(JSON.stringify({ type: "error", data: "Invalid message" }));
      return;
    }

    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong", data: null }));
      return;
    }

    if (parsed.type === "message" && parsed.content?.trim()) {
      const msg: Message = {
        id: crypto.randomUUID(),
        roomId: session.roomId,
        userId: session.userId,
        displayName: session.displayName,
        content: parsed.content.trim(),
        createdAt: new Date().toISOString(),
      };

      // Persist to KV
      try {
        await appendMessage(this.env, session.roomId, msg);
      } catch (e) {
        console.error("Failed to save message:", e);
      }

      this.broadcast({ type: "message", data: msg });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session: Session = ws.deserializeAttachment();
    this.broadcast(
      { type: "leave", data: { userId: session.userId, displayName: session.displayName } },
      ws
    );
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    ws.close(1011, "WebSocket error");
  }

  private broadcast(msg: unknown, exclude?: WebSocket): void {
    const str = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws !== exclude) {
        try { ws.send(str); } catch { /* skip closed */ }
      }
    }
  }
}

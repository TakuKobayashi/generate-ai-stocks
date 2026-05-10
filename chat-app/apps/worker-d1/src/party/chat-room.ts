import type { Env } from "../env";
import { getDB } from "../db";
import { messages } from "../db/schema";
import { eq, desc } from "drizzle-orm";

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
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const userId = url.searchParams.get("userId") ?? "anonymous";
    const displayName = url.searchParams.get("displayName") ?? "Anonymous";
    const roomId = url.searchParams.get("roomId") ?? this.state.id.toString();

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ userId, displayName, roomId });

    // Send chat history
    try {
      const db = getDB(this.env.DB);
      const history = await db
        .select()
        .from(messages)
        .where(eq(messages.roomId, roomId))
        .orderBy(desc(messages.createdAt))
        .limit(100)
        .all();

      server.send(
        JSON.stringify({ type: "history", data: history.reverse() })
      );
    } catch {
      server.send(JSON.stringify({ type: "history", data: [] }));
    }

    // Notify others of new user
    this.broadcast(
      { type: "join", data: { userId, displayName } },
      server
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
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
      const msg = {
        id: crypto.randomUUID(),
        roomId: session.roomId,
        userId: session.userId,
        displayName: session.displayName,
        content: parsed.content.trim(),
        createdAt: new Date().toISOString(),
      };

      // Persist to D1
      try {
        const db = getDB(this.env.DB);
        await db.insert(messages).values(msg);
      } catch (e) {
        console.error("Failed to save message:", e);
      }

      // Broadcast to all connections in this room
      this.broadcast({ type: "message", data: msg });
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string
  ): Promise<void> {
    const session: Session = ws.deserializeAttachment();
    this.broadcast(
      {
        type: "leave",
        data: { userId: session.userId, displayName: session.displayName },
      },
      ws
    );
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    ws.close(1011, "WebSocket error");
  }

  private broadcast(msg: unknown, exclude?: WebSocket): void {
    const str = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws !== exclude) {
        try {
          ws.send(str);
        } catch {
          // ignore closed sockets
        }
      }
    }
  }
}

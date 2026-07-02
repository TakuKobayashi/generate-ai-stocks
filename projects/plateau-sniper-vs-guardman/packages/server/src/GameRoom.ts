// =============================================================
//  GameRoom  ─  Cloudflare Durable Object
//  PartyKit の Server インターフェースに準拠した実装
//  WebSocket のブロードキャスト・ゲーム状態管理を担う
// =============================================================

import type {
  ClientMessage,
  ServerMessage,
  PlayerInfo,
  Role,
  MsgSniperState,
  MsgBodyguardState,
} from "@plateau-sniper/shared";
import { nanoid } from "nanoid";

// ─── PartyKit 互換の型定義 ────────────────────────────────────
// PartyKit を Cloudflare Durable Object として再実装
interface Connection extends WebSocket {
  id: string;
  role?: Role;
  displayName?: string;
}

type GamePhase = "lobby" | "countdown" | "playing" | "result";

interface GameState {
  phase: GamePhase;
  gameDuration: number;
  remainingSeconds: number;
  winner?: "sniper" | "bodyguard";
  timerIntervalId?: ReturnType<typeof setInterval>;
}

// ─── Durable Object ───────────────────────────────────────────
export class GameRoom implements DurableObject {
  private connections = new Map<string, Connection>();
  private players = new Map<string, PlayerInfo>();

  private state: GameState = {
    phase: "lobby",
    gameDuration: 180,
    remainingSeconds: 180,
  };

  // 最新のプレイヤー状態キャッシュ（他クライアントへ再送用）
  private latestSniperState: MsgSniperState | null = null;
  private latestBodyguardStates = new Map<string, MsgBodyguardState>();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {
    this.state.gameDuration = parseInt(env.GAME_DURATION_SECONDS ?? "180", 10);
    this.state.remainingSeconds = this.state.gameDuration;
  }

  // ─── HTTP → WebSocket アップグレード ─────────────────────────
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair()) as [
      WebSocket,
      WebSocket,
    ];

    const clientId = nanoid(12);
    const conn = server as Connection;
    conn.id = clientId;

    this.ctx.acceptWebSocket(server);

    // 接続直後にwelcomeを送る
    this.sendTo(conn, {
      type: "welcome",
      clientId,
      roomId: this.ctx.id.toString(),
      players: Array.from(this.players.values()),
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── WebSocket ライフサイクル (Hibernation API) ───────────────
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const conn = ws as Connection;
    try {
      const msg: ClientMessage = JSON.parse(message as string);
      await this.handleMessage(conn, msg);
    } catch (e) {
      this.sendTo(conn, {
        type: "error",
        code: "PARSE_ERROR",
        message: "Invalid JSON message",
      });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const conn = ws as Connection;
    const clientId = conn.id;

    const player = this.players.get(clientId);
    if (player) {
      this.players.delete(clientId);
      this.connections.delete(clientId);
      this.latestBodyguardStates.delete(clientId);
      if (this.latestSniperState && conn.role === "sniper") {
        this.latestSniperState = null;
      }

      this.broadcast(
        {
          type: "player_left",
          clientId,
          role: player.role,
        },
        clientId,
      );
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    console.error("[GameRoom] WebSocket error:", error);
  }

  // ─── メッセージハンドラ ───────────────────────────────────────
  private async handleMessage(conn: Connection, msg: ClientMessage) {
    switch (msg.type) {
      case "join":
        return this.handleJoin(conn, msg);

      case "sniper_state":
        return this.handleSniperState(conn, msg);

      case "bodyguard_state":
        return this.handleBodyguardState(conn, msg);

      case "sniper_fired":
        return this.broadcast({
          type: "sniper_fired_sync",
          origin: msg.origin,
          direction: msg.direction,
          hit: msg.hit,
          hitPoint: msg.hitPoint,
          hitTag: msg.hitTag,
          serverTimestamp: Date.now(),
        });

      case "cover_order":
        return this.broadcast({
          type: "cover_order_sync",
          bodyguardClientId: msg.bodyguardClientId,
          coverPointName: msg.coverPointName,
        });

      case "dispatch_order":
        return this.broadcast({
          type: "dispatch_order_sync",
          bodyguardClientId: msg.bodyguardClientId,
          targetGuardId: msg.targetGuardId,
        });

      case "start_game":
        return this.handleStartGame(conn);

      case "reset_game":
        return this.handleResetGame();

      case "ping":
        return this.sendTo(conn, {
          type: "pong",
          timestamp: msg.timestamp,
          serverTimestamp: Date.now(),
        });

      default:
        this.sendTo(conn, {
          type: "error",
          code: "UNKNOWN_TYPE",
          message: `Unknown message type`,
        });
    }
  }

  // ─── Join ─────────────────────────────────────────────────────
  private handleJoin(
    conn: Connection,
    msg: Extract<ClientMessage, { type: "join" }>,
  ) {
    // スナイパーは1人のみ
    if (msg.role === "sniper") {
      const existingSniper = Array.from(this.players.values()).find(
        (p) => p.role === "sniper",
      );
      if (existingSniper) {
        this.sendTo(conn, {
          type: "error",
          code: "SNIPER_TAKEN",
          message: "Sniper role is already taken",
        });
        return;
      }
    }

    conn.role = msg.role;
    conn.displayName = msg.displayName;

    const player: PlayerInfo = {
      clientId: conn.id,
      role: msg.role,
      displayName: msg.displayName,
      connectedAt: Date.now(),
    };

    this.players.set(conn.id, player);
    this.connections.set(conn.id, conn);

    // 入室を全員に通知
    this.broadcast({ type: "player_joined", player }, conn.id);

    // 現在のゲームフェーズを新規参加者に送信
    this.sendTo(conn, {
      type: "game_phase_sync",
      phase: this.state.phase,
      remainingSeconds: this.state.remainingSeconds,
    });

    // 最新状態キャッシュを新規参加者に送信
    if (this.latestSniperState && conn.role !== "sniper") {
      this.sendTo(conn, {
        type: "sniper_state_sync",
        clientId: this.getSniperClientId() ?? "",
        ...this.latestSniperState,
        serverTimestamp: Date.now(),
      });
    }
    for (const [bgId, bgState] of this.latestBodyguardStates) {
      if (bgId !== conn.id) {
        this.sendTo(conn, {
          type: "bodyguard_state_sync",
          ...bgState,
          serverTimestamp: Date.now(),
        });
      }
    }
  }

  // ─── スナイパー状態同期 ───────────────────────────────────────
  private handleSniperState(
    conn: Connection,
    msg: Extract<ClientMessage, { type: "sniper_state" }>,
  ) {
    if (conn.role !== "sniper") return;
    this.latestSniperState = msg;

    this.broadcast(
      {
        type: "sniper_state_sync",
        clientId: conn.id,
        position: msg.position,
        rotation: msg.rotation,
        mode: msg.mode,
        transitionProgress: msg.transitionProgress,
        serverTimestamp: Date.now(),
      },
      conn.id, // 自分には送らない
    );
  }

  // ─── ボディガード状態同期 ─────────────────────────────────────
  private handleBodyguardState(
    conn: Connection,
    msg: Extract<ClientMessage, { type: "bodyguard_state" }>,
  ) {
    if (conn.role !== "bodyguard") return;
    this.latestBodyguardStates.set(conn.id, msg);

    this.broadcast(
      {
        type: "bodyguard_state_sync",
        clientId: conn.id,
        position: msg.position,
        rotation: msg.rotation,
        isSprinting: msg.isSprinting,
        serverTimestamp: Date.now(),
      },
      conn.id,
    );
  }

  // ─── ゲーム開始 ───────────────────────────────────────────────
  private handleStartGame(conn: Connection) {
    if (this.state.phase !== "lobby") return;

    this.state.phase = "countdown";
    this.broadcast({ type: "game_phase_sync", phase: "countdown", countdownSeconds: 3 });

    // 3秒カウントダウン後にPlaying
    setTimeout(() => {
      this.state.phase = "playing";
      this.state.remainingSeconds = this.state.gameDuration;
      this.broadcast({
        type: "game_phase_sync",
        phase: "playing",
        remainingSeconds: this.state.remainingSeconds,
      });
      this.startTimer();
    }, 3000);
  }

  // ─── ゲームタイマー ───────────────────────────────────────────
  private startTimer() {
    const interval = setInterval(() => {
      if (this.state.phase !== "playing") {
        clearInterval(interval);
        return;
      }

      this.state.remainingSeconds -= 1;

      // 10秒ごとに残り時間をブロードキャスト
      if (this.state.remainingSeconds % 10 === 0 || this.state.remainingSeconds <= 10) {
        this.broadcast({
          type: "game_phase_sync",
          phase: "playing",
          remainingSeconds: this.state.remainingSeconds,
        });
      }

      if (this.state.remainingSeconds <= 0) {
        clearInterval(interval);
        this.endGame("bodyguard");
      }
    }, 1000);
  }

  private endGame(winner: "sniper" | "bodyguard") {
    this.state.phase = "result";
    this.state.winner = winner;
    this.broadcast({ type: "game_phase_sync", phase: "result", winner });
  }

  private handleResetGame() {
    this.state = {
      phase: "lobby",
      gameDuration: this.state.gameDuration,
      remainingSeconds: this.state.gameDuration,
    };
    this.latestSniperState = null;
    this.latestBodyguardStates.clear();
    this.broadcast({ type: "game_phase_sync", phase: "lobby" });
  }

  // ─── 送信ユーティリティ ───────────────────────────────────────
  private sendTo(conn: WebSocket, msg: ServerMessage) {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      // 切断済みコネクションは無視
    }
  }

  private broadcast(msg: ServerMessage, excludeId?: string) {
    const json = JSON.stringify(msg);
    for (const [id, conn] of this.connections) {
      if (id === excludeId) continue;
      try {
        conn.send(json);
      } catch {
        // 切断済み
      }
    }
  }

  private getSniperClientId(): string | undefined {
    for (const [id, p] of this.players) {
      if (p.role === "sniper") return id;
    }
    return undefined;
  }
}

// apps/gather-frontend/src/app/services/partykit.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import PartySocket from 'partysocket';
import type {
  ClientMessage,
  ServerMessage,
  PlayerState,
} from '@gather/shared';

export interface RemotePlayer extends PlayerState {
  color: string;
}

const PLAYER_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
];

// ============================================================
// PartyKitService
//
// @Injectable({ providedIn: 'root' }) によりアプリ全体でシングルトン。
//
// 使い方:
//   constructor(private partyKit: PartyKitService) {}
//
//   this.partyKit.connect(host, roomId, identity, displayName, x, y);
//   this.partyKit.playersUpdated$.subscribe(() => { ... });
//   const players = this.partyKit.getPlayers();
// ============================================================
@Injectable({ providedIn: 'root' })
export class PartyKitService {

  readonly playersUpdated$ = new Subject<void>();

  private socket:   PartySocket | null = null;
  private players:  Map<string, RemotePlayer> = new Map();
  private colorIdx = 0;

  connect(
    host:        string,
    roomId:      string,
    identity:    string,
    displayName: string,
    startX:      number,
    startY:      number,
  ): void {
    this.disconnect();
    this.players.clear();
    this.colorIdx = 0;

    this.socket = new PartySocket({ host, room: roomId, id: identity });

    this.socket.addEventListener('open', () => {
      const msg: ClientMessage = {
        type: 'join', identity, displayName, x: startX, y: startY,
      };
      this.socket!.send(JSON.stringify(msg));
    });

    this.socket.addEventListener('message', (e: MessageEvent) => {
      this.handleMessage(e.data as string);
    });
  }

  sendPosition(x: number, y: number): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: 'position', x, y };
    this.socket.send(JSON.stringify(msg));
  }

  disconnect(): void {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'leave' } satisfies ClientMessage));
      }
      this.socket.close();
      this.socket = null;
    }
    this.players.clear();
  }

  getPlayers(): RemotePlayer[] {
    return Array.from(this.players.values());
  }

  private handleMessage(raw: string): void {
    let msg: ServerMessage;
    try { msg = JSON.parse(raw) as ServerMessage; }
    catch { return; }

    switch (msg.type) {
      case 'room_state':
        this.players.clear();
        msg.players.forEach(p => this.upsertPlayer(p));
        this.playersUpdated$.next();
        break;
      case 'player_joined':
        this.upsertPlayer(msg.player);
        this.playersUpdated$.next();
        break;
      case 'player_moved': {
        const p = this.players.get(msg.identity);
        if (p) { p.x = msg.x; p.y = msg.y; p.updatedAt = Date.now(); }
        break;
      }
      case 'player_left':
        this.players.delete(msg.identity);
        this.playersUpdated$.next();
        break;
    }
  }

  private upsertPlayer(state: PlayerState): void {
    const existing = this.players.get(state.identity);
    const color = existing?.color
      ?? PLAYER_COLORS[this.colorIdx++ % PLAYER_COLORS.length];
    this.players.set(state.identity, { ...state, color });
  }
}

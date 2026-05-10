import {
  Component, OnInit, OnDestroy, signal, inject,
  ChangeDetectionStrategy, ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AppShellComponent } from '../../components/app-shell/app-shell.component';
import { RoomModalComponent } from '../../components/room-modal/room-modal.component';
import { AuthService } from '../../services/auth.service';
import { RoomService } from '../../services/room.service';
import type { Message, Room } from '@chat-app/shared';

type ConnStatus = 'disconnected' | 'connecting' | 'connected';

interface SystemMsg {
  id: string;
  text: string;
  kind: 'system';
}

type ChatItem = Message | SystemMsg;

function isSystem(item: ChatItem): item is SystemMsg {
  return (item as SystemMsg).kind === 'system';
}

@Component({
  selector: 'app-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AppShellComponent, RoomModalComponent],
  template: `
    <app-shell>
      <div class="chat-layout">
        <!-- Header -->
        <div class="chat-header">
          <div style="flex:1">
            <h2>#{{ room()?.name ?? roomId }}</h2>
            @if (room()?.description) {
              <p style="font-size:13px;color:var(--text-2)">{{ room()?.description }}</p>
            }
          </div>

          <div class="connection-status" [class]="statusClass()">
            <div class="status-dot"></div>
            {{ statusLabel() }}
          </div>

          @if (auth.user()?.id === room()?.createdBy) {
            <button class="btn btn-ghost btn-sm" (click)="showEdit.set(true)" title="編集" type="button">✏️</button>
            <button class="btn btn-ghost btn-sm" (click)="showDelete.set(true)" title="削除" type="button" style="color:var(--danger)">🗑️</button>
          }

          @if (status() === 'connected') {
            <button class="btn btn-secondary btn-sm" (click)="disconnect()" type="button">切断</button>
          } @else {
            <button class="btn btn-primary btn-sm" (click)="connect(wsUrl())"
              [disabled]="!wsUrl() || status() === 'connecting'" type="button">接続</button>
          }
        </div>

        <!-- WS URL bar -->
        <div class="ws-connect-bar">
          <span class="ws-url-label">WS URL:</span>
          <input class="input" [ngModel]="editUrl()" (ngModelChange)="editUrl.set($event)"
            placeholder="ws://localhost:8787/ws/room-id"
            (keydown.enter)="applyUrl()" style="font-size:12px;padding:6px 10px" />
          <button class="btn btn-secondary btn-sm" (click)="applyUrl()" type="button">接続</button>
        </div>

        <!-- Messages -->
        <div class="messages-container" #messagesContainer>
          @if (items().length === 0 && status() === 'connected') {
            <div class="empty-state">
              <div class="empty-state-icon">💬</div>
              <h3>まだメッセージはありません</h3>
              <p>最初のメッセージを送ってみましょう</p>
            </div>
          }

          @for (group of grouped(); track group.key) {
            @if (group.isSystem) {
              @for (item of group.items; track item.id) {
                <div class="system-message">{{ asSystem(item).text }}</div>
              }
            } @else {
              <div class="message-row" [class.own]="group.isOwn">
                @if (!group.isOwn) {
                  <div class="msg-avatar">{{ group.initials }}</div>
                }
                <div class="msg-content">
                  <div class="msg-meta">
                    @if (!group.isOwn) {
                      <strong>{{ asMsg(group.items[0]).displayName }}</strong>
                    }
                    {{ formatTime(asMsg(group.items[0]).createdAt) }}
                  </div>
                  @for (item of group.items; track item.id) {
                    <div class="msg-bubble" [class]="group.isOwn ? 'own' : 'other'">
                      {{ asMsg(item).content }}
                    </div>
                  }
                </div>
              </div>
            }
          }

          <div #messagesEnd></div>
        </div>

        <!-- Input -->
        <div class="chat-input-area">
          <div class="chat-input-row">
            <textarea class="input" #inputEl
              [placeholder]="status() === 'connected'
                ? ('#' + (room()?.name ?? '...') + ' にメッセージを送信 (Enter で送信)')
                : '接続していません'"
              [(ngModel)]="inputText"
              (keydown)="onKeyDown($event)"
              [disabled]="status() !== 'connected'"
              rows="1">
            </textarea>
            <button class="btn btn-primary" (click)="sendMessage()"
              [disabled]="!inputText.trim() || status() !== 'connected'" type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </app-shell>

    @if (showEdit() && room()) {
      <app-room-modal
        [editRoom]="room()!"
        (close)="showEdit.set(false)"
        (saved)="onRoomUpdated()"
      />
    }

    @if (showDelete()) {
      <div class="modal-overlay" (click)="showDelete.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header"><h3>ルームを削除</h3></div>
          <p style="color:var(--text-2);font-size:14px">このルームとすべてのメッセージを削除しますか？</p>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showDelete.set(false)" type="button">キャンセル</button>
            <button class="btn btn-danger" (click)="deleteRoom()" type="button">削除する</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private roomService = inject(RoomService);

  roomId = '';
  room = signal<Room | null>(null);
  items = signal<ChatItem[]>([]);
  inputText = '';
  wsUrl = signal('');
  editUrl = signal('');
  status = signal<ConnStatus>('disconnected');
  showEdit = signal(false);
  showDelete = signal(false);

  private ws: WebSocket | null = null;
  private pingInterval: any;
  private shouldScrollBottom = false;

  statusLabel = () => {
    switch (this.status()) {
      case 'connected': return '接続中';
      case 'connecting': return '接続中...';
      default: return '未接続';
    }
  };

  statusClass = () => {
    switch (this.status()) {
      case 'connected': return 'connection-status status-connected';
      case 'connecting': return 'connection-status status-connecting';
      default: return 'connection-status status-disconnected';
    }
  };

  grouped = () => {
    const groups: {
      key: string;
      isSystem: boolean;
      isOwn: boolean;
      initials: string;
      items: ChatItem[];
    }[] = [];

    for (const item of this.items()) {
      if (isSystem(item)) {
        groups.push({ key: item.id, isSystem: true, isOwn: false, initials: '', items: [item] });
      } else {
        const msg = item as Message;
        const last = groups[groups.length - 1];
        if (last && !last.isSystem && !isSystem(last.items[0]) &&
            (last.items[0] as Message).userId === msg.userId) {
          last.items.push(item);
        } else {
          groups.push({
            key: msg.id,
            isSystem: false,
            isOwn: msg.userId === this.auth.user()?.id,
            initials: msg.displayName.slice(0, 2).toUpperCase(),
            items: [item],
          });
        }
      }
    }
    return groups;
  };

  ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('id') ?? '';
    this.roomService.get(this.roomId).then((r) => this.room.set(r)).catch(() => {});

    const token = this.auth.getToken();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const defaultUrl = `${proto}://${location.host}/ws/${this.roomId}?token=${token}`;
    this.wsUrl.set(defaultUrl);
    this.editUrl.set(defaultUrl);
    this.connect(defaultUrl);

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25_000);
  }

  ngAfterViewChecked() {
    if (this.shouldScrollBottom) {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
      this.shouldScrollBottom = false;
    }
  }

  ngOnDestroy() {
    clearInterval(this.pingInterval);
    this.ws?.close();
  }

  connect(url: string) {
    if (!url) return;
    this.ws?.close();
    this.status.set('connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.status.set('connected');
      this.addSystem('接続しました');
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'history') {
          this.items.set([...(msg.data as Message[])]);
        } else if (msg.type === 'message') {
          this.items.update((prev) => [...prev, msg.data as Message]);
        } else if (msg.type === 'join') {
          this.addSystem(`${msg.data.displayName} が参加しました`);
        } else if (msg.type === 'leave') {
          this.addSystem(`${msg.data.displayName} が退出しました`);
        }
        this.shouldScrollBottom = true;
      } catch {}
    };

    ws.onclose = () => {
      this.status.set('disconnected');
      this.ws = null;
    };

    ws.onerror = () => {
      this.status.set('disconnected');
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.status.set('disconnected');
    this.addSystem('切断しました');
  }

  applyUrl() {
    this.wsUrl.set(this.editUrl());
    this.connect(this.editUrl());
  }

  sendMessage() {
    if (!this.inputText.trim() || this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'message', content: this.inputText.trim() }));
    this.inputText = '';
  }

  onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  addSystem(text: string) {
    this.items.update((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, kind: 'system' } as SystemMsg,
    ]);
    this.shouldScrollBottom = true;
  }

  formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  asSystem(item: ChatItem) { return item as SystemMsg; }
  asMsg(item: ChatItem) { return item as Message; }

  async onRoomUpdated() {
    this.showEdit.set(false);
    const r = await this.roomService.get(this.roomId).catch(() => null);
    if (r) this.room.set(r);
  }

  async deleteRoom() {
    await this.roomService.delete(this.roomId);
    this.router.navigate(['/rooms']);
  }
}

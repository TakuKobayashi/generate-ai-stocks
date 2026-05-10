import {
  Component, OnInit, signal, inject, ChangeDetectionStrategy
} from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { RoomService } from '../../services/room.service';
import type { Room } from '@chat-app/shared';
import { RoomModalComponent } from '../room-modal/room-modal.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, CommonModule, RoomModalComponent],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-dot"></div>
            ChatApp
            <span style="font-size:11px;color:var(--accent);margin-left:auto;font-weight:400;">Angular</span>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-title">ルーム</div>

          @for (room of rooms(); track room.id) {
            <a
              [routerLink]="['/rooms', room.id]"
              routerLinkActive="active"
              class="room-item"
            >
              <span class="room-item-icon">#</span>
              <span class="room-item-name">{{ room.name }}</span>
            </a>
          }

          <button class="room-item" style="color:var(--accent);margin-top:4px" (click)="showModal.set(true)" type="button">
            <span class="room-item-icon">+</span>
            <span class="room-item-name">新しいルーム</span>
          </button>
        </div>

        <div class="sidebar-footer">
          <div class="user-info">
            <div class="user-avatar">{{ initials() }}</div>
            <div class="user-details">
              <div class="user-name">{{ auth.user()?.displayName }}</div>
              <div class="user-email">{{ auth.user()?.email }}</div>
            </div>
            <button class="btn btn-ghost btn-sm" (click)="logout()" title="ログアウト" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div class="main-content">
        <ng-content />
      </div>
    </div>

    @if (showModal()) {
      <app-room-modal
        (close)="showModal.set(false)"
        (saved)="onRoomCreated()"
      />
    }
  `,
})
export class AppShellComponent implements OnInit {
  auth = inject(AuthService);
  private roomService = inject(RoomService);
  private router = inject(Router);

  rooms = signal<Room[]>([]);
  showModal = signal(false);

  initials = () => {
    const name = this.auth.user()?.displayName ?? '';
    return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  };

  ngOnInit() {
    this.loadRooms();
  }

  async loadRooms() {
    try {
      const rooms = await this.roomService.list();
      this.rooms.set(rooms);
    } catch {}
  }

  onRoomCreated() {
    this.showModal.set(false);
    this.loadRooms();
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}

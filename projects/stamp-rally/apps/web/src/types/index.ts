// ==============================
// API レスポンス型定義
// ==============================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface User {
  id: string;
  email?: string;
  name?: string;
  isGuest: boolean;
}

export interface Location {
  id: string;
  stampRallyId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  sortOrder: number;
}

export interface StampRally {
  id: string;
  adminUserId: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  maxParticipants?: number;
  isActive: boolean;
  shareToken: string;
  createdAt: string;
  updatedAt: string;
  locations: Location[];
  participantCount?: number;
  completedCount?: number;
  shareUrl?: string;
}

export interface Participation {
  id: string;
  stampRallyId: string;
  userId: string;
  completedAt?: string;
  createdAt: string;
  rally: StampRally;
  stamps: Stamp[];
  stampCount: number;
  totalCount: number;
  isCompleted: boolean;
}

export interface Stamp {
  id: string;
  participationId: string;
  locationId: string;
  pressedAt: string;
}

// ==============================
// スタンプラリー作成フォーム型
// ==============================
export interface CreateRallyLocation {
  id: string; // ローカルのみ (ドラッグ用)
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface CreateRallyForm {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  maxParticipants: string;
  locations: CreateRallyLocation[];
  selectedPin: Omit<CreateRallyLocation, 'id'> | null;
}

// ==============================
// 参加状態
// ==============================
export type ParticipationStatus = 'active' | 'completed' | 'not_started' | 'ended' | 'inactive';

export function getParticipationStatus(rally: StampRally, participation?: Participation): ParticipationStatus {
  if (!rally.isActive) return 'inactive';
  const now = new Date().toISOString();
  if (rally.startAt > now) return 'not_started';
  if (rally.endAt && rally.endAt < now) return 'ended';
  if (participation?.isCompleted) return 'completed';
  return 'active';
}

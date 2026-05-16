// API クライアント - サーバーとの通信を一元管理

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : '');

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── ユーザー ─────────────────────────────────────────────────────────
export interface UserResponse { id: string; name: string; createdAt: number }

export const registerUser = (userId: string, name: string) =>
  apiFetch<{ success: boolean; userId: string }>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify({ userId, name }),
  });

export const updateWebFcmToken = (userId: string, webFcmToken: string | null) =>
  apiFetch(`/api/users/${userId}/web-fcm-token`, {
    method: 'PUT',
    body: JSON.stringify({ webFcmToken }),
  });

export const addFriend = (userId: string, friendId: string) =>
  apiFetch(`/api/users/${userId}/friends`, {
    method: 'POST',
    body: JSON.stringify({ friendId }),
  });

export const getFriends = (userId: string) =>
  apiFetch<UserResponse[]>(`/api/users/${userId}/friends`);

// ─── 誘い ─────────────────────────────────────────────────────────────
export interface DrinkingInvite {
  id: string; creatorId: string; creatorName: string;
  dateTime: number; locationLat?: number; locationLng?: number;
  locationName?: string; participantCount: number;
  message?: string; status: string; createdAt: number;
}

export interface CreateInvitePayload {
  creatorId: string; dateTime: number;
  locationLat?: number; locationLng?: number; locationName?: string;
  participantCount: number; message?: string;
}

export const createInvite = (payload: CreateInvitePayload) =>
  apiFetch<{
    success: boolean;
    inviteId: string;
    notifiedCount: { android: number; web: number; total: number };
  }>('/api/invites', { method: 'POST', body: JSON.stringify(payload) });

export const getReceivedInvites = (userId: string) =>
  apiFetch<DrinkingInvite[]>(`/api/invites/received/${userId}`);

export const getSentInvites = (userId: string) =>
  apiFetch<DrinkingInvite[]>(`/api/invites/sent/${userId}`);

// ─── 飲食店 ───────────────────────────────────────────────────────────
export interface Restaurant {
  id: string; name: string; genre: string; budget: string;
  address: string; lat: number; lng: number; photo: string;
  catchCopy: string; shopUrl: string; affiliateUrl: string;
  access: string; open: string; capacity: number;
}

export const getNearbyRestaurants = (
  lat: number, lng: number,
  range = 3, count = 8, keyword?: string
) => {
  const params = new URLSearchParams({
    lat: String(lat), lng: String(lng),
    range: String(range), count: String(count),
    ...(keyword ? { keyword } : {}),
  });
  return apiFetch<{ results: Restaurant[]; total: number }>(
    `/api/restaurants/nearby?${params}`
  );
};

// ─── 通知 ─────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string; userId: string; inviteId?: string;
  title: string; body: string;
  data?: { type?: string; inviteId?: string; creatorId?: string; creatorName?: string };
  isRead: number; createdAt: number;
}

export const getNotifications = (userId: string) =>
  apiFetch<AppNotification[]>(`/api/notifications/${userId}`);

export const getUnreadCount = (userId: string) =>
  apiFetch<{ count: number }>(`/api/notifications/${userId}/unread-count`);

export const markAsRead = (notificationId: string, userId: string) =>
  apiFetch(`/api/notifications/${notificationId}/read`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  });

export const markAllAsRead = (userId: string) =>
  apiFetch(`/api/notifications/${userId}/read-all`, { method: 'PUT' });

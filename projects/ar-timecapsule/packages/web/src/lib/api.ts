const API_BASE = "/api/v1";

export type ApiResult<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  return res.json() as Promise<ApiResult<T>>;
}

export type TokenPair = { accessToken: string; refreshToken: string; accessExpiresAt: number; refreshExpiresAt: number };
export type AuthUser = { id: string; email: string; displayName: string; role: string; shopName?: string | null };
export type LoginResponse = { user: AuthUser; tokens: TokenPair };
export type TimeCapsuleItem = { id: string; userId: string; title: string; latitude: number; longitude: number; arAnchorId: string | null; visibility: string; status: string; mediaType: string; viewCount: number; expireAt: string | null; createdAt: string; discoverRadiusMeters?: number; distanceMeters?: number };
export type CouponDetail = { id: string; title: string; description: string | null; shopName: string; redemptionType: string; redeemLimit: number | null; redeemCount: number; expireAt: string | null; isActive: boolean };

export const api = {
  auth: {
    login:       (email: string, password: string) => request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    signup:      (email: string, password: string, displayName: string) => request<LoginResponse>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, displayName }) }),
    storeSignup: (email: string, password: string, displayName: string, shopName: string, inviteCode: string) => request<LoginResponse>("/auth/signup/store", { method: "POST", body: JSON.stringify({ email, password, displayName, shopName, inviteCode }) }),
    refresh:     (refreshToken: string) => request<TokenPair>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),
    logout:      (refreshToken: string) => request<{ message: string }>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
  },
  capsules: {
    nearby: (lat: number, lng: number, radius = 500) => request<{ items: TimeCapsuleItem[]; nextCursor: string | null; total: number }>(`/time-capsules/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    my:     (cursor?: string) => request<{ items: TimeCapsuleItem[]; nextCursor: string | null }>(`/time-capsules/my${cursor ? `?cursor=${cursor}` : ""}`),
    all:    (cursor?: string) => request<{ items: TimeCapsuleItem[]; nextCursor: string | null }>(`/time-capsules/all${cursor ? `?cursor=${cursor}` : ""}`),
    get:    (id: string) => request<TimeCapsuleItem & { message: string | null; audio: unknown; coupon: CouponDetail | null }>(`/time-capsules/${id}`),
    create: (data: { title: string; message?: string; latitude: number; longitude: number; visibility: string; expireAt?: string; discoverRadiusMeters?: number; coupon?: { title: string; description?: string; shopName: string; redemptionType: string; redemptionCode?: string; redeemLimit?: number; expireAt?: string } }) =>
      request<{ id: string; geohash: string; createdAt: string }>("/time-capsules", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: string) => request<{ message: string }>(`/time-capsules/${id}`, { method: "DELETE" }),
  },
  coupons: { get: (id: string) => request<CouponDetail>(`/coupons/${id}`) },
};

export function saveAuth(d: LoginResponse) {
  localStorage.setItem("accessToken",    d.tokens.accessToken);
  localStorage.setItem("refreshToken",   d.tokens.refreshToken);
  localStorage.setItem("accessExpiresAt",String(d.tokens.accessExpiresAt));
  localStorage.setItem("user",           JSON.stringify(d.user));
}
export function clearAuth() {
  ["accessToken","refreshToken","accessExpiresAt","user"].forEach((k) => localStorage.removeItem(k));
}
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") ?? "null") as AuthUser | null; } catch { return null; }
}
export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;
  const exp = localStorage.getItem("accessExpiresAt");
  return !exp || Date.now() / 1000 > parseInt(exp, 10) - 60;
}

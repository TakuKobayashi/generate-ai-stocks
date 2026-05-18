'use client';

const ADMIN_TOKEN_KEY = 'stamp_rally_admin_token';
const ADMIN_USER_KEY = 'stamp_rally_admin_user';
const USER_TOKEN_KEY = 'stamp_rally_user_token';
const USER_INFO_KEY = 'stamp_rally_user_info';

// ==============================
// 管理者セッション
// ==============================
export const adminStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  },
  getUser: () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save: (token: string, user: { id: string; email: string; name: string }) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  },
};

// ==============================
// ユーザーセッション
// ==============================
export const userStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(USER_TOKEN_KEY);
  },
  getUser: (): { id: string; name?: string; email?: string; isGuest: boolean } | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save: (token: string, user: { id: string; name?: string; email?: string; isGuest: boolean }) => {
    localStorage.setItem(USER_TOKEN_KEY, token);
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  },
  isLoggedIn: (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(USER_TOKEN_KEY);
  },
};

// ==============================
// スタンプラリー作成フォーム永続化
// ==============================
const CREATE_RALLY_KEY = 'stamp_rally_create_form';

export const createRallyStorage = {
  save: (data: unknown) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CREATE_RALLY_KEY, JSON.stringify(data));
    }
  },
  load: <T>(): T | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CREATE_RALLY_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CREATE_RALLY_KEY);
    }
  },
};

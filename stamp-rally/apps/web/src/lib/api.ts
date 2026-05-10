const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  };

  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'エラーが発生しました');
  }
  return data as T;
}

// ==============================
// 管理者 Auth
// ==============================
export const adminApi = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      '/api/auth/admin/register',
      { method: 'POST', body: JSON.stringify({ email, password, name }) }
    ),

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      '/api/auth/admin/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
};

// ==============================
// 管理者 スタンプラリー
// ==============================
export const adminRallyApi = {
  list: (token: string) =>
    request<{ rallies: import('@/types').StampRally[] }>('/api/admin/stamp-rallies', { token }),

  get: (id: string, token: string) =>
    request<{ rally: import('@/types').StampRally }>(`/api/admin/stamp-rallies/${id}`, { token }),

  create: (
    data: {
      name: string;
      description?: string;
      startAt: string;
      endAt?: string;
      maxParticipants?: number;
      locations: { name: string; address?: string; latitude: number; longitude: number }[];
    },
    token: string
  ) =>
    request<{ rally: import('@/types').StampRally }>('/api/admin/stamp-rallies', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  toggle: (id: string, token: string) =>
    request<{ isActive: boolean }>(`/api/admin/stamp-rallies/${id}/toggle`, {
      method: 'PATCH',
      token,
    }),
};

// ==============================
// ユーザー Auth
// ==============================
export const userAuthApi = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, name }) }
    ),

  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  createGuest: () =>
    request<{ token: string; user: { id: string; name: string; isGuest: boolean } }>(
      '/api/auth/guest',
      { method: 'POST' }
    ),
};

// ==============================
// ユーザー スタンプラリー
// ==============================
export const userApi = {
  getRallyByToken: (shareToken: string) =>
    request<{ rally: import('@/types').StampRally }>(`/api/rallies/${shareToken}`),

  joinRally: (shareToken: string, token: string) =>
    request<{ participation: import('@/types').Participation; alreadyJoined?: boolean }>(
      `/api/rallies/${shareToken}/join`,
      { method: 'POST', token }
    ),

  getMyParticipations: (token: string) =>
    request<{ participations: import('@/types').Participation[] }>('/api/my/participations', {
      token,
    }),

  getParticipation: (id: string, token: string) =>
    request<{ participation: import('@/types').Participation }>(`/api/my/participations/${id}`, {
      token,
    }),

  pressStamp: (
    data: { participationId: string; locationId: string; latitude: number; longitude: number },
    token: string
  ) =>
    request<{ stamp: import('@/types').Stamp; completed: boolean }>('/api/stamps', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
};

export { ApiError };

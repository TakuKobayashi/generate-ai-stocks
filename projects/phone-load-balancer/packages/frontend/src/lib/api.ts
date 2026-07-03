// API client for communicating with the Hono backend

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as T;
}

// Auth
export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; username: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    setup: (username: string, password: string) =>
      request<{ message: string }>("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
  },

  tenants: {
    list: () => request<Tenant[]>("/api/tenants"),
    get: (id: number) => request<Tenant>(`/api/tenants/${id}`),
    create: (data: { name: string; vonageNumber?: string; vonageAppId?: string }) =>
      request<Tenant>("/api/tenants", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      id: number,
      data: { name?: string; vonageNumber?: string; vonageAppId?: string; isActive?: boolean }
    ) =>
      request<Tenant>(`/api/tenants/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      request<{ message: string }>(`/api/tenants/${id}`, { method: "DELETE" }),
  },

  forwardNumbers: {
    list: (tenantId: number) =>
      request<ForwardNumber[]>(`/api/tenants/${tenantId}/forward-numbers`),
    create: (tenantId: number, data: { phoneNumber: string; priority: number }) =>
      request<ForwardNumber>(`/api/tenants/${tenantId}/forward-numbers`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (
      tenantId: number,
      id: number,
      data: { phoneNumber?: string; priority?: number; isActive?: boolean }
    ) =>
      request<ForwardNumber>(`/api/tenants/${tenantId}/forward-numbers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (tenantId: number, id: number) =>
      request<{ message: string }>(
        `/api/tenants/${tenantId}/forward-numbers/${id}`,
        { method: "DELETE" }
      ),
  },

  callLogs: {
    list: (params?: { tenantId?: number; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.tenantId) q.set("tenantId", String(params.tenantId));
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.offset) q.set("offset", String(params.offset));
      return request<CallLog[]>(`/api/call-logs?${q}`);
    },
    active: () => request<CallLeg[]>("/api/call-logs/active"),
  },
};

// Types
export type Tenant = {
  id: number;
  name: string;
  vonageNumber: string | null;
  vonageAppId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ForwardNumber = {
  id: number;
  tenantId: number;
  phoneNumber: string;
  priority: number;
  status: "idle" | "busy" | "unavailable";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CallLog = {
  id: number;
  tenantId: number | null;
  callerNumber: string;
  vonageNumber: string;
  forwardedTo: string | null;
  outcome: string;
  durationSeconds: number | null;
  createdAt: string;
};

export type CallLeg = {
  id: number;
  tenantId: number;
  inboundConversationId: string;
  callerNumber: string;
  forwardNumberId: number | null;
  outboundCallUuid: string | null;
  status: "ringing" | "connected" | "queued" | "completed" | "failed";
  queuePosition: number | null;
  createdAt: string;
  updatedAt: string;
};

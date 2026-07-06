"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, saveAuth, clearAuth, getStoredUser, isTokenExpired, type AuthUser } from "./api";

type AuthCtx = { user: AuthUser | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void>; isRole: (...roles: string[]) => boolean };
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      if (isTokenExpired()) {
        const rt = localStorage.getItem("refreshToken");
        if (rt) {
          api.auth.refresh(rt).then((res) => {
            if (res.success) { localStorage.setItem("accessToken", res.data.accessToken); localStorage.setItem("accessExpiresAt", String(res.data.accessExpiresAt)); setUser(stored); }
            else clearAuth();
            setLoading(false);
          });
          return;
        }
      } else setUser(stored);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (!res.success) throw new Error(res.error.message);
    saveAuth(res.data); setUser(res.data.user);
  };
  const logout = async () => {
    const rt = localStorage.getItem("refreshToken");
    if (rt) await api.auth.logout(rt).catch(() => {});
    clearAuth(); setUser(null);
  };
  const isRole = (...roles: string[]) => !!user && roles.includes(user.role);
  return <Ctx.Provider value={{ user, loading, login, logout, isRole }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { registerUser } from '@/lib/api';

export interface User {
  id: string;
  name: string;
}

const STORAGE_KEY = 'nomikai_user';

function storageGet(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function storageSet(user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

// SW の Cache Storage にも userId を保存（Service Worker が参照できるように）
async function persistUserIdToCache(userId: string) {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open('nomikai-user');
    await cache.put('user-id', new Response(userId));
  } catch {}
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = storageGet();
    setUser(stored);
    if (stored) persistUserIdToCache(stored.id);
    setLoading(false);
  }, []);

  const register = useCallback(async (name: string): Promise<User> => {
    const id = crypto.randomUUID();
    await registerUser(id, name);
    const u: User = { id, name };
    storageSet(u);
    await persistUserIdToCache(id);
    setUser(u);
    return u;
  }, []);

  const updateName = useCallback((name: string) => {
    if (!user) return;
    const updated = { ...user, name };
    storageSet(updated);
    setUser(updated);
  }, [user]);

  return { user, loading, register, updateName };
}

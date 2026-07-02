"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { status, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // ── Password login ──────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed");
        return;
      }

      await refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  // ── Passkey login ───────────────────────────────────────────────────────────
  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyLoading(true);

    try {
      // 1. Get challenge
      const startRes = await fetch("/api/auth/passkey/auth/start", {
        method: "POST",
        credentials: "include",
      });
      if (!startRes.ok) {
        setError("Failed to start passkey auth");
        return;
      }
      const options = await startRes.json();

      // 2. Invoke browser WebAuthn
      const assertion = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
          allowCredentials: options.allowCredentials.map((c: { id: string; type: string }) => ({
            ...c,
            id: Uint8Array.from(atob(c.id.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
          })),
        },
      }) as PublicKeyCredential | null;

      if (!assertion) {
        setError("Passkey cancelled");
        return;
      }

      const ar = assertion.response as AuthenticatorAssertionResponse;

      const toBase64url = (buf: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(buf)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

      // 3. Finish
      const finishRes = await fetch("/api/auth/passkey/auth/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: assertion.id,
          rawId: toBase64url(assertion.rawId),
          response: {
            clientDataJSON: toBase64url(ar.clientDataJSON),
            authenticatorData: toBase64url(ar.authenticatorData),
            signature: toBase64url(ar.signature),
            userHandle: ar.userHandle ? toBase64url(ar.userHandle) : null,
          },
        }),
      });

      if (!finishRes.ok) {
        const data = await finishRes.json();
        setError(data.error ?? "Passkey verification failed");
        return;
      }

      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>GitHub KV Chat</h1>
        <p className={styles.subtitle}>Sign in to continue</p>

        {status?.hasPasskey && (
          <button
            className={styles.passkeyButton}
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? "Verifying…" : "🔑 Sign in with Passkey"}
          </button>
        )}

        {status?.hasPasskey && (
          <div className={styles.divider}>
            <span>or use password</span>
          </div>
        )}

        <form onSubmit={handlePasswordLogin} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import styles from "./PasskeyRegister.module.css";

export function PasskeyRegister({ onDone }: { onDone: () => void }) {
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toBase64url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  const handleRegister = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1. Get registration options from server
      const startRes = await fetch("/api/auth/passkey/register/start", {
        method: "POST",
        credentials: "include",
      });
      if (!startRes.ok) {
        setError("Failed to start passkey registration");
        return;
      }
      const options = await startRes.json();

      // 2. Call browser WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(
            atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0)
          ),
          user: {
            ...options.user,
            id: Uint8Array.from(
              atob(options.user.id.replace(/-/g, "+").replace(/_/g, "/")),
              (c) => c.charCodeAt(0)
            ),
          },
        },
      }) as PublicKeyCredential | null;

      if (!credential) {
        setError("Registration cancelled");
        return;
      }

      const ar = credential.response as AuthenticatorAttestationResponse;

      // 3. Send to server
      const finishRes = await fetch("/api/auth/passkey/register/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: credential.id,
          rawId: toBase64url(credential.rawId),
          response: {
            clientDataJSON: toBase64url(ar.clientDataJSON),
            attestationObject: toBase64url(ar.attestationObject),
          },
        }),
      });

      if (!finishRes.ok) {
        const data = await finishRes.json();
        setError(data.error ?? "Registration failed");
        return;
      }

      setDone(true);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>Register a Passkey</h2>

        {done ? (
          <>
            <p className={styles.success}>
              ✅ Passkey registered! You can now sign in with your device biometrics.
            </p>
            <button className={styles.button} onClick={onDone}>
              Continue
            </button>
          </>
        ) : (
          <>
            <p className={styles.description}>
              Register a passkey to sign in quickly using Face ID, Touch ID, or
              your device PIN — no password needed next time.
            </p>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <button
                className={styles.button}
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? "Registering…" : "🔑 Register Passkey"}
              </button>
              <button
                className={styles.skipButton}
                onClick={onDone}
                disabled={loading}
              >
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { LoginPage } from "./LoginPage";
import { PasskeyRegister } from "./PasskeyRegister";
import { ChatRuntimeProvider } from "@/lib/chat-runtime";
import { ChatThread } from "./ChatThread";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { status, loading, refresh } = useAuth();
  // Show passkey registration modal after first-ever login
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);

  useEffect(() => {
    if (
      status?.authenticated &&
      !status.hasPasskey &&
      !sessionStorage.getItem("passkey_prompt_shown")
    ) {
      setShowPasskeyModal(true);
      sessionStorage.setItem("passkey_prompt_shown", "1");
    }
  }, [status]);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <span className={styles.spinner} />
      </div>
    );
  }

  if (!status?.authenticated) {
    return <LoginPage />;
  }

  return (
    <>
      {showPasskeyModal && (
        <PasskeyRegister onDone={() => setShowPasskeyModal(false)} />
      )}

      <div className={styles.layout}>
        <header className={styles.header}>
          <span className={styles.logo}>⚡ GitHub KV Chat</span>
          <button
            className={styles.logoutButton}
            onClick={async () => {
              await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
              });
              refresh();
            }}
          >
            Sign out
          </button>
        </header>

        <main className={styles.main}>
          <ChatRuntimeProvider>
            <ChatThread />
          </ChatRuntimeProvider>
        </main>
      </div>
    </>
  );
}

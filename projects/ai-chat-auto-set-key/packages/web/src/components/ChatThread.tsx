"use client";

import {
  Thread,
  ThreadWelcome,
  Composer,
  type FC,
} from "@assistant-ui/react";
import styles from "./ChatThread.module.css";

export function ChatThread() {
  return (
    <div className={styles.wrapper}>
      <Thread.Root className={styles.thread}>
        <Thread.Viewport className={styles.viewport}>
          <ThreadWelcome />
          <Thread.Messages />
          <Thread.ScrollToBottom />
        </Thread.Viewport>

        <Composer.Root className={styles.composer}>
          <Composer.Input
            className={styles.composerInput}
            placeholder="メッセージを入力… (Enter で送信)"
            autoFocus
          />
          <Composer.Send className={styles.sendButton}>
            <SendIcon />
          </Composer.Send>
        </Composer.Root>
      </Thread.Root>
    </div>
  );
}

const SendIcon: FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import RoomModal from "@/components/RoomModal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Message, Room } from "@chat-app/shared";

type ConnStatus = "disconnected" | "connecting" | "connected";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP");
}

interface SystemMsg {
  id: string;
  text: string;
  type: "system";
}
type ChatItem = Message | SystemMsg;
function isSystem(item: ChatItem): item is SystemMsg {
  return (item as SystemMsg).type === "system";
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const { user, token } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [wsUrl, setWsUrl] = useState("");
  const [editWsUrl, setEditWsUrl] = useState("");
  const [status, setStatus] = useState<ConnStatus>("disconnected");
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Set default WS URL
  useEffect(() => {
    if (typeof window !== "undefined" && roomId && token) {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const host = window.location.host;
      const defaultUrl = `${proto}://${host}/ws/${roomId}?token=${token}`;
      setWsUrl(defaultUrl);
      setEditWsUrl(defaultUrl);
    }
  }, [roomId, token]);

  // Fetch room info
  useEffect(() => {
    if (roomId) {
      api.rooms.get(roomId).then((r) => setRoom(r.data)).catch(() => {});
    }
  }, [roomId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect to WS
  const connect = useCallback(
    (url: string) => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (!url) return;

      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("connected");
        addSystem("接続しました");
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "history") {
            setMessages((prev) => {
              const sys = prev.filter(isSystem);
              return [...(msg.data as Message[]), ...sys];
            });
          } else if (msg.type === "message") {
            setMessages((prev) => [...prev, msg.data as Message]);
          } else if (msg.type === "join") {
            addSystem(`${msg.data.displayName} が参加しました`);
          } else if (msg.type === "leave") {
            addSystem(`${msg.data.displayName} が退出しました`);
          }
        } catch {}
      };

      ws.onclose = () => {
        setStatus("disconnected");
        wsRef.current = null;
      };

      ws.onerror = () => {
        setStatus("disconnected");
      };
    },
    []
  );

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("disconnected");
    addSystem("切断しました");
  }, []);

  // Auto-connect on wsUrl change
  useEffect(() => {
    if (wsUrl) connect(wsUrl);
    return () => { wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  // Ping keepalive
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);
    return () => clearInterval(interval);
  }, []);

  function addSystem(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text, type: "system" },
    ]);
  }

  function sendMessage() {
    if (!input.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", content: input.trim() }));
    setInput("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function applyWsUrl() {
    setWsUrl(editWsUrl);
  }

  // Group consecutive messages from same user
  const grouped: { sender: string; items: ChatItem[] }[] = [];
  for (const item of messages) {
    if (isSystem(item)) {
      grouped.push({ sender: "__system__", items: [item] });
    } else {
      const last = grouped[grouped.length - 1];
      if (last && !isSystem(last.items[0]) && (last.items[0] as Message).userId === item.userId) {
        last.items.push(item);
      } else {
        grouped.push({ sender: item.userId, items: [item] });
      }
    }
  }

  const statusLabel =
    status === "connected" ? "接続中" : status === "connecting" ? "接続中..." : "未接続";
  const statusClass =
    status === "connected" ? "status-connected" : status === "connecting" ? "status-connecting" : "status-disconnected";

  return (
    <AppShell>
      <div className="chat-layout">
        {/* Header */}
        <div className="chat-header">
          <div style={{ flex: 1 }}>
            <h2>#{room?.name ?? roomId}</h2>
            {room?.description && (
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>{room.description}</p>
            )}
          </div>
          <div className={`connection-status ${statusClass}`}>
            <div className="status-dot" />
            {statusLabel}
          </div>
          {user?.id === room?.createdBy && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)} title="編集" type="button">✏️</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(true)} title="削除" type="button" style={{ color: "var(--danger)" }}>🗑️</button>
            </>
          )}
          {status === "connected" ? (
            <button className="btn btn-secondary btn-sm" onClick={disconnect} type="button">切断</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => connect(wsUrl)} disabled={!wsUrl || status === "connecting"} type="button">
              接続
            </button>
          )}
        </div>

        {/* WS URL bar */}
        <div className="ws-connect-bar">
          <span className="ws-url-label">WS URL:</span>
          <input
            className="input"
            style={{ fontSize: 12, padding: "6px 10px" }}
            value={editWsUrl}
            onChange={(e) => setEditWsUrl(e.target.value)}
            placeholder="ws://localhost:8787/ws/room-id"
            onKeyDown={(e) => e.key === "Enter" && applyWsUrl()}
          />
          <button className="btn btn-secondary btn-sm" onClick={applyWsUrl} type="button">接続</button>
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && status === "connected" && (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3>まだメッセージはありません</h3>
              <p>最初のメッセージを送ってみましょう</p>
            </div>
          )}

          {grouped.map((group, gi) => {
            if (group.sender === "__system__") {
              return group.items.map((item) => (
                <div key={(item as SystemMsg).id} className="system-message">
                  {(item as SystemMsg).text}
                </div>
              ));
            }

            const firstMsg = group.items[0] as Message;
            const isOwn = firstMsg.userId === user?.id;

            return (
              <div key={gi} className={`message-row ${isOwn ? "own" : ""}`}>
                {!isOwn && (
                  <div className="msg-avatar">
                    {firstMsg.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="msg-content">
                  <div className="msg-meta">
                    {!isOwn && <strong>{firstMsg.displayName}</strong>}{" "}
                    {formatTime(firstMsg.createdAt)}
                  </div>
                  {group.items.map((item) => {
                    const m = item as Message;
                    return (
                      <div key={m.id} className={`msg-bubble ${isOwn ? "own" : "other"}`}>
                        {m.content}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              className="input"
              placeholder={
                status === "connected"
                  ? `#${room?.name ?? "..."} にメッセージを送信 (Enter で送信)`
                  : "接続していません"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={status !== "connected"}
              rows={1}
            />
            <button
              className="btn btn-primary"
              onClick={sendMessage}
              disabled={!input.trim() || status !== "connected"}
              type="button"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {showEdit && room && (
        <RoomModal
          editRoom={room}
          onClose={() => setShowEdit(false)}
          onCreated={() => {}}
          onUpdated={() => {
            setShowEdit(false);
            api.rooms.get(roomId).then((r) => setRoom(r.data)).catch(() => {});
          }}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ルームを削除</h3>
            </div>
            <p style={{ color: "var(--text-2)", fontSize: 14 }}>
              このルームとすべてのメッセージを削除しますか？
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} type="button">
                キャンセル
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await api.rooms.delete(roomId);
                  window.location.href = "/rooms";
                }}
                type="button"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

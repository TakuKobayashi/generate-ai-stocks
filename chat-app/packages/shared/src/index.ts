export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface Passkey {
  id: string;
  userId: string;
  credentialId: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

// WebSocket message types
export type WSMessageType =
  | 'message'
  | 'join'
  | 'leave'
  | 'history'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
}

export interface WSChatMessage extends WSMessage {
  type: 'message';
  data: Message;
}

export interface WSHistoryMessage extends WSMessage {
  type: 'history';
  data: Message[];
}

export interface WSJoinMessage extends WSMessage {
  type: 'join';
  data: { userId: string; displayName: string };
}

export interface WSLeaveMessage extends WSMessage {
  type: 'leave';
  data: { userId: string; displayName: string };
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

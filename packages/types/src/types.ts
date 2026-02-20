// --- Presence & Cursor ---

export type OnlineStatus = "online" | "away" | "offline";

export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
  onlineStatus: OnlineStatus;
  lastActiveAt: number;
  isIdle: boolean;
  avatarUrl?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface CursorData {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  lastUpdate: number;
  viewportPos?: { x: number; y: number };
  viewportScale?: number;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

// --- Wire Protocol Messages ---

export interface PresenceMessage {
  type: "presence";
  users: PresenceUser[];
}

export interface CursorUpdateMessage {
  type: "cursor:update";
  cursor: CursorData;
}

export interface ClientCursorMessage {
  type: "cursor:update";
  x: number;
  y: number;
  viewportPos?: { x: number; y: number };
  viewportScale?: number;
}

export interface PresenceUpdateMessage {
  type: "presence:update";
  onlineStatus?: OnlineStatus;
  isIdle?: boolean;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatMessage {
  type: "heartbeat";
}

// --- Live State ---

export interface LiveStateUpdateMessage {
  type: "state:update";
  key: string;
  value: unknown;
  timestamp: number;
  merge?: boolean;
}

export interface LiveStateInitMessage {
  type: "state:init";
  states: Record<string, { value: unknown; timestamp: number; userId: string }>;
}

export interface LiveStateUpdateBroadcast {
  type: "state:update";
  key: string;
  value: unknown;
  timestamp: number;
  userId: string;
}

import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";

// Re-export shared types from @waits/openblocks-types
export type {
  PresenceUser,
  CursorData,
  ConnectionStatus,
  PresenceMessage,
  CursorUpdateMessage,
  ClientCursorMessage,
  StorageOp,
  SerializedCrdt,
  StorageInitMessage,
  StorageOpsMessage,
} from "@waits/openblocks-types";

import type { PresenceUser, StorageOp, SerializedCrdt } from "@waits/openblocks-types";

// --- Auth ---

export interface AuthHandler {
  authenticate(
    req: IncomingMessage
  ): Promise<{ userId: string; displayName: string } | null>;
}

// --- Config ---

export interface RoomConfig {
  cleanupTimeoutMs?: number;
  maxConnections?: number;
}

export interface ServerConfig {
  port?: number;
  path?: string;
  auth?: AuthHandler;
  roomConfig?: RoomConfig;
  onMessage?: OnMessageHandler;
  onJoin?: OnJoinHandler;
  onLeave?: OnLeaveHandler;
  onStorageChange?: OnStorageChangeHandler;
  initialStorage?: InitialStorageHandler;
}

// --- Storage Callbacks ---

export type OnStorageChangeHandler = (
  roomId: string,
  ops: StorageOp[]
) => void | Promise<void>;

export type InitialStorageHandler = (
  roomId: string
) => Promise<SerializedCrdt | null>;

// --- Callbacks ---

export type OnMessageHandler = (
  roomId: string,
  senderId: string,
  message: Record<string, unknown>
) => void | Promise<void>;

export type OnJoinHandler = (
  roomId: string,
  user: PresenceUser
) => void | Promise<void>;

export type OnLeaveHandler = (
  roomId: string,
  user: PresenceUser
) => void | Promise<void>;

// --- Internal ---

export interface Connection {
  ws: WebSocket;
  user: PresenceUser;
}

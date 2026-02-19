export { OpenBlocksClient } from "./client.js";
export type { ClientConfig, JoinRoomOptions } from "./client.js";

export { Room } from "./room.js";
export type { RoomConfig } from "./room.js";

export { ConnectionManager } from "./connection.js";
export type { ConnectionConfig } from "./connection.js";

export { EventEmitter } from "./event-emitter.js";
export { throttle } from "./throttle.js";

// Re-export shared types
export type {
  PresenceUser,
  CursorData,
  ConnectionStatus,
  PresenceMessage,
  CursorUpdateMessage,
  ClientCursorMessage,
} from "@waits/openblocks-types";

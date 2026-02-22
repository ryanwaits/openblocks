export { LivelyClient } from "./client.js";
export type { ClientConfig, JoinRoomOptions } from "./client.js";

export { Room } from "./room.js";
export type { RoomConfig } from "./room.js";

export { ConnectionManager } from "./connection.js";
export type { ConnectionConfig } from "./connection.js";

export { ActivityTracker } from "./activity-tracker.js";
export type { ActivityTrackerConfig } from "./activity-tracker.js";

export { EventEmitter } from "./event-emitter.js";
export { throttle } from "./throttle.js";

// Re-export shared types
export type {
  OnlineStatus,
  PresenceUser,
  CursorData,
  ConnectionStatus,
  PresenceMessage,
  CursorUpdateMessage,
  ClientCursorMessage,
} from "@waits/lively-types";

// Re-export storage types
export {
  LiveObject,
  LiveMap,
  LiveList,
  StorageDocument,
  AbstractCrdt,
} from "@waits/lively-storage";

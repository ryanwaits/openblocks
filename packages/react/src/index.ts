// Providers
export { OpenBlocksProvider, useClient } from "./client-context.js";
export type { OpenBlocksProviderProps } from "./client-context.js";
export { RoomProvider, useRoom, useIsInsideRoom, useStorageRoot } from "./room-context.js";
export type { RoomProviderProps } from "./room-context.js";

// Utilities
export { shallowEqual } from "./shallow-equal.js";

// Presence + connection hooks
export { useStatus, useLostConnectionListener, useSyncStatus } from "./use-status.js";
export type { SyncStatus } from "./use-status.js";
export { useSelf } from "./use-self.js";
export { useOthers, useOther, useOthersMapped, useOthersUserIds } from "./use-others.js";
export { useMyPresence, useUpdateMyPresence } from "./use-my-presence.js";
export type { PresenceUpdatePayload } from "./use-my-presence.js";
export { useOthersListener } from "./use-others-listener.js";
export type { OthersEvent } from "./use-others-listener.js";

// Storage hooks
export { useStorage } from "./use-storage.js";
export { useMutation } from "./use-mutation.js";
export { useBatch } from "./use-batch.js";

// CRDT shorthand hooks
export { useObject, useMap, useList } from "./use-crdt-shortcuts.js";

// Cursor + event hooks
export { useCursors, useUpdateCursor } from "./use-cursors.js";
export { useBroadcastEvent } from "./use-broadcast-event.js";
export { useEventListener } from "./use-event-listener.js";

// Follow mode
export { useFollowUser } from "./use-follow-user.js";
export type { UseFollowUserOptions, UseFollowUserReturn } from "./use-follow-user.js";

// Error listener
export { useErrorListener } from "./use-error-listener.js";

// Presence hooks
export { useOthersOnLocation, usePresenceEvent } from "./use-presence-event.js";

// Live state hooks
export { useLiveState, useLiveStateData, useSetLiveState } from "./use-live-state.js";

// Undo/redo hooks
export { useUndo, useRedo, useCanUndo, useCanRedo, useHistory } from "./use-undo-redo.js";

// Factory
export { createRoomContext } from "./create-room-context.js";

// SSR helper
export { ClientSideSuspense } from "./client-side-suspense.js";

// Re-export CRDT types for convenience
export {
  LiveObject,
  LiveMap,
  LiveList,
} from "@waits/openblocks-client";

// Re-export client types
export type {
  OnlineStatus,
  ConnectionStatus,
  PresenceUser,
  CursorData,
} from "@waits/openblocks-types";

// Providers
export { OpenBlocksProvider, useClient } from "./client-context.js";
export type { OpenBlocksProviderProps } from "./client-context.js";
export { RoomProvider, useRoom, useStorageRoot } from "./room-context.js";
export type { RoomProviderProps } from "./room-context.js";

// Utilities
export { shallowEqual } from "./shallow-equal.js";

// Presence + connection hooks
export { useStatus, useLostConnectionListener } from "./use-status.js";
export { useSelf } from "./use-self.js";
export { useOthers, useOther, useOthersMapped } from "./use-others.js";

// Storage hooks
export { useStorage } from "./use-storage.js";
export { useMutation } from "./use-mutation.js";

// Cursor + event hooks
export { useCursors, useUpdateCursor } from "./use-cursors.js";
export { useBroadcastEvent } from "./use-broadcast-event.js";
export { useEventListener } from "./use-event-listener.js";

// Presence hooks
export { useOthersOnLocation, usePresenceEvent } from "./use-presence-event.js";

// Live state hooks
export { useLiveState, useLiveStateData, useSetLiveState } from "./use-live-state.js";

// Undo/redo hooks
export { useUndo, useRedo, useCanUndo, useCanRedo, useHistory } from "./use-undo-redo.js";

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

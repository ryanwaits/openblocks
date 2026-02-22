import { useSyncExternalStore, useCallback, useRef, useContext } from "react";
import type { LiveObject, LiveMap, LiveList } from "@waits/lively-client";
import { useRoom, useStorageRoot, StorageContext } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

// Re-export all non-storage hooks for single-import convenience
export { useStatus, useLostConnectionListener, useSyncStatus } from "./use-status.js";
export type { SyncStatus } from "./use-status.js";
export { useSelf } from "./use-self.js";
export { useOthers, useOthersMapped, useOthersUserIds } from "./use-others.js";
export { useMyPresence, useUpdateMyPresence } from "./use-my-presence.js";
export type { PresenceUpdatePayload } from "./use-my-presence.js";
export { useOthersListener } from "./use-others-listener.js";
export type { OthersEvent } from "./use-others-listener.js";
export { useMutation } from "./use-mutation.js";
export { useBatch } from "./use-batch.js";
export { useCursors, useUpdateCursor } from "./use-cursors.js";
export { useBroadcastEvent } from "./use-broadcast-event.js";
export { useEventListener } from "./use-event-listener.js";
export { useErrorListener } from "./use-error-listener.js";
export { useOthersOnLocation, usePresenceEvent } from "./use-presence-event.js";
export { useLiveState, useLiveStateData, useSetLiveState } from "./use-live-state.js";
export { useUndo, useRedo, useCanUndo, useCanRedo, useHistory } from "./use-undo-redo.js";
export { createRoomContext } from "./create-room-context.js";
export { ClientSideSuspense } from "./client-side-suspense.js";
export { useIsInsideRoom } from "./room-context.js";

// Re-export providers
export { LivelyProvider, useClient } from "./client-context.js";
export { RoomProvider, useRoom, useStorageRoot } from "./room-context.js";
export { LiveObject, LiveMap, LiveList } from "@waits/lively-client";
export type { ConnectionStatus, PresenceUser, CursorData, OnlineStatus } from "@waits/lively-types";

export function useStorageSuspense<T>(
  selector: (root: LiveObject) => T
): T {
  const room = useRoom();
  const storage = useContext(StorageContext);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<T | undefined>(undefined);

  // If storage not loaded, throw room.getStorage() promise.
  // This resolves externally when storage initializes, which also causes
  // RoomProvider to set StorageContext — so on retry, storage will be non-null.
  if (!storage) {
    throw room.getStorage().then(() => {});
  }

  return useSyncExternalStore(
    useCallback(
      (cb) => room.subscribe(storage.root, () => cb(), { isDeep: true }),
      [room, storage]
    ),
    useCallback(() => {
      const next = selectorRef.current(storage.root);
      if (cache.current !== undefined && shallowEqual(cache.current, next)) {
        return cache.current;
      }
      cache.current = next;
      return next;
    }, [storage]),
    () => {
      throw new Error("useStorageSuspense cannot be used during SSR");
    }
  );
}

/**
 * Suspense version of `useObject`. Throws a promise while storage loads.
 */
export function useObjectSuspense<T extends Record<string, unknown>>(
  key: string
): LiveObject<T> {
  return useStorageSuspense((root) => root.get(key) as LiveObject<T>);
}

/**
 * Suspense version of `useMap`. Throws a promise while storage loads.
 */
export function useMapSuspense<V>(
  key: string
): LiveMap<string, V> {
  return useStorageSuspense((root) => root.get(key) as LiveMap<string, V>);
}

/**
 * Suspense version of `useList`. Throws a promise while storage loads.
 */
export function useListSuspense<T>(
  key: string
): LiveList<T> {
  return useStorageSuspense((root) => root.get(key) as LiveList<T>);
}

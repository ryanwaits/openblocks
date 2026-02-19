import { useSyncExternalStore, useCallback, useRef, useContext } from "react";
import type { LiveObject } from "@waits/openblocks-client";
import { useRoom, useStorageRoot, StorageContext } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

// Re-export all non-storage hooks for single-import convenience
export { useStatus, useLostConnectionListener } from "./use-status.js";
export { useSelf } from "./use-self.js";
export { useOthers, useOthersMapped } from "./use-others.js";
export { useMutation } from "./use-mutation.js";
export { useCursors, useUpdateCursor } from "./use-cursors.js";
export { useBroadcastEvent } from "./use-broadcast-event.js";
export { useEventListener } from "./use-event-listener.js";

// Re-export providers
export { OpenBlocksProvider, useClient } from "./client-context.js";
export { RoomProvider, useRoom, useStorageRoot } from "./room-context.js";
export { LiveObject, LiveMap, LiveList } from "@waits/openblocks-client";
export type { ConnectionStatus, PresenceUser, CursorData } from "@waits/openblocks-types";

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

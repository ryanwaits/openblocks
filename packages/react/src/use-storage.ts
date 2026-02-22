import { useSyncExternalStore, useCallback, useRef } from "react";
import type { LiveObject } from "@waits/lively-client";
import { useRoom, useStorageRoot } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

/**
 * Reads a value from the room's shared CRDT storage via a selector.
 * Returns `null` while storage is loading (before the first `storage:init`).
 * Re-renders only when the selected value changes (shallow-equal check).
 *
 * @param selector - Pure function mapping the storage root to the desired slice
 *
 * @example
 * const count = useStorage(root => root.get("count") as number);
 * if (count === null) return <div>Loading...</div>;
 */
export function useStorage<T>(
  selector: (root: LiveObject) => T
): T | null {
  const room = useRoom();
  const storage = useStorageRoot();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<T | null>(null);

  return useSyncExternalStore(
    useCallback(
      (cb) => {
        if (!storage) return () => {};
        return room.subscribe(storage.root, () => cb(), { isDeep: true });
      },
      [room, storage]
    ),
    useCallback(() => {
      if (!storage) return null;
      const next = selectorRef.current(storage.root);
      if (shallowEqual(cache.current, next)) return cache.current;
      cache.current = next;
      return next;
    }, [storage]),
    () => null
  );
}

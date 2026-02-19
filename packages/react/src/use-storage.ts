import { useSyncExternalStore, useCallback, useRef } from "react";
import type { LiveObject } from "@waits/openblocks-client";
import { useRoom, useStorageRoot } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

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

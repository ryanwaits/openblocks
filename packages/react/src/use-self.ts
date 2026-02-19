import { useSyncExternalStore, useCallback, useRef } from "react";
import type { PresenceUser } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

/**
 * Returns the current user's own presence data (userId, displayName, color).
 * Returns `null` before the first presence broadcast from the server.
 * Re-renders only when the self object changes (shallow-equal check).
 *
 * @example
 * const self = useSelf();
 * if (!self) return null;
 * return <Avatar user={self} />;
 */
export function useSelf(): PresenceUser | null {
  const room = useRoom();
  const cache = useRef<PresenceUser | null>(null);

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const next = room.getSelf();
      if (shallowEqual(cache.current, next)) return cache.current;
      cache.current = next;
      return next;
    }, [room]),
    () => null
  );
}

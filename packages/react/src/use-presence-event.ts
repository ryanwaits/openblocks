import { useSyncExternalStore, useCallback, useRef, useEffect } from "react";
import type { PresenceUser } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

function shallowEqualArray(a: PresenceUser[], b: PresenceUser[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!shallowEqual(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Returns other users at a specific location.
 * Subscribes to presence changes and filters by `location` field.
 */
export function useOthersOnLocation(locationId: string): PresenceUser[] {
  const room = useRoom();
  const cache = useRef<PresenceUser[]>([]);

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const next = (room as any).getOthersOnLocation(locationId);
      if (shallowEqualArray(cache.current, next)) return cache.current;
      cache.current = next;
      return next;
    }, [room, locationId]),
    () => [] as PresenceUser[]
  );
}

/**
 * Fires callback when another user's presence state changes.
 * The callback receives `(user, prevStatus, newStatus)`.
 */
export function usePresenceEvent(
  event: "stateChange",
  callback: (
    user: PresenceUser,
    prevStatus: string,
    newStatus: string
  ) => void
): void {
  const room = useRoom();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const prevUsersRef = useRef<Map<string, PresenceUser>>(new Map());

  useEffect(() => {
    const unsub = room.subscribe("presence", (users: PresenceUser[]) => {
      const prevMap = prevUsersRef.current;
      const nextMap = new Map<string, PresenceUser>();

      for (const user of users) {
        nextMap.set(user.userId, user);
        const prev = prevMap.get(user.userId);
        if (prev && prev.onlineStatus !== user.onlineStatus) {
          callbackRef.current(user, prev.onlineStatus, user.onlineStatus);
        }
      }

      prevUsersRef.current = nextMap;
    });

    return unsub;
  }, [room]);
}

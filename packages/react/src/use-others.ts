import { useSyncExternalStore, useCallback, useRef } from "react";
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

export function useOthers(): PresenceUser[] {
  const room = useRoom();
  const cache = useRef<PresenceUser[]>([]);

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const next = room.getOthers();
      if (shallowEqualArray(cache.current, next)) return cache.current;
      cache.current = next;
      return next;
    }, [room]),
    () => [] as PresenceUser[]
  );
}

export function useOthersMapped<T>(
  selector: (user: PresenceUser) => T
): T[] {
  const room = useRoom();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<{ users: PresenceUser[]; mapped: T[] }>({
    users: [],
    mapped: [],
  });

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const others = room.getOthers();
      const prev = cache.current;

      // Quick check: same length + same user references
      if (
        others.length === prev.users.length &&
        others.every((u, i) => shallowEqual(u, prev.users[i]))
      ) {
        return prev.mapped;
      }

      const mapped = others.map((u) => selectorRef.current(u));
      cache.current = { users: others, mapped };
      return mapped;
    }, [room]),
    () => [] as T[]
  );
}

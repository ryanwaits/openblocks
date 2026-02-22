import { useSyncExternalStore, useCallback, useRef } from "react";
import type { PresenceUser } from "@waits/lively-types";
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
 * Returns an array of all other users currently in the room.
 * Re-renders only when the list of others changes (shallow-equal check).
 *
 * @example
 * const others = useOthers();
 * others.forEach(u => console.log(u.displayName));
 */
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

/**
 * Returns a single other user by userId, with an optional selector to
 * extract a slice of their data. Returns `null` if the user is not found.
 * Re-renders when the selected value changes (shallow-equal check).
 *
 * @param userId - The userId of the user to observe
 * @param selector - Optional transform applied to the user before returning
 *
 * @example
 * const name = useOther("abc", u => u.displayName); // string | null
 * const user = useOther("abc"); // PresenceUser | null
 */
export function useOther<T = PresenceUser>(
  userId: string,
  selector?: (u: PresenceUser) => T
): T | null {
  const room = useRoom();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const cache = useRef<T | null>(null);

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const user = room.getOthers().find((u) => u.userId === userId);
      if (!user) {
        cache.current = null;
        return null;
      }
      const next = selectorRef.current
        ? selectorRef.current(user)
        : (user as unknown as T);
      if (shallowEqual(cache.current, next)) return cache.current;
      cache.current = next;
      return next;
    }, [room, userId]),
    () => null
  );
}

/**
 * Returns a mapped array derived from all other users in the room.
 * Re-renders only when the mapped output changes, not on every presence tick.
 *
 * @param selector - Transform applied to each user
 *
 * @example
 * const names = useOthersMapped(u => u.displayName);
 */
/**
 * Returns a sorted array of userIds for all other users in the room.
 * Only re-renders on join/leave — NOT on presence data changes.
 *
 * @example
 * const ids = useOthersUserIds();
 * ids.map(id => <Cursor key={id} userId={id} />);
 */
export function useOthersUserIds(): string[] {
  const room = useRoom();
  const cache = useRef<string[]>([]);

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("presence", () => cb()), [room]),
    useCallback(() => {
      const next = room.getOthers().map((u) => u.userId).sort();
      const prev = cache.current;
      if (
        prev.length === next.length &&
        prev.every((id, i) => id === next[i])
      ) {
        return prev;
      }
      cache.current = next;
      return next;
    }, [room]),
    () => [] as string[]
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

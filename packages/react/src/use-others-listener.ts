import { useEffect, useRef } from "react";
import type { PresenceUser } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";
import { shallowEqual } from "./shallow-equal.js";

export type OthersEvent =
  | { type: "enter"; user: PresenceUser; others: PresenceUser[] }
  | { type: "leave"; user: PresenceUser; others: PresenceUser[] }
  | { type: "update"; user: PresenceUser; others: PresenceUser[] };

/**
 * Fires a callback whenever another user enters, leaves, or updates their
 * presence. The callback receives a discriminated `OthersEvent`.
 *
 * Uses a callbackRef pattern — no stale closure issues.
 *
 * @example
 * useOthersListener(event => {
 *   if (event.type === "enter") toast(`${event.user.displayName} joined`);
 * });
 */
export function useOthersListener(
  callback: (event: OthersEvent) => void
): void {
  const room = useRoom();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const prevUsersRef = useRef<Map<string, PresenceUser>>(new Map());

  useEffect(() => {
    const unsub = room.subscribe("presence", () => {
      const nextOthers = room.getOthers();
      const nextMap = new Map(nextOthers.map((u) => [u.userId, u]));
      const prev = prevUsersRef.current;

      // Detect enters and updates
      for (const [userId, user] of nextMap) {
        const prevUser = prev.get(userId);
        if (!prevUser) {
          callbackRef.current({ type: "enter", user, others: nextOthers });
        } else if (!shallowEqual(prevUser, user)) {
          callbackRef.current({ type: "update", user, others: nextOthers });
        }
      }

      // Detect leaves
      for (const [userId, user] of prev) {
        if (!nextMap.has(userId)) {
          callbackRef.current({ type: "leave", user, others: nextOthers });
        }
      }

      prevUsersRef.current = nextMap;
    });
    return unsub;
  }, [room]);
}

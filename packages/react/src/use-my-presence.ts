import { useCallback } from "react";
import type { PresenceUser, OnlineStatus } from "@waits/lively-types";
import { useRoom } from "./room-context.js";
import { useSelf } from "./use-self.js";

export type PresenceUpdatePayload = {
  location?: string;
  metadata?: Record<string, unknown>;
  onlineStatus?: OnlineStatus;
};

/**
 * Returns a stable function to update the current user's presence data.
 *
 * @example
 * const updatePresence = useUpdateMyPresence();
 * updatePresence({ location: "page-1" });
 */
export function useUpdateMyPresence(): (data: Partial<PresenceUpdatePayload>) => void {
  const room = useRoom();
  return useCallback(
    (data: Partial<PresenceUpdatePayload>) => room.updatePresence(data),
    [room]
  );
}

/**
 * Returns a `[self, updatePresence]` tuple — convenience wrapper combining
 * `useSelf()` and `useUpdateMyPresence()`.
 *
 * @example
 * const [me, updatePresence] = useMyPresence();
 * if (me) updatePresence({ location: "settings" });
 */
export function useMyPresence(): [PresenceUser | null, (data: Partial<PresenceUpdatePayload>) => void] {
  const self = useSelf();
  const update = useUpdateMyPresence();
  return [self, update];
}

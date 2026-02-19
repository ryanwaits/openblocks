import { useCallback } from "react";
import { useRoom } from "./room-context.js";

/**
 * Returns a stable function to broadcast a custom event to all other users
 * in the room. Events are ephemeral — not persisted to storage.
 * Pair with `useEventListener` on the receiving end.
 *
 * @example
 * const broadcast = useBroadcastEvent<{ type: "ping" }>();
 * broadcast({ type: "ping" });
 */
export function useBroadcastEvent<
  T extends { type: string } = { type: string; [key: string]: unknown }
>(): (event: T) => void {
  const room = useRoom();
  return useCallback(
    (event: T) => room.send(event),
    [room]
  );
}

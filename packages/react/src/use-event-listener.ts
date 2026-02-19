import { useEffect, useRef } from "react";
import { useRoom } from "./room-context.js";

/**
 * Subscribes to custom events broadcast by other users via `useBroadcastEvent`.
 * The callback is stored in a ref so it never needs to be in a dep array.
 *
 * @param callback - Called with each incoming event
 *
 * @example
 * useEventListener<{ type: "ping" }>(event => {
 *   if (event.type === "ping") console.log("got ping");
 * });
 */
export function useEventListener<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  callback: (event: T) => void
): void {
  const room = useRoom();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsub = room.subscribe("message", (msg) => {
      callbackRef.current(msg as T);
    });
    return unsub;
  }, [room]);
}

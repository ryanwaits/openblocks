import { useEffect, useRef } from "react";
import { useRoom } from "./room-context.js";

export function useEventListener(
  callback: (event: Record<string, unknown>) => void
): void {
  const room = useRoom();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsub = room.subscribe("message", (msg) => {
      callbackRef.current(msg);
    });
    return unsub;
  }, [room]);
}

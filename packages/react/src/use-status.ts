import { useSyncExternalStore, useCallback, useEffect, useRef } from "react";
import type { ConnectionStatus } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";

export function useStatus(): ConnectionStatus {
  const room = useRoom();
  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("status", () => cb()), [room]),
    useCallback(() => room.getStatus(), [room]),
    () => "disconnected" as ConnectionStatus
  );
}

export function useLostConnectionListener(
  callback: () => void
): void {
  const room = useRoom();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const prevStatusRef = useRef<ConnectionStatus | null>(null);

  useEffect(() => {
    const unsub = room.subscribe("status", (status) => {
      if (
        status === "reconnecting" &&
        prevStatusRef.current === "connected"
      ) {
        callbackRef.current();
      }
      prevStatusRef.current = status;
    });
    return unsub;
  }, [room]);
}

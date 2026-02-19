import { useCallback } from "react";
import { useRoom } from "./room-context.js";

export function useBroadcastEvent(): (
  event: { type: string; [key: string]: unknown }
) => void {
  const room = useRoom();
  return useCallback(
    (event: { type: string; [key: string]: unknown }) => room.send(event),
    [room]
  );
}

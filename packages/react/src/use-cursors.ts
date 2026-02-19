import { useSyncExternalStore, useCallback, useRef } from "react";
import type { CursorData } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";

export function useCursors(): Map<string, CursorData> {
  const room = useRoom();
  const cache = useRef<Map<string, CursorData>>(new Map());

  return useSyncExternalStore(
    useCallback((cb) => room.subscribe("cursors", () => cb()), [room]),
    useCallback(() => {
      const next = room.getCursors();
      if (next.size === cache.current.size) {
        // Quick identity check — cursors change often, map reference always new
        let same = true;
        for (const [k, v] of next) {
          const prev = cache.current.get(k);
          if (!prev || prev.x !== v.x || prev.y !== v.y) {
            same = false;
            break;
          }
        }
        if (same) return cache.current;
      }
      cache.current = next;
      return next;
    }, [room]),
    () => new Map<string, CursorData>()
  );
}

export function useUpdateCursor(): (x: number, y: number) => void {
  const room = useRoom();
  // Stable ref — room.updateCursor is already bound
  return useCallback((x: number, y: number) => room.updateCursor(x, y), [room]);
}

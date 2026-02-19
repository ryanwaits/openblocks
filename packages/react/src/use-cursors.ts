import { useSyncExternalStore, useCallback, useRef } from "react";
import type { CursorData } from "@waits/openblocks-types";
import { useRoom } from "./room-context.js";

/**
 * Returns a Map of all cursor positions in the room, keyed by userId.
 * Includes the current user's own cursor. Re-renders only when cursor
 * positions actually change (position-aware equality check).
 *
 * @example
 * const cursors = useCursors();
 * cursors.forEach((c, userId) => console.log(userId, c.x, c.y));
 */
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

/**
 * Returns a stable function to broadcast the current user's cursor position.
 * Coordinates should be relative to the container you want to track cursors within.
 *
 * @example
 * const updateCursor = useUpdateCursor();
 * <div onMouseMove={e => updateCursor(e.clientX, e.clientY)} />
 */
export function useUpdateCursor(): (x: number, y: number) => void {
  const room = useRoom();
  // Stable ref — room.updateCursor is already bound
  return useCallback((x: number, y: number) => room.updateCursor(x, y), [room]);
}

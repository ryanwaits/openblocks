import { useRef, useCallback } from "react";
import type { RefObject } from "react";
import { useUpdateCursor } from "@waits/lively-react";

/**
 * Returns a `ref` to attach to your container element and an `onMouseMove`
 * handler. Cursor coordinates are computed relative to the container's
 * bounding box and broadcast to the room automatically.
 *
 * Attach both to the same element that wraps `<CursorOverlay>`.
 *
 * @example
 * const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();
 * return <div ref={ref} onMouseMove={onMouseMove}><CursorOverlay />{children}</div>
 */
export function useCursorTracking<T extends HTMLElement>(): {
  ref: RefObject<T>;
  onMouseMove: (e: React.MouseEvent) => void;
} {
  const ref = useRef<T>(null);
  const updateCursor = useUpdateCursor();

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      updateCursor(e.clientX - rect.left, e.clientY - rect.top);
    },
    [updateCursor]
  );

  return { ref, onMouseMove };
}

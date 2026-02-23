import { useRef, useCallback } from "react";
import type { RefObject } from "react";
import { useUpdateCursor } from "@waits/lively-react";

function detectCursorType(e: MouseEvent): "default" | "text" | "pointer" {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el) return "default";
  const cursor = getComputedStyle(el).cursor;
  if (cursor === "text") return "text";
  if (cursor === "pointer") return "pointer";
  return "default";
}

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
  const lastTarget = useRef<Element | null>(null);
  const lastCursorType = useRef<"default" | "text" | "pointer">("default");
  const updateCursor = useUpdateCursor();

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const target = document.elementFromPoint(e.clientX, e.clientY);
      let cursorType = lastCursorType.current;
      if (target !== lastTarget.current) {
        lastTarget.current = target;
        cursorType = detectCursorType(e.nativeEvent);
        lastCursorType.current = cursorType;
      }
      updateCursor(e.clientX - rect.left, e.clientY - rect.top, undefined, undefined, cursorType);
    },
    [updateCursor]
  );

  return { ref, onMouseMove };
}

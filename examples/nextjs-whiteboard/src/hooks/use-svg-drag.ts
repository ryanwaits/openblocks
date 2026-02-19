import { useRef, useCallback } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";

interface UseSvgDragOptions {
  id: string;
  objectX: number;
  objectY: number;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  enabled?: boolean;
}

/**
 * Provides pointer-based drag behavior for SVG shape elements.
 * Uses window-level pointermove/pointerup for smooth dragging at any zoom level.
 */
export function useSvgDrag({ id, objectX, objectY, onDragMove, onDragEnd, enabled = true }: UseSvgDragOptions) {
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startObjX: number;
    startObjY: number;
    scale: number;
  } | null>(null);

  const onDragMoveRef = useRef(onDragMove);
  onDragMoveRef.current = onDragMove;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const handleWindowPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.scale;
    const dy = (e.clientY - d.startClientY) / d.scale;
    onDragMoveRef.current?.(id, d.startObjX + dx, d.startObjY + dy);
  }, [id]);

  const handleWindowPointerUp = useCallback((e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.scale;
    const dy = (e.clientY - d.startClientY) / d.scale;
    onDragEndRef.current?.(id, d.startObjX + dx, d.startObjY + dy);
    dragRef.current = null;
    window.removeEventListener("pointermove", handleWindowPointerMove);
    window.removeEventListener("pointerup", handleWindowPointerUp);
  }, [id, handleWindowPointerMove]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    e.stopPropagation();
    const scale = useViewportStore.getState().scale;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startObjX: objectX,
      startObjY: objectY,
      scale,
    };
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
  }, [enabled, objectX, objectY, handleWindowPointerMove, handleWindowPointerUp]);

  return { onPointerDown };
}

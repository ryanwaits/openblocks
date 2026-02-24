"use client";

import { useRef, useCallback, useEffect } from "react";
import { screenToCanvas } from "@/lib/canvas-utils";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { useBoardStore } from "@/lib/store/board-store";
import { NODE_WIDTH, getNodeHeight } from "@/components/nodes/base-node";

const MIN_DRAG_PX = 5;

export function useMarqueeSelect(svgElement: SVGSVGElement | null) {
  const startRef = useRef<{ canvasX: number; canvasY: number } | null>(null);
  const justMarqueedRef = useRef(false);

  /** Expose so board page can check if a marquee just finished */
  const didJustMarquee = useCallback(() => {
    if (justMarqueedRef.current) {
      justMarqueedRef.current = false;
      return true;
    }
    return false;
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      const tool = useCanvasInteractionStore.getState().tool;
      const pm = useCanvasInteractionStore.getState().placementMode;
      if (tool !== "select" || pm) return;

      // Only start marquee on empty canvas area
      const target = e.target as SVGElement;
      if (target.closest("[data-node-id]") || target.closest("[data-node-port]")) return;
      // Skip if clicking on foreignObject content (badges etc)
      if (target instanceof HTMLElement && target.closest("foreignObject")) return;

      const svg = svgElement;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
      startRef.current = { canvasX: canvasPos.x, canvasY: canvasPos.y };
    },
    [svgElement],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!startRef.current) return;
      const svg = svgElement;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const cur = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);

      const x = Math.min(startRef.current.canvasX, cur.x);
      const y = Math.min(startRef.current.canvasY, cur.y);
      const w = Math.abs(cur.x - startRef.current.canvasX);
      const h = Math.abs(cur.y - startRef.current.canvasY);

      if (w > MIN_DRAG_PX || h > MIN_DRAG_PX) {
        useCanvasInteractionStore.getState().setMarqueeRect({ x, y, w, h });
      }
    },
    [svgElement],
  );

  const handlePointerUp = useCallback(() => {
    if (!startRef.current) return;

    const marquee = useCanvasInteractionStore.getState().marqueeRect;
    if (marquee && (marquee.w > MIN_DRAG_PX || marquee.h > MIN_DRAG_PX)) {
      // Find nodes intersecting the marquee rect
      const nodes = useBoardStore.getState().nodes;
      const matched = new Set<string>();
      for (const node of nodes.values()) {
        const nw = NODE_WIDTH;
        const nh = getNodeHeight(node);
        const nx = node.position.x;
        const ny = node.position.y;
        // Check AABB intersection
        if (
          nx + nw > marquee.x &&
          nx < marquee.x + marquee.w &&
          ny + nh > marquee.y &&
          ny < marquee.y + marquee.h
        ) {
          matched.add(node.id);
        }
      }
      if (matched.size > 0) {
        useBoardStore.getState().setSelectedNodeIds(matched);
      }
      justMarqueedRef.current = true;
    }

    startRef.current = null;
    useCanvasInteractionStore.getState().setMarqueeRect(null);
  }, []);

  useEffect(() => {
    if (!svgElement) return;
    svgElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      svgElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [svgElement, handlePointerDown, handlePointerMove, handlePointerUp]);

  return { didJustMarquee };
}

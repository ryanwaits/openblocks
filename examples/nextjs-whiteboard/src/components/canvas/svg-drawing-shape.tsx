"use client";

import { memo, useCallback, useRef } from "react";
import { catmullRomToSvgPath } from "@/lib/geometry/catmull-rom";
import { useViewportStore } from "@/lib/store/viewport-store";
import type { BoardObject } from "@/types/board";

interface DrawingShapeProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  interactive?: boolean;
  scale: number;
}

export const SvgDrawingShape = memo(function SvgDrawingShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd, interactive = true,
}: DrawingShapeProps) {
  const bodyDragRef = useRef<{
    startPoints: Array<{ x: number; y: number }>;
    startClientX: number;
    startClientY: number;
    scale: number;
  } | null>(null);

  const points = object.points ?? [];
  if (points.length < 2) return null;

  const pathD = catmullRomToSvgPath(points);
  const strokeColor = object.stroke_color || "#374151";
  const strokeWidth = object.stroke_width || 2;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(id, e.shiftKey);
    if (!interactive || (!onDragMove && !onDragEnd) || !object.points) return;

    const scale = useViewportStore.getState().scale;
    const startX = object.x;
    const startY = object.y;
    bodyDragRef.current = {
      startPoints: [...object.points],
      startClientX: e.clientX,
      startClientY: e.clientY,
      scale,
    };

    const handleMove = (ev: PointerEvent) => {
      const d = bodyDragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      onDragMove?.(id, startX + dx, startY + dy);
    };

    const handleUp = (ev: PointerEvent) => {
      const d = bodyDragRef.current;
      if (!d) { cleanup(); return; }
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      onDragEnd?.(id, startX + dx, startY + dy);
      bodyDragRef.current = null;
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [id, onSelect, interactive, onDragMove, onDragEnd, object.points]);

  return (
    <g
      onPointerDown={handlePointerDown}
      style={{ cursor: interactive ? "move" : "default" }}
    >
      {/* Selection highlight */}
      {isSelected && (
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={strokeWidth + 6}
          opacity={0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {/* Invisible hit area */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main stroke */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
    </g>
  );
});

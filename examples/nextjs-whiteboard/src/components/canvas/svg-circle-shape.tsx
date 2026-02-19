"use client";

import { memo } from "react";
import { useSvgDrag } from "@/hooks/use-svg-drag";
import { SvgResizeHandles } from "./svg-resize-handles";
import type { BoardObject } from "@/types/board";

interface CircleShapeProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  interactive?: boolean;
  scale?: number;
}

export const SvgCircleShape = memo(function SvgCircleShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd,
  onResize, onResizeEnd, interactive = true, scale = 1,
}: CircleShapeProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const rx = object.width / 2;
  const ry = object.height / 2;
  const { onPointerDown } = useSvgDrag({ id, objectX: object.x, objectY: object.y, onDragMove, onDragEnd, enabled: interactive });

  return (
    <g
      transform={`translate(${cx},${cy}) rotate(${object.rotation || 0})`}
      onPointerDown={(e) => {
        onSelect?.(id, e.shiftKey);
        onPointerDown(e);
      }}
      style={{ cursor: interactive ? "move" : "default" }}
    >
      {/* Selection ring */}
      {isSelected && (
        <ellipse
          cx={0}
          cy={0}
          rx={rx + 3}
          ry={ry + 3}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* Shape */}
      <ellipse
        cx={0}
        cy={0}
        rx={rx}
        ry={ry}
        fill={object.color}
        stroke="#94a3b8"
        strokeWidth={1}
        filter="url(#shadow-sm)"
      />

      {/* Resize handles */}
      {isSelected && interactive && onResize && onResizeEnd && (
        <SvgResizeHandles
          width={object.width}
          height={object.height}
          scale={scale}
          rotation={object.rotation}
          objectX={object.x}
          objectY={object.y}
          onResize={(updates) => onResize(id, updates)}
          onResizeEnd={(updates) => onResizeEnd(id, updates)}
        />
      )}
    </g>
  );
});

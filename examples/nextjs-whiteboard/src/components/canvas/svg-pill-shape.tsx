"use client";

import { memo } from "react";
import { useSvgDrag } from "@/hooks/use-svg-drag";
import { SvgResizeHandles } from "./svg-resize-handles";
import { SvgRotationHandle } from "./svg-rotation-handle";
import type { BoardObject } from "@/types/board";

interface PillShapeProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onRotate?: (id: string, rotation: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
  interactive?: boolean;
  scale?: number;
}

export const SvgPillShape = memo(function SvgPillShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd,
  onResize, onResizeEnd, onRotate, onRotateEnd,
  interactive = true, scale = 1,
}: PillShapeProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const cornerRadius = Math.min(object.width, object.height) / 2;
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
        <rect
          x={-object.width / 2 - 3}
          y={-object.height / 2 - 3}
          width={object.width + 6}
          height={object.height + 6}
          rx={cornerRadius + 3}
          ry={cornerRadius + 3}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* Shape */}
      <rect
        x={-object.width / 2}
        y={-object.height / 2}
        width={object.width}
        height={object.height}
        rx={cornerRadius}
        ry={cornerRadius}
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

      {/* Rotation handle */}
      {isSelected && interactive && onRotate && onRotateEnd && (
        <SvgRotationHandle
          width={object.width}
          height={object.height}
          scale={scale}
          rotation={object.rotation || 0}
          objectX={object.x}
          objectY={object.y}
          onRotate={(r) => onRotate(id, r)}
          onRotateEnd={(r) => onRotateEnd(id, r)}
        />
      )}
    </g>
  );
});

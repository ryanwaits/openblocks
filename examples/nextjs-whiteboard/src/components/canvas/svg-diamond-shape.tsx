"use client";

import { memo } from "react";
import { useSvgDrag } from "@/hooks/use-svg-drag";
import { SvgResizeHandles } from "./svg-resize-handles";
import { SvgRotationHandle } from "./svg-rotation-handle";
import type { BoardObject } from "@/types/board";

interface DiamondShapeProps {
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

export const SvgDiamondShape = memo(function SvgDiamondShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd,
  onResize, onResizeEnd, onRotate, onRotateEnd,
  interactive = true, scale = 1,
}: DiamondShapeProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const w = object.width;
  const h = object.height;
  const hw = w / 2;
  const hh = h / 2;

  const points = `0,${-hh} ${hw},0 0,${hh} ${-hw},0`;
  const selPoints = `0,${-hh - 3} ${hw + 3},0 0,${hh + 3} ${-hw - 3},0`;

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
        <polygon
          points={selPoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* Shape */}
      <polygon
        points={points}
        fill={object.color}
        stroke="#94a3b8"
        strokeWidth={1}
        filter="url(#shadow-sm)"
      />

      {/* Resize handles */}
      {isSelected && interactive && onResize && onResizeEnd && (
        <SvgResizeHandles
          width={w}
          height={h}
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
          width={w}
          height={h}
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

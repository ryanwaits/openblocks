"use client";

import { memo } from "react";
import { Rect, Group } from "react-konva";
import type Konva from "konva";
import { ResizeHandles } from "./resize-handles";
import type { BoardObject } from "@/types/board";

interface RectangleShapeProps {
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

export const RectangleShape = memo(function RectangleShape({
  id,
  object,
  isSelected,
  onSelect,
  onDragMove,
  onDragEnd,
  onResize,
  onResizeEnd,
  interactive = true,
  scale = 1,
}: RectangleShapeProps) {
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragMove?.(id, node.x(), node.y());
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd?.(id, node.x(), node.y());
  };

  return (
    <Group
      x={object.x}
      y={object.y}
      draggable={interactive}
      listening={interactive}
      onClick={(e) => onSelect?.(id, e.evt.shiftKey)}
      onTap={() => onSelect?.(id)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={object.width + 6}
          height={object.height + 6}
          stroke="#3b82f6"
          strokeWidth={2}
          dash={[6, 3]}
        />
      )}
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color}
        stroke="#94a3b8"
        strokeWidth={1}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.1)"
        shadowBlur={4}
        shadowOffsetY={1}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      {isSelected && interactive && onResize && onResizeEnd && (
        <ResizeHandles
          width={object.width}
          height={object.height}
          scale={scale}
          onResize={(updates) => onResize(id, updates)}
          onResizeEnd={(updates) => onResizeEnd(id, updates)}
          visible
        />
      )}
    </Group>
  );
});

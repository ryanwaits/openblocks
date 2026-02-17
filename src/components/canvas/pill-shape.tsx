"use client";

import { memo } from "react";
import { Rect, Group } from "react-konva";
import type Konva from "konva";
import { ResizeHandles } from "./resize-handles";
import { RotationHandle } from "./rotation-handle";
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

export const PillShape = memo(function PillShape({
  id,
  object,
  isSelected,
  onSelect,
  onDragMove,
  onDragEnd,
  onResize,
  onResizeEnd,
  onRotate,
  onRotateEnd,
  interactive = true,
  scale = 1,
}: PillShapeProps) {
  const cornerRadius = Math.min(object.width, object.height) / 2;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragMove?.(id, node.x() - node.offsetX(), node.y() - node.offsetY());
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd?.(id, node.x() - node.offsetX(), node.y() - node.offsetY());
  };

  return (
    <Group
      x={object.x + object.width / 2}
      y={object.y + object.height / 2}
      offsetX={object.width / 2}
      offsetY={object.height / 2}
      rotation={object.rotation || 0}
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
          cornerRadius={cornerRadius + 3}
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
        cornerRadius={cornerRadius}
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
          rotation={object.rotation}
          objectX={object.x}
          objectY={object.y}
          onResize={(updates) => onResize(id, updates)}
          onResizeEnd={(updates) => onResizeEnd(id, updates)}
          visible
        />
      )}
      {isSelected && interactive && onRotate && onRotateEnd && (
        <RotationHandle
          width={object.width}
          height={object.height}
          scale={scale}
          rotation={object.rotation || 0}
          onRotate={(r) => onRotate(id, r)}
          onRotateEnd={(r) => onRotateEnd(id, r)}
          visible
        />
      )}
    </Group>
  );
});

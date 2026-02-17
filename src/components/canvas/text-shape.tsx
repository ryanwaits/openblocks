"use client";

import { memo } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { ResizeHandles } from "./resize-handles";
import type { BoardObject } from "@/types/board";

interface TextShapeProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDoubleClick?: (id: string) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  interactive?: boolean;
  isEditing?: boolean;
  scale?: number;
}

export const TextShape = memo(function TextShape({
  id,
  object,
  isSelected,
  onSelect,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onResize,
  onResizeEnd,
  interactive = true,
  isEditing = false,
  scale = 1,
}: TextShapeProps) {
  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragMove?.(id, e.target.x(), e.target.y());
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd?.(id, e.target.x(), e.target.y());
  };

  return (
    <Group
      x={object.x}
      y={object.y}
      draggable={interactive}
      onClick={() => onSelect?.(id)}
      onTap={() => onSelect?.(id)}
      onDblClick={() => onDoubleClick?.(id)}
      onDblTap={() => onDoubleClick?.(id)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Selection border — only when selected */}
      {isSelected && (
        <Rect
          width={object.width}
          height={object.height}
          stroke="#3b82f6"
          strokeWidth={1.5}
          dash={[6, 3]}
          cornerRadius={4}
        />
      )}
      {/* Text */}
      {!isEditing && (
        <Text
          width={object.width}
          height={object.height}
          text={object.text || "Type something..."}
          fontSize={16}
          fontFamily="Inter, sans-serif"
          fill={object.text ? (object.text_color || "#1f2937") : "#9ca3af"}
          fontStyle={[object.font_weight === "bold" ? "bold" : "", object.font_style === "italic" ? "italic" : ""].filter(Boolean).join(" ") || "normal"}
          textDecoration={object.text_decoration || "none"}
          verticalAlign="middle"
          align={object.text_align || "left"}
          wrap="word"
        />
      )}
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

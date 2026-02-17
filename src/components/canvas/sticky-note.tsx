"use client";

import { memo } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { ResizeHandles } from "./resize-handles";
import type { BoardObject } from "@/types/board";

interface StickyNoteProps {
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

const PADDING = 12;

export const StickyNote = memo(function StickyNote({
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
}: StickyNoteProps) {
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
      onClick={() => onSelect?.(id)}
      onTap={() => onSelect?.(id)}
      onDblClick={() => onDoubleClick?.(id)}
      onDblTap={() => onDoubleClick?.(id)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {/* Selection ring */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={object.width + 6}
          height={object.height + 6}
          stroke="#3b82f6"
          strokeWidth={2}
          cornerRadius={10}
          dash={[6, 3]}
        />
      )}
      {/* Shadow */}
      <Rect
        width={object.width}
        height={object.height}
        fill={object.color}
        cornerRadius={8}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={8}
        shadowOffsetY={2}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
      />
      {/* Text */}
      {!isEditing && (
        <Text
          x={PADDING}
          y={PADDING}
          width={object.width - PADDING * 2}
          height={object.height - PADDING * 2}
          text={object.text || "Click to edit"}
          fontSize={14}
          fontFamily="Inter, sans-serif"
          fill={object.text ? (object.text_color || "#1f2937") : "#9ca3af"}
          fontStyle={[object.font_weight === "bold" ? "bold" : "", object.font_style === "italic" ? "italic" : ""].filter(Boolean).join(" ") || "normal"}
          textDecoration={object.text_decoration || "none"}
          verticalAlign="top"
          align={object.text_align || "left"}
          wrap="word"
          ellipsis
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

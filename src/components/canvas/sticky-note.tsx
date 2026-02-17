"use client";

import { memo } from "react";
import { Group, Rect, Text } from "react-konva";
import type Konva from "konva";
import { ResizeHandles } from "./resize-handles";
import { RotationHandle } from "./rotation-handle";
import type { BoardObject } from "@/types/board";

interface StickyNoteProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDoubleClick?: (id: string) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onRotate?: (id: string, rotation: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
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
  onRotate,
  onRotateEnd,
  interactive = true,
  isEditing = false,
  scale = 1,
}: StickyNoteProps) {
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
      {/* Creator name */}
      {object.created_by_name && (
        <Text
          x={PADDING}
          y={object.height - PADDING - 12}
          width={object.width - PADDING * 2}
          text={object.created_by_name}
          fontSize={10}
          fontFamily="Inter, sans-serif"
          fill="rgba(0,0,0,0.25)"
          align="right"
          listening={false}
        />
      )}
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

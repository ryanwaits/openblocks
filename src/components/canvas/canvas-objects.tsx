"use client";

import { memo } from "react";
import { StickyNote } from "./sticky-note";
import { RectangleShape } from "./rectangle-shape";
import { TextShape } from "./text-shape";
import type { BoardObject } from "@/types/board";

interface CanvasObjectsProps {
  objects: Map<string, BoardObject>;
  selectedIds: Set<string>;
  onSelect: (id: string | null) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  interactive?: boolean;
  editingId?: string | null;
  scale?: number;
}

export const CanvasObjects = memo(function CanvasObjects({
  objects,
  selectedIds,
  onSelect,
  onDragMove,
  onDragEnd,
  onDoubleClick,
  onResize,
  onResizeEnd,
  interactive = true,
  editingId,
  scale = 1,
}: CanvasObjectsProps) {
  const sorted = Array.from(objects.values()).sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {sorted.map((obj) => {
        const shared = {
          id: obj.id,
          object: obj,
          isSelected: selectedIds.has(obj.id),
          onSelect: interactive ? onSelect : undefined,
          onDragMove: interactive ? onDragMove : undefined,
          onDragEnd: interactive ? onDragEnd : undefined,
          interactive,
        };

        switch (obj.type) {
          case "sticky":
            return (
              <StickyNote
                key={obj.id}
                {...shared}
                onDoubleClick={interactive ? onDoubleClick : undefined}
                isEditing={editingId === obj.id}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "rectangle":
            return (
              <RectangleShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "text":
            return (
              <TextShape
                key={obj.id}
                {...shared}
                onDoubleClick={interactive ? onDoubleClick : undefined}
                isEditing={editingId === obj.id}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
});

"use client";

import { memo } from "react";
import { StickyNote } from "./sticky-note";
import { RectangleShape } from "./rectangle-shape";
import { TextShape } from "./text-shape";
import { CircleShape } from "./circle-shape";
import { DiamondShape } from "./diamond-shape";
import { PillShape } from "./pill-shape";
import { LineShape } from "./line-shape";
import type { BoardObject } from "@/types/board";

interface CanvasObjectsProps {
  objects: Map<string, BoardObject>;
  selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onLineUpdate?: (id: string, updates: Partial<BoardObject>) => void;
  onLineUpdateEnd?: (id: string, updates: Partial<BoardObject>) => void;
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
  onLineUpdate,
  onLineUpdateEnd,
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
          case "circle":
            return (
              <CircleShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "diamond":
            return (
              <DiamondShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "pill":
            return (
              <PillShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "line":
            return (
              <LineShape
                key={obj.id}
                id={obj.id}
                object={obj}
                objects={objects}
                isSelected={selectedIds.has(obj.id)}
                onSelect={interactive ? onSelect : undefined}
                onLineUpdate={interactive ? onLineUpdate : undefined}
                onLineUpdateEnd={interactive ? onLineUpdateEnd : undefined}
                interactive={interactive}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
});

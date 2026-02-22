"use client";

import { memo } from "react";
import { SvgStickyNote } from "./svg-sticky-note";
import { SvgRectangleShape } from "./svg-rectangle-shape";
import { SvgTextShape } from "./svg-text-shape";
import { SvgCircleShape } from "./svg-circle-shape";
import { SvgDiamondShape } from "./svg-diamond-shape";
import { SvgPillShape } from "./svg-pill-shape";
import { SvgLineShape } from "./svg-line-shape";
import { SvgDrawingShape } from "./svg-drawing-shape";
import { SvgEmojiShape } from "./svg-emoji-shape";
import { useViewportStore } from "@/lib/store/viewport-store";
import type { BoardObject } from "@/types/board";

import { RENDER_TIER } from "@/lib/geometry/render-tiers";

interface CanvasObjectsProps {
  objects: Map<string, BoardObject>;
  selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClick: (id: string) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onRotate?: (id: string, rotation: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
  onLineUpdate?: (id: string, updates: Partial<BoardObject>) => void;
  onLineUpdateEnd?: (id: string, updates: Partial<BoardObject>) => void;
  interactive?: boolean;
  editingId?: string | null;
}

export const CanvasObjects = memo(function CanvasObjects({
  objects, selectedIds, onSelect, onDragMove, onDragEnd, onDoubleClick,
  onResize, onResizeEnd, onRotate, onRotateEnd,
  onLineUpdate, onLineUpdateEnd,
  interactive = true, editingId,
}: CanvasObjectsProps) {
  const scale = useViewportStore((s) => s.scale);
  const sorted = Array.from(objects.values()).sort((a, b) => {
    const tierA = RENDER_TIER[a.type] ?? 1;
    const tierB = RENDER_TIER[b.type] ?? 1;
    if (tierA !== tierB) return tierA - tierB;
    return a.z_index - b.z_index;
  });

  return (
    <g>
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
              <SvgStickyNote
                key={obj.id}
                {...shared}
                onDoubleClick={interactive ? onDoubleClick : undefined}
                isEditing={editingId === obj.id}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                onRotate={interactive ? onRotate : undefined}
                onRotateEnd={interactive ? onRotateEnd : undefined}
                scale={scale}
              />
            );
          case "rectangle":
            return (
              <SvgRectangleShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                onRotate={interactive ? onRotate : undefined}
                onRotateEnd={interactive ? onRotateEnd : undefined}
                scale={scale}
              />
            );
          case "text":
            return (
              <SvgTextShape
                key={obj.id}
                {...shared}
                onDoubleClick={interactive ? onDoubleClick : undefined}
                isEditing={editingId === obj.id}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                onRotate={interactive ? onRotate : undefined}
                onRotateEnd={interactive ? onRotateEnd : undefined}
                scale={scale}
              />
            );
          case "circle":
            return (
              <SvgCircleShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          case "diamond":
            return (
              <SvgDiamondShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                onRotate={interactive ? onRotate : undefined}
                onRotateEnd={interactive ? onRotateEnd : undefined}
                scale={scale}
              />
            );
          case "pill":
            return (
              <SvgPillShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                onRotate={interactive ? onRotate : undefined}
                onRotateEnd={interactive ? onRotateEnd : undefined}
                scale={scale}
              />
            );
          case "line":
            return (
              <SvgLineShape
                key={obj.id}
                {...shared}
                objects={objects}
                onLineUpdate={interactive ? onLineUpdate : undefined}
                onLineUpdateEnd={interactive ? onLineUpdateEnd : undefined}
              />
            );
          case "drawing":
            return (
              <SvgDrawingShape
                key={obj.id}
                {...shared}
                scale={scale}
              />
            );
          case "emoji":
            return (
              <SvgEmojiShape
                key={obj.id}
                {...shared}
                onResize={interactive ? onResize : undefined}
                onResizeEnd={interactive ? onResizeEnd : undefined}
                scale={scale}
              />
            );
          default:
            return null;
        }
      })}
    </g>
  );
});

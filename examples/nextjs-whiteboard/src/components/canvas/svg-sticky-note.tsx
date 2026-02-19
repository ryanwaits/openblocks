"use client";

import { memo } from "react";
import { useSvgDrag } from "@/hooks/use-svg-drag";
import { SvgResizeHandles } from "./svg-resize-handles";
import { SvgRotationHandle } from "./svg-rotation-handle";
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

export const SvgStickyNote = memo(function SvgStickyNote({
  id, object, isSelected, onSelect, onDragMove, onDragEnd, onDoubleClick,
  onResize, onResizeEnd, onRotate, onRotateEnd,
  interactive = true, isEditing = false, scale = 1,
}: StickyNoteProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const hw = object.width / 2;
  const hh = object.height / 2;
  const { onPointerDown } = useSvgDrag({ id, objectX: object.x, objectY: object.y, onDragMove, onDragEnd, enabled: interactive });

  const fontStyle = [
    object.font_weight === "bold" ? "bold" : "",
    object.font_style === "italic" ? "italic" : "",
  ].filter(Boolean).join(" ") || "normal";

  return (
    <g
      transform={`translate(${cx},${cy}) rotate(${object.rotation || 0})`}
      onPointerDown={(e) => {
        onSelect?.(id, e.shiftKey);
        onPointerDown(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(id);
      }}
      style={{ cursor: interactive ? "move" : "default" }}
    >
      {/* Selection ring */}
      {isSelected && (
        <rect
          x={-hw - 3}
          y={-hh - 3}
          width={object.width + 6}
          height={object.height + 6}
          rx={10}
          ry={10}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 3"
        />
      )}

      {/* Background */}
      <rect
        x={-hw}
        y={-hh}
        width={object.width}
        height={object.height}
        rx={8}
        ry={8}
        fill={object.color}
        filter="url(#shadow-sm)"
      />

      {/* Text via foreignObject */}
      {!isEditing && (
        <foreignObject
          x={-hw + PADDING}
          y={-hh + PADDING}
          width={object.width - PADDING * 2}
          height={object.height - PADDING * 2}
          pointerEvents="none"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              fontStyle: object.font_style === "italic" ? "italic" : "normal",
              fontWeight: object.font_weight === "bold" ? "bold" : "normal",
              textDecoration: object.text_decoration || "none",
              textAlign: (object.text_align || "left") as React.CSSProperties["textAlign"],
              color: object.text ? (object.text_color || "#1f2937") : "#9ca3af",
              overflow: "hidden",
              wordBreak: "break-word",
              lineHeight: 1.4,
              userSelect: "none",
            }}
          >
            {object.text || "Click to edit"}
          </div>
        </foreignObject>
      )}

      {/* Creator name */}
      {object.created_by_name && (
        <foreignObject
          x={-hw + PADDING}
          y={hh - PADDING - 14}
          width={object.width - PADDING * 2}
          height={14}
          pointerEvents="none"
        >
          <div
            style={{
              width: "100%",
              fontSize: 10,
              fontFamily: "Inter, sans-serif",
              color: "rgba(0,0,0,0.25)",
              textAlign: "right",
              userSelect: "none",
            }}
          >
            {object.created_by_name}
          </div>
        </foreignObject>
      )}

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

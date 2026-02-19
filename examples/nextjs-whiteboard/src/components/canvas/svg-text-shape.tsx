"use client";

import { memo } from "react";
import { useSvgDrag } from "@/hooks/use-svg-drag";
import { SvgResizeHandles } from "./svg-resize-handles";
import { SvgRotationHandle } from "./svg-rotation-handle";
import type { BoardObject } from "@/types/board";

interface TextShapeProps {
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

export const SvgTextShape = memo(function SvgTextShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd, onDoubleClick,
  onResize, onResizeEnd, onRotate, onRotateEnd,
  interactive = true, isEditing = false, scale = 1,
}: TextShapeProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const hw = object.width / 2;
  const hh = object.height / 2;
  const { onPointerDown } = useSvgDrag({ id, objectX: object.x, objectY: object.y, onDragMove, onDragEnd, enabled: interactive });

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
      {/* Selection border */}
      {isSelected && (
        <rect
          x={-hw}
          y={-hh}
          width={object.width}
          height={object.height}
          rx={4}
          ry={4}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
      )}

      {/* Invisible hit area */}
      <rect
        x={-hw}
        y={-hh}
        width={object.width}
        height={object.height}
        fill="transparent"
      />

      {/* Text via foreignObject */}
      {!isEditing && (
        <foreignObject
          x={-hw}
          y={-hh}
          width={object.width}
          height={object.height}
          pointerEvents="none"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              fontSize: 16,
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
            <span style={{ width: "100%" }}>
              {object.text || "Type something..."}
            </span>
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

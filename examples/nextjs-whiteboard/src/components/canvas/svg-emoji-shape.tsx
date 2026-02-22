"use client";

import { memo, useCallback, useRef } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import { SvgResizeHandles } from "./svg-resize-handles";
import type { BoardObject } from "@/types/board";

interface StampShapeProps {
  id: string;
  object: BoardObject;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd?: (id: string, updates: { x: number; y: number; width: number; height: number }) => void;
  interactive?: boolean;
  scale: number;
}

export const STAMP_SIZE = 64;

interface StampConfig {
  display: string;
  fontSize: number;
  fill?: string;
  fontWeight?: number;
  animated?: boolean;
}

export const STAMP_CONFIGS: Record<string, StampConfig> = {
  thumbsup: { display: "\ud83d\udc4d", fontSize: 42 },
  heart: { display: "\u2764\ufe0f", fontSize: 42, animated: true },
  fire: { display: "\ud83d\udd25", fontSize: 42 },
  star: { display: "\u2b50", fontSize: 42 },
  eyes: { display: "\ud83d\udc40", fontSize: 42 },
  laughing: { display: "\ud83d\ude02", fontSize: 42 },
  party: { display: "\ud83c\udf89", fontSize: 42 },
  plusone: { display: "+1", fontSize: 30, fill: "#7c3aed", fontWeight: 800 },
};

export const STAMP_TYPES = Object.keys(STAMP_CONFIGS);

export const SvgEmojiShape = memo(function SvgEmojiShape({
  id, object, isSelected, onSelect, onDragMove, onDragEnd,
  onResize, onResizeEnd, interactive = true, scale,
}: StampShapeProps) {
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    scale: number;
  } | null>(null);

  const stampType = object.emoji_type || "thumbsup";
  const config = STAMP_CONFIGS[stampType] || STAMP_CONFIGS.thumbsup;

  // Use object dimensions, fall back to default STAMP_SIZE
  const w = object.width || STAMP_SIZE;
  const h = object.height || STAMP_SIZE;

  // Scale fontSize proportionally to size relative to default 64
  const sizeScale = Math.min(w, h) / STAMP_SIZE;
  const fontSize = config.fontSize * sizeScale;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect?.(id, e.shiftKey);
    if (!interactive || (!onDragMove && !onDragEnd)) return;

    const scale = useViewportStore.getState().scale;
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: object.x,
      startY: object.y,
      scale,
    };

    const handleMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      onDragMove?.(id, d.startX + dx, d.startY + dy);
    };

    const handleUp = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) { cleanup(); return; }
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      onDragEnd?.(id, d.startX + dx, d.startY + dy);
      dragRef.current = null;
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [id, onSelect, interactive, onDragMove, onDragEnd, object.x, object.y]);

  const cx = object.x + w / 2;
  const cy = object.y + h / 2;
  const textY = cy + fontSize * 0.33; // baseline offset

  return (
    <g>
      {/* Selection ring */}
      {isSelected && (
        <rect
          x={object.x - 3}
          y={object.y - 3}
          width={w + 6}
          height={h + 6}
          rx={6}
          ry={6}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="4 2"
          pointerEvents="none"
        />
      )}

      {/* Invisible hit area */}
      <rect
        x={object.x}
        y={object.y}
        width={w}
        height={h}
        fill="transparent"
        style={{ cursor: interactive ? "move" : "default" }}
        onPointerDown={handlePointerDown}
      />

      {/* Stamp: thick white outline sticker style */}
      {/* Animated stamps: translate group to emoji center so scale pulses in place */}
      <g pointerEvents="none" transform={config.animated ? `translate(${cx}, ${textY})` : undefined}>
        {config.animated && (
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1;1.08;1"
            dur="1.2s"
            repeatCount="indefinite"
            additive="sum"
          />
        )}
        {/* White outline layer */}
        <text
          x={config.animated ? 0 : cx}
          y={config.animated ? 0 : textY}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={config.fontWeight}
          stroke="white"
          strokeWidth={6 * sizeScale}
          strokeLinejoin="round"
          paintOrder="stroke"
          fill="none"
          style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.08))" }}
        >
          {config.display}
        </text>
        {/* Emoji fill layer */}
        <text
          x={config.animated ? 0 : cx}
          y={config.animated ? 0 : textY}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={config.fontWeight}
          fill={config.fill || undefined}
        >
          {config.display}
        </text>
      </g>

      {/* Resize handles — wrapped in center-translated group to match handle coordinate system */}
      {isSelected && interactive && onResize && onResizeEnd && (
        <g transform={`translate(${cx}, ${object.y + h / 2})`}>
          <SvgResizeHandles
            width={w}
            height={h}
            scale={scale}
            objectX={object.x}
            objectY={object.y}
            onResize={(updates) => onResize(id, updates)}
            onResizeEnd={(updates) => onResizeEnd(id, updates)}
          />
        </g>
      )}
    </g>
  );
});

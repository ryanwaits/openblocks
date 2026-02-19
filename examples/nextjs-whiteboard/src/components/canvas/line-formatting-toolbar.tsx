"use client";

import { ArrowRight, ArrowLeft, Minus } from "lucide-react";
import type { BoardObject } from "@/types/board";

interface LineFormattingToolbarProps {
  object: BoardObject;
  onUpdate: (updates: Partial<BoardObject>) => void;
  screenX: number;
  screenY: number;
  screenW: number;
}

const STROKE_COLORS = [
  "#374151", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899",
];

const STROKE_WIDTHS = [1, 2, 4];

export function LineFormattingToolbar({
  object,
  onUpdate,
  screenX,
  screenY,
  screenW,
}: LineFormattingToolbarProps) {
  const currentColor = object.stroke_color || "#374151";
  const currentWidth = object.stroke_width || 2;
  const startArrow = object.start_arrow ?? false;
  const endArrow = object.end_arrow ?? false;

  return (
    <div
      className="pointer-events-auto absolute z-50 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-lg"
      style={{
        left: screenX + screenW / 2,
        top: screenY - 52,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Stroke color */}
      <div className="flex items-center gap-1">
        {STROKE_COLORS.map((c) => (
          <button
            key={c}
            className={`h-5 w-5 rounded-full border-2 transition-transform ${
              c === currentColor ? "border-blue-500 scale-110" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
            onClick={() => onUpdate({ stroke_color: c })}
          />
        ))}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {/* Stroke width */}
      <div className="flex items-center gap-1">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors ${
              w === currentWidth ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
            }`}
            onClick={() => onUpdate({ stroke_width: w })}
          >
            {w}px
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {/* Arrow toggles */}
      <button
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          startArrow ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:bg-gray-100"
        }`}
        onClick={() => onUpdate({ start_arrow: !startArrow })}
        title="Start arrow"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          endArrow ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:bg-gray-100"
        }`}
        onClick={() => onUpdate({ end_arrow: !endArrow })}
        title="End arrow"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

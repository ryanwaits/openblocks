"use client";

import type { ToolMode } from "@/types/board";

interface GhostPreviewProps {
  activeTool: ToolMode;
  mousePos: { x: number; y: number } | null;
}

const GHOST_CONFIGS: Partial<Record<ToolMode, { width: number; height: number; color: string; label: string; borderRadius: number }>> = {
  sticky: { width: 200, height: 200, color: "#fef08a", label: "Sticky Note", borderRadius: 8 },
  rectangle: { width: 200, height: 150, color: "#bfdbfe", label: "Rectangle", borderRadius: 4 },
  text: { width: 300, height: 40, color: "transparent", label: "Text", borderRadius: 4 },
  circle: { width: 150, height: 150, color: "#dbeafe", label: "Circle", borderRadius: 75 },
};

export function GhostPreview({ activeTool, mousePos }: GhostPreviewProps) {
  const config = GHOST_CONFIGS[activeTool];
  if (!config || !mousePos) return null;

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: mousePos.x - config.width / 2,
        top: mousePos.y - config.height / 2,
        width: config.width,
        height: config.height,
        backgroundColor: config.color === "transparent" ? undefined : config.color,
        borderRadius: config.borderRadius,
        opacity: 0.4,
        border: activeTool === "text" ? "2px dashed #9ca3af" : undefined,
        boxShadow: config.color !== "transparent" ? "0 2px 8px rgba(0,0,0,0.1)" : undefined,
      }}
    >
      {activeTool === "text" && (
        <span className="pl-2 text-sm text-gray-400">Text</span>
      )}
    </div>
  );
}

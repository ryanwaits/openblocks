"use client";

import { memo } from "react";

interface SvgLineDrawingLayerProps {
  points: Array<{ x: number; y: number }>;
  cursorPos: { x: number; y: number } | null;
  snapTarget?: { x: number; y: number } | null;
}

export const SvgLineDrawingLayer = memo(function SvgLineDrawingLayer({
  points, cursorPos, snapTarget,
}: SvgLineDrawingLayerProps) {
  if (points.length === 0 && !snapTarget) return null;

  const committedPolyline = points.length >= 2
    ? points.map((p) => `${p.x},${p.y}`).join(" ")
    : null;

  const lastPoint = points[points.length - 1];
  const endPos = snapTarget || cursorPos;
  const rubberBand = endPos && lastPoint
    ? `${lastPoint.x},${lastPoint.y} ${endPos.x},${endPos.y}`
    : null;

  return (
    <g pointerEvents="none">
      {/* Committed segments */}
      {committedPolyline && (
        <polyline
          points={committedPolyline}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Rubber band */}
      {rubberBand && (
        <polyline
          points={rubberBand}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
      )}

      {/* Point handles */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
        />
      ))}

      {/* Snap indicator */}
      {snapTarget && (
        <circle
          cx={snapTarget.x}
          cy={snapTarget.y}
          r={8}
          fill="#3b82f6"
          opacity={0.6}
        />
      )}
    </g>
  );
});

"use client";

import type { BBox } from "@/lib/workflow/bounding-box";
import type { StreamStatus } from "@/types/workflow";

const PADDING = 40;

const STATUS_COLORS: Record<StreamStatus, { fill: string; stroke: string }> = {
  draft: { fill: "rgba(120,113,108,0.04)", stroke: "rgba(120,113,108,0.15)" },
  deploying: { fill: "rgba(202,138,4,0.06)", stroke: "rgba(202,138,4,0.2)" },
  active: { fill: "rgba(22,163,106,0.06)", stroke: "rgba(22,163,106,0.2)" },
  paused: { fill: "rgba(217,119,6,0.06)", stroke: "rgba(217,119,6,0.2)" },
  failed: { fill: "rgba(220,38,38,0.06)", stroke: "rgba(220,38,38,0.2)" },
};

interface WorkflowRegionTintProps {
  bbox: BBox;
  status: StreamStatus;
}

export function WorkflowRegionTint({ bbox, status }: WorkflowRegionTintProps) {
  const colors = STATUS_COLORS[status];
  if (bbox.w === 0 && bbox.h === 0) return null;

  return (
    <rect
      x={bbox.x - PADDING}
      y={bbox.y - PADDING}
      width={bbox.w + PADDING * 2}
      height={bbox.h + PADDING * 2}
      rx={12}
      ry={12}
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}

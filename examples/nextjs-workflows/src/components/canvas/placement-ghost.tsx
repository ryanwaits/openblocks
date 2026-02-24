"use client";

import { useState, useEffect, useCallback } from "react";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { useViewportStore } from "@/lib/store/viewport-store";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { BaseNode } from "@/components/nodes/base-node";
import { screenToCanvas } from "@/lib/canvas-utils";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type { WorkflowNode } from "@/types/workflow";

interface PlacementGhostProps {
  svgElement: SVGSVGElement | null;
}

export function PlacementGhost({ svgElement }: PlacementGhostProps) {
  const placementMode = useCanvasInteractionStore((s) => s.placementMode);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!placementMode || !svgElement) return;

    const handleMove = (e: PointerEvent) => {
      const { pos, scale } = useViewportStore.getState();
      const rect = svgElement.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
      setPosition({ x: canvasPos.x - 140, y: canvasPos.y - 40 });
    };

    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, [placementMode, svgElement]);

  if (!placementMode || !position) return null;

  const def = NODE_DEFINITIONS[placementMode.nodeType];
  const ghostNode: WorkflowNode = {
    id: "placement-ghost",
    type: placementMode.nodeType,
    label: def.label,
    position,
    config: { ...def.defaultConfig } as WorkflowNode["config"],
    workflowId: placementMode.workflowId ?? UNASSIGNED_WORKFLOW_ID,
  };

  return (
    <g style={{ opacity: 0.5, pointerEvents: "none" }}>
      <BaseNode node={ghostNode} isSelected={false} executionState="idle" />
    </g>
  );
}

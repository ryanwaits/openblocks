"use client";

import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { useBoardStore } from "@/lib/store/board-store";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { getPortPosition } from "@/components/nodes/node-port";
import { computeBezierPath } from "@/lib/workflow/edge-routing";
import { NODE_WIDTH, getNodeHeight } from "@/components/nodes/base-node";

export function ConnectionDraftLayer() {
  const draft = useCanvasInteractionStore((s) => s.connectionDraft);
  const nodes = useBoardStore((s) => s.nodes);

  if (!draft) return null;

  const sourceNode = nodes.get(draft.sourceNodeId);
  if (!sourceNode) return null;

  const sourceDef = NODE_DEFINITIONS[sourceNode.type];
  const sourcePort = sourceDef.ports.find((p) => p.id === draft.sourcePortId);
  if (!sourcePort) return null;

  const outputPorts = sourceDef.ports.filter((p) => p.direction === "output");
  const sourceIdx = outputPorts.indexOf(sourcePort);
  const sourceHeight = getNodeHeight(sourceNode);
  const sourcePortPos = getPortPosition(sourcePort, NODE_WIDTH, sourceIdx, outputPorts.length, sourceHeight);

  const sx = sourceNode.position.x + sourcePortPos.cx;
  const sy = sourceNode.position.y + sourcePortPos.cy;

  const pathD = computeBezierPath(sx, sy, draft.cursorX, draft.cursorY);

  return (
    <path
      d={pathD}
      fill="none"
      stroke="#7b61ff"
      strokeWidth={2}
      strokeDasharray="6 3"
      pointerEvents="none"
    />
  );
}

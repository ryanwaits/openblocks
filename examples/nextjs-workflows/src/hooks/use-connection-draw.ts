"use client";

import { useCallback, useEffect, useRef } from "react";
import { screenToCanvas } from "@/lib/canvas-utils";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { useBoardStore } from "@/lib/store/board-store";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { canConnect, findPort } from "@/lib/workflow/port-compatibility";
import { wouldCreateCycle } from "@/lib/workflow/graph-validation";
import { getPortPosition, NODE_PORT_RADIUS } from "@/components/nodes/node-port";
import { NODE_WIDTH, getNodeHeight } from "@/components/nodes/base-node";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

export function useConnectionDraw(
  svgElement: SVGSVGElement | null,
  mutations: WorkflowMutationsApi,
) {
  const drawingRef = useRef(false);
  const mutationsRef = useRef(mutations);
  mutationsRef.current = mutations;
  const svgElRef = useRef(svgElement);
  svgElRef.current = svgElement;

  const handlePortPointerDown = useCallback(
    (nodeId: string, portId: string, e: React.PointerEvent) => {
      const node = useBoardStore.getState().nodes.get(nodeId);
      if (!node) return;
      const port = findPort(node.type, portId);
      if (!port || port.direction !== "output") return;

      e.stopPropagation();
      e.preventDefault();

      const svg = svgElRef.current;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);

      useCanvasInteractionStore.getState().setConnectionDraft({
        sourceNodeId: nodeId,
        sourcePortId: portId,
        cursorX: canvasPos.x,
        cursorY: canvasPos.y,
      });
      drawingRef.current = true;
    },
    [],
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      const svg = svgElRef.current;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
      const draft = useCanvasInteractionStore.getState().connectionDraft;
      if (draft) {
        useCanvasInteractionStore.getState().setConnectionDraft({
          ...draft,
          cursorX: canvasPos.x,
          cursorY: canvasPos.y,
        });
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const draft = useCanvasInteractionStore.getState().connectionDraft;
      if (!draft) return;
      useCanvasInteractionStore.getState().setConnectionDraft(null);

      const svg = svgElRef.current;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
      const { nodes, edges } = useBoardStore.getState();

      for (const [nodeId, node] of nodes) {
        if (nodeId === draft.sourceNodeId) continue;
        const def = NODE_DEFINITIONS[node.type];
        const inputPorts = def.ports.filter((p) => p.direction === "input");
        for (let i = 0; i < inputPorts.length; i++) {
          const port = inputPorts[i];
          const nodeHeight = getNodeHeight(node);
          const portPos = getPortPosition(port, NODE_WIDTH, i, inputPorts.length, nodeHeight);
          const px = node.position.x + portPos.cx;
          const py = node.position.y + portPos.cy;
          const dist = Math.sqrt((canvasPos.x - px) ** 2 + (canvasPos.y - py) ** 2);

          if (dist < NODE_PORT_RADIUS * 3) {
            const sourceNode = nodes.get(draft.sourceNodeId);
            if (!sourceNode) break;
            const sourcePort = findPort(sourceNode.type, draft.sourcePortId);
            if (!sourcePort) break;
            if (!canConnect(draft.sourceNodeId, sourcePort, nodeId, port)) break;
            if (wouldCreateCycle(edges, draft.sourceNodeId, nodeId)) break;

            const isDuplicate = Array.from(edges.values()).some(
              (existing) =>
                existing.sourceNodeId === draft.sourceNodeId &&
                existing.sourcePortId === draft.sourcePortId &&
                existing.targetNodeId === nodeId &&
                existing.targetPortId === port.id,
            );
            if (isDuplicate) break;

            mutationsRef.current.addEdge({
              id: crypto.randomUUID(),
              sourceNodeId: draft.sourceNodeId,
              sourcePortId: draft.sourcePortId,
              targetNodeId: nodeId,
              targetPortId: port.id,
              workflowId: UNASSIGNED_WORKFLOW_ID,
            });
            return;
          }
        }
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [svgElement]);

  return { handlePortPointerDown };
}

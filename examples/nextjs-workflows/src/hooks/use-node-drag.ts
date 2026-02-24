"use client";

import { useRef, useCallback, useEffect } from "react";
import { screenToCanvas } from "@/lib/canvas-utils";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useBoardStore } from "@/lib/store/board-store";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

const DBLCLICK_MS = 300;

export function useNodeDrag(
  svgElement: SVGSVGElement | null,
  mutations: WorkflowMutationsApi,
) {
  const dragRef = useRef<{
    nodeId: string;
    startCanvasX: number;
    startCanvasY: number;
    // Start positions for all nodes in the same workflow group
    groupStarts: Map<string, { x: number; y: number }>;
  } | null>(null);
  const mutationsRef = useRef(mutations);
  mutationsRef.current = mutations;
  const svgElRef = useRef(svgElement);
  svgElRef.current = svgElement;
  const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const header = target.closest("[data-node-header]") as HTMLElement | null;
      if (!header) return;
      const nodeG = target.closest("[data-node-id]") as SVGGElement | null;
      if (!nodeG) return;
      const nodeId = nodeG.dataset.nodeId;
      if (!nodeId) return;
      if ((e.target as HTMLElement).closest("[data-node-port]")) return;

      const state = useBoardStore.getState();
      const node = state.nodes.get(nodeId);
      if (!node) return;
      const svg = svgElRef.current;
      if (!svg) return;

      // Double-click detection → open config panel
      const now = Date.now();
      const last = lastClickRef.current;
      if (last && last.nodeId === nodeId && now - last.time < DBLCLICK_MS) {
        lastClickRef.current = null;
        useBoardStore.getState().openConfig(nodeId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      lastClickRef.current = { nodeId, time: now };

      // Shift+click → toggle multi-selection, no drag
      if (e.shiftKey) {
        useBoardStore.getState().toggleNodeSelection(nodeId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);

      const groupStarts = new Map<string, { x: number; y: number }>();
      const selectedIds = useBoardStore.getState().selectedNodeIds;

      const isMultiDrag = selectedIds.size > 1 && selectedIds.has(nodeId);
      if (isMultiDrag) {
        // Drag all multi-selected nodes
        for (const sid of selectedIds) {
          const sNode = state.nodes.get(sid);
          if (sNode) groupStarts.set(sid, { x: sNode.position.x, y: sNode.position.y });
        }
      } else {
        // Single node drag — clear multi-selection
        groupStarts.set(nodeId, { x: node.position.x, y: node.position.y });
      }

      dragRef.current = {
        nodeId,
        startCanvasX: canvasPos.x,
        startCanvasY: canvasPos.y,
        groupStarts,
      };
      if (!isMultiDrag) {
        useBoardStore.getState().selectNode(nodeId); // clears selectedNodeIds
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragRef.current) return;
      const svg = svgElRef.current;
      if (!svg) return;
      const { pos, scale } = useViewportStore.getState();
      const rect = svg.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
      const dx = canvasPos.x - dragRef.current.startCanvasX;
      const dy = canvasPos.y - dragRef.current.startCanvasY;

      // Move all nodes in the workflow group
      const updates: { id: string; position: { x: number; y: number } }[] = [];
      for (const [id, start] of dragRef.current.groupStarts) {
        updates.push({
          id,
          position: { x: start.x + dx, y: start.y + dy },
        });
      }
      mutationsRef.current.moveNodes(updates);
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (!svgElement) return;
    svgElement.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      svgElement.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [svgElement, handlePointerDown, handlePointerMove, handlePointerUp]);
}

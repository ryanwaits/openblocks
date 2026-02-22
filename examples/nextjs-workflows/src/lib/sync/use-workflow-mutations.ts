"use client";

import { useCallback } from "react";
import { type LiveMap, LiveObject as LO } from "@waits/lively-client";
import type { LiveObject } from "@waits/lively-client";
import { useMutation, useUpdateCursor } from "@waits/lively-react";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";
import { useViewportStore } from "@/lib/store/viewport-store";

function nodeToLiveData(node: WorkflowNode): Record<string, unknown> {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    position: JSON.stringify(node.position),
    config: JSON.stringify(node.config),
  };
}

function edgeToLiveData(edge: WorkflowEdge): Record<string, unknown> {
  return { ...edge };
}

export function useWorkflowMutations() {
  const updateCursorFn = useUpdateCursor();

  const addNode = useMutation(
    ({ storage }, node: WorkflowNode) => {
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      nodes.set(node.id, new LO(nodeToLiveData(node)));
    },
    [],
  );

  const updateNode = useMutation(
    ({ storage }, node: WorkflowNode) => {
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      const existing = nodes.get(node.id);
      if (!existing) return;
      const newData = nodeToLiveData(node);
      const diff: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(newData)) {
        if (existing.get(key) !== value) {
          diff[key] = value;
        }
      }
      if (Object.keys(diff).length === 0) return;
      existing.update(diff);
    },
    [],
  );

  const deleteNode = useMutation(
    ({ storage }, nodeId: string) => {
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      const edges = storage.root.get("edges") as LiveMap<LiveObject>;
      nodes.delete(nodeId);
      // Cascade-delete connected edges
      const toDelete: string[] = [];
      edges.forEach((lo: LiveObject, key: string) => {
        const raw = lo.toObject();
        if (raw.sourceNodeId === nodeId || raw.targetNodeId === nodeId) {
          toDelete.push(key);
        }
      });
      for (const key of toDelete) {
        edges.delete(key);
      }
    },
    [],
  );

  const addEdge = useMutation(
    ({ storage }, edge: WorkflowEdge) => {
      const edges = storage.root.get("edges") as LiveMap<LiveObject>;
      edges.set(edge.id, new LO(edgeToLiveData(edge)));
    },
    [],
  );

  const deleteEdge = useMutation(
    ({ storage }, edgeId: string) => {
      (storage.root.get("edges") as LiveMap<LiveObject>).delete(edgeId);
    },
    [],
  );

  const updateMeta = useMutation(
    ({ storage }, updates: Record<string, unknown>) => {
      const meta = storage.root.get("meta") as LiveObject;
      meta.update(updates);
    },
    [],
  );

  const updateCursor = useCallback(
    (x: number, y: number) => {
      const { pos, scale } = useViewportStore.getState();
      updateCursorFn(x, y, pos, scale);
    },
    [updateCursorFn],
  );

  return { addNode, updateNode, deleteNode, addEdge, deleteEdge, updateMeta, updateCursor };
}

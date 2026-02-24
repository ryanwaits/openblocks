"use client";

import { useCallback } from "react";
import { type LiveMap, LiveObject as LO } from "@waits/lively-client";
import type { LiveObject } from "@waits/lively-client";
import { useMutation, useUpdateCursor } from "@waits/lively-react";
import type { WorkflowNode, WorkflowEdge, WorkflowRecord, BoardMeta } from "@/types/workflow";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import { useViewportStore } from "@/lib/store/viewport-store";

function nodeToLiveData(node: WorkflowNode): Record<string, unknown> {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    position: JSON.stringify(node.position),
    config: JSON.stringify(node.config),
    workflowId: node.workflowId,
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

  const addWorkflow = useMutation(
    ({ storage }, wf: WorkflowRecord) => {
      const workflows = storage.root.get("workflows") as LiveMap<LiveObject>;
      workflows.set(wf.id, new LO({
        id: wf.id,
        name: wf.name,
        stream: JSON.stringify(wf.stream),
      }));
    },
    [],
  );

  const updateWorkflow = useMutation(
    ({ storage }, wfId: string, updates: Partial<WorkflowRecord>) => {
      const workflows = storage.root.get("workflows") as LiveMap<LiveObject>;
      const existing = workflows.get(wfId);
      if (!existing) return;
      const diff: Record<string, unknown> = {};
      if (updates.name !== undefined) diff.name = updates.name;
      if (updates.stream !== undefined) diff.stream = JSON.stringify(updates.stream);
      if (Object.keys(diff).length > 0) existing.update(diff);
    },
    [],
  );

  const deleteWorkflow = useMutation(
    ({ storage }, wfId: string) => {
      const workflows = storage.root.get("workflows") as LiveMap<LiveObject>;
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      const edges = storage.root.get("edges") as LiveMap<LiveObject>;

      // Delete the workflow record
      workflows.delete(wfId);

      // Cascade-delete nodes with this workflowId
      const nodeIdsToDelete: string[] = [];
      nodes.forEach((lo: LiveObject, key: string) => {
        if (lo.toObject().workflowId === wfId) nodeIdsToDelete.push(key);
      });
      for (const id of nodeIdsToDelete) nodes.delete(id);

      // Cascade-delete edges with this workflowId
      const edgeIdsToDelete: string[] = [];
      edges.forEach((lo: LiveObject, key: string) => {
        if (lo.toObject().workflowId === wfId) edgeIdsToDelete.push(key);
      });
      for (const id of edgeIdsToDelete) edges.delete(id);
    },
    [],
  );

  const unlinkWorkflow = useMutation(
    ({ storage }, wfId: string) => {
      const workflows = storage.root.get("workflows") as LiveMap<LiveObject>;
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      const edges = storage.root.get("edges") as LiveMap<LiveObject>;

      // Delete only the workflow record
      workflows.delete(wfId);

      // Reset matching nodes to unassigned (don't delete them)
      nodes.forEach((lo: LiveObject) => {
        if (lo.toObject().workflowId === wfId) {
          lo.update({ workflowId: UNASSIGNED_WORKFLOW_ID });
        }
      });

      // Reset matching edges to unassigned (don't delete them)
      edges.forEach((lo: LiveObject) => {
        if (lo.toObject().workflowId === wfId) {
          lo.update({ workflowId: UNASSIGNED_WORKFLOW_ID });
        }
      });
    },
    [],
  );

  const setWorkflowIds = useMutation(
    ({ storage }, nodeIds: string[], edgeIds: string[], workflowId: string) => {
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      const edges = storage.root.get("edges") as LiveMap<LiveObject>;

      for (const id of nodeIds) {
        const node = nodes.get(id);
        if (node) node.update({ workflowId });
      }
      for (const id of edgeIds) {
        const edge = edges.get(id);
        if (edge) edge.update({ workflowId });
      }
    },
    [],
  );

  const updateBoardMeta = useMutation(
    ({ storage }, updates: Partial<BoardMeta>) => {
      const boardMeta = storage.root.get("boardMeta") as LiveObject;
      boardMeta.update(updates as Record<string, unknown>);
    },
    [],
  );

  const moveNodes = useMutation(
    ({ storage }, updates: { id: string; position: { x: number; y: number } }[]) => {
      const nodes = storage.root.get("nodes") as LiveMap<LiveObject>;
      for (const { id, position } of updates) {
        const existing = nodes.get(id);
        if (existing) {
          existing.update({ position: JSON.stringify(position) });
        }
      }
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

  return {
    addNode, updateNode, deleteNode,
    addEdge, deleteEdge,
    addWorkflow, updateWorkflow, deleteWorkflow,
    unlinkWorkflow, setWorkflowIds,
    updateBoardMeta, moveNodes, updateCursor,
  };
}

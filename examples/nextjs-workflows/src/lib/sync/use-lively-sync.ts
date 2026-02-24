"use client";

import { useEffect } from "react";
import type { LiveObject, LiveMap } from "@waits/lively-client";
import { useRoom, useStorageRoot } from "@waits/lively-react";
import { useBoardStore } from "@/lib/store/board-store";
import type { StreamState } from "@/types/workflow";
import type { WorkflowNode, WorkflowEdge, WorkflowRecord } from "@/types/workflow";
import { migrateRoomStorage } from "@/lib/sync/migrate";

function liveObjectToNode(lo: LiveObject): WorkflowNode | null {
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  return {
    id: raw.id as string,
    type: raw.type as WorkflowNode["type"],
    label: raw.label as string,
    position: typeof raw.position === "string" ? JSON.parse(raw.position) : raw.position as WorkflowNode["position"],
    config: typeof raw.config === "string" ? JSON.parse(raw.config) : raw.config as WorkflowNode["config"],
    workflowId: raw.workflowId as string,
  };
}

function liveObjectToEdge(lo: LiveObject): WorkflowEdge | null {
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  return {
    id: raw.id as string,
    sourceNodeId: raw.sourceNodeId as string,
    sourcePortId: raw.sourcePortId as string,
    targetNodeId: raw.targetNodeId as string,
    targetPortId: raw.targetPortId as string,
    workflowId: raw.workflowId as string,
  };
}

function liveObjectToWorkflow(lo: LiveObject): WorkflowRecord | null {
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  let stream: StreamState;
  try {
    stream = typeof raw.stream === "string" ? JSON.parse(raw.stream) : raw.stream as StreamState;
  } catch {
    stream = {
      streamId: null, status: "draft", lastDeployedAt: null, errorMessage: null,
      totalDeliveries: 0, failedDeliveries: 0, lastTriggeredAt: null, lastTriggeredBlock: null,
    };
  }
  return {
    id: raw.id as string,
    name: raw.name as string,
    stream,
  };
}

export function useLivelySync(): void {
  const room = useRoom();
  const storage = useStorageRoot();
  const root = storage?.root ?? null;

  const syncNodes = useBoardStore((s) => s.syncNodes);
  const syncEdges = useBoardStore((s) => s.syncEdges);
  const syncWorkflows = useBoardStore((s) => s.syncWorkflows);
  const syncBoardMeta = useBoardStore((s) => s.syncBoardMeta);

  useEffect(() => {
    if (!root) return;

    // Migrate old single-workflow rooms to new multi-workflow shape
    migrateRoomStorage(root);

    const nodesMap = root.get("nodes") as LiveMap<LiveObject> | undefined;
    const edgesMap = root.get("edges") as LiveMap<LiveObject> | undefined;
    const boardMetaObj = root.get("boardMeta") as LiveObject | undefined;
    const workflowsMap = root.get("workflows") as LiveMap<LiveObject> | undefined;

    function doSyncNodes() {
      if (!nodesMap) return;
      const arr: WorkflowNode[] = [];
      nodesMap.forEach((lo: LiveObject) => {
        const node = liveObjectToNode(lo);
        if (node) arr.push(node);
      });
      syncNodes(arr);
    }

    function doSyncEdges() {
      if (!edgesMap) return;
      const arr: WorkflowEdge[] = [];
      edgesMap.forEach((lo: LiveObject) => {
        const edge = liveObjectToEdge(lo);
        if (edge) arr.push(edge);
      });
      syncEdges(arr);
    }

    function doSyncWorkflows() {
      if (!workflowsMap) return;
      const arr: WorkflowRecord[] = [];
      workflowsMap.forEach((lo: LiveObject) => {
        const wf = liveObjectToWorkflow(lo);
        if (wf) arr.push(wf);
      });
      syncWorkflows(arr);
    }

    function doSyncBoardMeta() {
      if (!boardMetaObj) return;
      const raw = boardMetaObj.toObject();
      syncBoardMeta({ name: raw.name as string });
    }

    doSyncNodes();
    doSyncEdges();
    doSyncWorkflows();
    doSyncBoardMeta();

    const unsubNodes = nodesMap
      ? room.subscribe(nodesMap, doSyncNodes, { isDeep: true })
      : undefined;
    const unsubEdges = edgesMap
      ? room.subscribe(edgesMap, doSyncEdges, { isDeep: true })
      : undefined;
    const unsubWorkflows = workflowsMap
      ? room.subscribe(workflowsMap, doSyncWorkflows, { isDeep: true })
      : undefined;
    const unsubBoardMeta = boardMetaObj
      ? room.subscribe(boardMetaObj, doSyncBoardMeta)
      : undefined;

    return () => {
      unsubNodes?.();
      unsubEdges?.();
      unsubWorkflows?.();
      unsubBoardMeta?.();
    };
  }, [root, room, syncNodes, syncEdges, syncWorkflows, syncBoardMeta]);
}

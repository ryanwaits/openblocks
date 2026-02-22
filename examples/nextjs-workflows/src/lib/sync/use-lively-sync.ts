"use client";

import { useEffect } from "react";
import type { LiveObject, LiveMap } from "@waits/lively-client";
import { useRoom, useStorageRoot } from "@waits/lively-react";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";

function liveObjectToNode(lo: LiveObject): WorkflowNode | null {
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  return {
    id: raw.id as string,
    type: raw.type as WorkflowNode["type"],
    label: raw.label as string,
    position: typeof raw.position === "string" ? JSON.parse(raw.position) : raw.position as WorkflowNode["position"],
    config: typeof raw.config === "string" ? JSON.parse(raw.config) : raw.config as WorkflowNode["config"],
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
  };
}

export function useLivelySync(): void {
  const room = useRoom();
  const storage = useStorageRoot();
  const root = storage?.root ?? null;

  const syncNodes = useWorkflowStore((s) => s.syncNodes);
  const syncEdges = useWorkflowStore((s) => s.syncEdges);

  useEffect(() => {
    if (!root) return;

    const nodesMap = root.get("nodes") as LiveMap<LiveObject> | undefined;
    const edgesMap = root.get("edges") as LiveMap<LiveObject> | undefined;

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

    doSyncNodes();
    doSyncEdges();

    const unsubNodes = nodesMap
      ? room.subscribe(nodesMap, doSyncNodes, { isDeep: true })
      : undefined;
    const unsubEdges = edgesMap
      ? room.subscribe(edgesMap, doSyncEdges, { isDeep: true })
      : undefined;

    return () => {
      unsubNodes?.();
      unsubEdges?.();
    };
  }, [root, room, syncNodes, syncEdges]);
}

"use client";

import type { LiveObject, LiveMap } from "@waits/lively-client";
import { LiveObject as LO, LiveMap as LM } from "@waits/lively-client";
import type { StreamState } from "@/types/workflow";

const DEFAULT_STREAM: StreamState = {
  streamId: null,
  status: "draft",
  lastDeployedAt: null,
  errorMessage: null,
  totalDeliveries: 0,
  failedDeliveries: 0,
  lastTriggeredAt: null,
  lastTriggeredBlock: null,
};

/**
 * Migrates old single-workflow room storage to new multi-workflow board shape.
 * Old shape: root { meta, stream, nodes, edges }
 * New shape: root { boardMeta, workflows, nodes (with workflowId), edges (with workflowId) }
 *
 * Call inside a Lively mutation before subscriptions.
 */
export function migrateRoomStorage(root: LiveObject): boolean {
  // Check if already migrated
  if (root.get("boardMeta") !== undefined) return false;

  // Check if old shape exists
  const oldMeta = root.get("meta") as LiveObject | undefined;
  if (!oldMeta) return false;

  const metaObj = oldMeta.toObject();
  const oldStream = root.get("stream") as LiveObject | undefined;
  const nodesMap = root.get("nodes") as LiveMap<LiveObject> | undefined;
  const edgesMap = root.get("edges") as LiveMap<LiveObject> | undefined;

  // Create boardMeta from old meta
  root.set("boardMeta", new LO({ name: metaObj.name as string }));

  // Create workflows LiveMap with single workflow
  const wfId = "workflow-1";
  let streamState = DEFAULT_STREAM;
  if (oldStream) {
    const raw = oldStream.toObject();
    streamState = {
      streamId: (raw.streamId as string) || null,
      status: (raw.status as StreamState["status"]) || "draft",
      lastDeployedAt: (raw.lastDeployedAt as string) || null,
      errorMessage: (raw.errorMessage as string) || null,
      totalDeliveries: (raw.totalDeliveries as number) || 0,
      failedDeliveries: (raw.failedDeliveries as number) || 0,
      lastTriggeredAt: (raw.lastTriggeredAt as string) || null,
      lastTriggeredBlock: (raw.lastTriggeredBlock as number) || null,
    };
  }

  const workflows = new LM<LiveObject>();
  workflows.set(wfId, new LO({
    id: wfId,
    name: metaObj.name as string,
    stream: JSON.stringify(streamState),
  }));
  root.set("workflows", workflows);

  // Add workflowId to all existing nodes
  if (nodesMap) {
    nodesMap.forEach((lo: LiveObject) => {
      if (lo.get("workflowId") === undefined) {
        lo.update({ workflowId: wfId });
      }
    });
  }

  // Add workflowId to all existing edges
  if (edgesMap) {
    edgesMap.forEach((lo: LiveObject) => {
      if (lo.get("workflowId") === undefined) {
        lo.update({ workflowId: wfId });
      }
    });
  }

  // Old keys (meta, stream) remain but are no longer subscribed to.
  // They'll be ignored by the new sync layer.

  return true;
}

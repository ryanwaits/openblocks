"use client";

import { LivelyClient, LiveObject, LiveMap } from "@waits/lively-client";
import { deserializeCrdt } from "@waits/lively-storage";
import type { SerializedLiveObject } from "@waits/lively-types";
import type { BoardTemplate } from "@/lib/workflow/templates";

const serverUrl =
  process.env.NEXT_PUBLIC_LIVELY_HOST || "http://localhost:1999";

export const client = new LivelyClient({ serverUrl, reconnect: true });

/** Separate client for dashboard presence peeking — avoids a race condition
 *  where the dashboard's deferred leaveRoom() disconnects the shared Room
 *  instance right after the workflow page joins it. */
export const dashboardClient = new LivelyClient({ serverUrl, reconnect: true });

export function buildInitialStorage(template?: BoardTemplate, boardId?: string) {
  const nodes = new LiveMap<LiveObject>();
  const edges = new LiveMap<LiveObject>();
  const workflows = new LiveMap<LiveObject>();

  if (template) {
    // Create workflow entries
    for (const wf of template.workflows) {
      workflows.set(wf.id, new LiveObject({
        id: wf.id,
        name: wf.name,
        stream: JSON.stringify(wf.stream),
      }));
    }

    // Create nodes with workflowId
    for (const node of template.nodes) {
      const data: Record<string, unknown> = { ...node };
      // Auto-populate webhook URL on action nodes
      if (data.type === "webhook-action" && boardId) {
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${node.workflowId}`;
        data.config = { ...(data.config as Record<string, unknown>), url: webhookUrl };
      }
      nodes.set(node.id, new LiveObject(data));
    }

    // Create edges with workflowId
    for (const edge of template.edges) {
      edges.set(edge.id, new LiveObject({ ...edge }));
    }
  }

  return {
    boardMeta: new LiveObject({ name: template?.boardMeta?.name ?? "Untitled Board" }),
    workflows,
    nodes,
    edges,
  };
}

export function buildInitialStorageFromSnapshot(
  cached: SerializedLiveObject,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(cached.data).map(([key, val]) => [
      key,
      deserializeCrdt(val),
    ]),
  );
}

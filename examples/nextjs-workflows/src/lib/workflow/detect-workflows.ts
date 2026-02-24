import type { WorkflowNode, WorkflowEdge, WorkflowRecord } from "@/types/workflow";

export interface DetectedChain {
  triggerNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
}

/**
 * Walk forward from each event-trigger through ALL outgoing edges (BFS).
 * Complete chain = trigger + 1+ filters + at least 1 webhook reachable.
 */
export function detectWorkflowChains(
  nodes: Map<string, WorkflowNode>,
  edges: Map<string, WorkflowEdge>,
  workflows: Map<string, WorkflowRecord>,
): DetectedChain[] {
  // Build adjacency: sourceNodeId → { edgeId, targetNodeId }[]
  const outgoing = new Map<string, { edgeId: string; targetNodeId: string }[]>();
  for (const edge of edges.values()) {
    const arr = outgoing.get(edge.sourceNodeId) ?? [];
    arr.push({ edgeId: edge.id, targetNodeId: edge.targetNodeId });
    outgoing.set(edge.sourceNodeId, arr);
  }

  const chains: DetectedChain[] = [];

  for (const node of nodes.values()) {
    if (node.type !== "event-trigger") continue;

    const visitedNodes = new Set<string>([node.id]);
    const collectedEdgeIds: string[] = [];
    const queue = [node.id];
    let hasFilter = false;
    let hasWebhook = false;

    // BFS: follow all outgoing edges
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const nexts = outgoing.get(currentId);
      if (!nexts) continue;

      for (const next of nexts) {
        if (visitedNodes.has(next.targetNodeId)) continue;
        const targetNode = nodes.get(next.targetNodeId);
        if (!targetNode) continue;

        visitedNodes.add(next.targetNodeId);
        collectedEdgeIds.push(next.edgeId);

        if (targetNode.type === "webhook-action") {
          hasWebhook = true;
          // Don't continue past webhook
        } else {
          if (targetNode.type !== "event-trigger") {
            hasFilter = true;
          }
          queue.push(targetNode.id);
        }
      }
    }

    if (hasFilter && hasWebhook) {
      chains.push({
        triggerNodeId: node.id,
        nodeIds: Array.from(visitedNodes),
        edgeIds: collectedEdgeIds,
      });
    }
  }

  return chains;
}

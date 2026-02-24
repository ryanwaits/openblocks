import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type { WorkflowNode, WorkflowEdge, WorkflowRecord, BoardMeta, StreamState } from "@/types/workflow";

export interface BoardTemplate {
  id: string;
  boardMeta: BoardMeta;
  description: string;
  workflows: WorkflowRecord[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const DEFAULT_STREAM: StreamState = {
  streamId: null,
  status: "draft",
  lastDeployedAt: null,
  errorMessage: null,
  totalDeliveries: 0,
  failedDeliveries: 0,
  lastTriggeredAt: null,
  lastTriggeredBlock: null,
};

/** Fixed room ID — everyone joins the same board. */
export const DEFAULT_BOARD_ID = "stacks-streams";

export const DEFAULT_BOARD: BoardTemplate = {
  id: DEFAULT_BOARD_ID,
  boardMeta: { name: "Stacks Streams" },
  description: "Event-driven workflows for Stacks blockchain",
  workflows: [],
  nodes: [
    {
      id: "trigger-1",
      type: "event-trigger",
      label: "Event Trigger",
      position: { x: 100, y: 200 },
      config: {},
      workflowId: UNASSIGNED_WORKFLOW_ID,
    },
    {
      id: "filter-1",
      type: "stx-filter",
      label: "STX Filter",
      position: { x: 420, y: 200 },
      config: { eventType: "transfer" },
      workflowId: UNASSIGNED_WORKFLOW_ID,
    },
    {
      id: "action-1",
      type: "webhook-action",
      label: "Webhook",
      position: { x: 740, y: 200 },
      config: { url: "", retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
      workflowId: UNASSIGNED_WORKFLOW_ID,
    },
  ],
  edges: [
    { id: "edge-1", sourceNodeId: "trigger-1", sourcePortId: "event-out", targetNodeId: "filter-1", targetPortId: "in", workflowId: UNASSIGNED_WORKFLOW_ID },
    { id: "edge-2", sourceNodeId: "filter-1", sourcePortId: "out", targetNodeId: "action-1", targetPortId: "in", workflowId: UNASSIGNED_WORKFLOW_ID },
  ],
};

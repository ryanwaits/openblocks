import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    id: "stx-transfer-monitor",
    name: "STX Transfer Monitor",
    description: "Track STX transfers with optional sender/recipient filters",
    nodes: [
      {
        id: "trigger-1",
        type: "event-trigger",
        label: "Event Trigger",
        position: { x: 100, y: 200 },
        config: {},
      },
      {
        id: "filter-1",
        type: "stx-filter",
        label: "STX Filter",
        position: { x: 420, y: 200 },
        config: { eventType: "transfer" },
      },
      {
        id: "action-1",
        type: "webhook-action",
        label: "Webhook",
        position: { x: 740, y: 200 },
        config: { url: "", retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
      },
    ],
    edges: [
      { id: "edge-1", sourceNodeId: "trigger-1", sourcePortId: "event-out", targetNodeId: "filter-1", targetPortId: "in" },
      { id: "edge-2", sourceNodeId: "filter-1", sourcePortId: "out", targetNodeId: "action-1", targetPortId: "in" },
    ],
  },
  {
    id: "ft-transfer-tracker",
    name: "FT Transfer Tracker",
    description: "Monitor fungible token transfers for a specific asset",
    nodes: [
      {
        id: "trigger-1",
        type: "event-trigger",
        label: "Event Trigger",
        position: { x: 100, y: 200 },
        config: {},
      },
      {
        id: "filter-1",
        type: "ft-filter",
        label: "FT Filter",
        position: { x: 420, y: 200 },
        config: { eventType: "transfer" },
      },
      {
        id: "action-1",
        type: "webhook-action",
        label: "Webhook",
        position: { x: 740, y: 200 },
        config: { url: "", retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
      },
    ],
    edges: [
      { id: "edge-1", sourceNodeId: "trigger-1", sourcePortId: "event-out", targetNodeId: "filter-1", targetPortId: "in" },
      { id: "edge-2", sourceNodeId: "filter-1", sourcePortId: "out", targetNodeId: "action-1", targetPortId: "in" },
    ],
  },
  {
    id: "contract-call-monitor",
    name: "Contract Call Monitor",
    description: "Watch for calls to a specific contract or function",
    nodes: [
      {
        id: "trigger-1",
        type: "event-trigger",
        label: "Event Trigger",
        position: { x: 100, y: 200 },
        config: {},
      },
      {
        id: "filter-1",
        type: "contract-call-filter",
        label: "Contract Call",
        position: { x: 420, y: 200 },
        config: {},
      },
      {
        id: "action-1",
        type: "webhook-action",
        label: "Webhook",
        position: { x: 740, y: 200 },
        config: { url: "", retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
      },
    ],
    edges: [
      { id: "edge-1", sourceNodeId: "trigger-1", sourcePortId: "event-out", targetNodeId: "filter-1", targetPortId: "in" },
      { id: "edge-2", sourceNodeId: "filter-1", sourcePortId: "out", targetNodeId: "action-1", targetPortId: "in" },
    ],
  },
];

export const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.id, t]));

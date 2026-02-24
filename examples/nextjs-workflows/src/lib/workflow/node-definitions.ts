import type { WorkflowNodeType, Port } from "@/types/workflow";
import type { NodeConfigMap } from "@/types/node-configs";

export type NodeCategory = "triggers" | "filters" | "actions";

export interface NodeDefinition<T extends WorkflowNodeType = WorkflowNodeType> {
  type: T;
  label: string;
  description: string;
  category: NodeCategory;
  icon: string; // lucide icon name
  color: string; // tailwind-friendly hex
  ports: Port[];
  defaultConfig: NodeConfigMap[T];
}

export const NODE_DEFINITIONS: Record<WorkflowNodeType, NodeDefinition> = {
  "event-trigger": {
    type: "event-trigger",
    label: "Event Trigger",
    description: "Listen for blockchain events on Stacks",
    category: "triggers",
    icon: "Zap",
    color: "#f59e0b",
    ports: [
      { id: "event-out", direction: "output", dataType: "event", label: "Events" },
    ],
    defaultConfig: {},
  },
  "stx-filter": {
    type: "stx-filter",
    label: "STX Filter",
    description: "Filter STX transfer, mint, burn, or lock events",
    category: "filters",
    icon: "StxToken",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: { eventType: "transfer" },
  },
  "ft-filter": {
    type: "ft-filter",
    label: "FT Filter",
    description: "Filter fungible token events",
    category: "filters",
    icon: "FtToken",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: { eventType: "transfer" },
  },
  "nft-filter": {
    type: "nft-filter",
    label: "NFT Filter",
    description: "Filter non-fungible token events",
    category: "filters",
    icon: "NftImage",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: { eventType: "transfer" },
  },
  "contract-call-filter": {
    type: "contract-call-filter",
    label: "Contract Call",
    description: "Filter contract call events",
    category: "filters",
    icon: "ContractCall",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: {},
  },
  "contract-deploy-filter": {
    type: "contract-deploy-filter",
    label: "Contract Deploy",
    description: "Filter contract deployment events",
    category: "filters",
    icon: "ContractDeploy",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: {},
  },
  "print-event-filter": {
    type: "print-event-filter",
    label: "Print Event Filter",
    description: "Filter contract print events by topic or content",
    category: "filters",
    icon: "PrintEvent",
    color: "#3b82f6",
    ports: [
      { id: "in", direction: "input", dataType: "event", label: "Events" },
      { id: "out", direction: "output", dataType: "filtered", label: "Matched" },
    ],
    defaultConfig: {},
  },
  "webhook-action": {
    type: "webhook-action",
    label: "Webhook",
    description: "Send event data to an HTTP endpoint",
    category: "actions",
    icon: "Send",
    color: "#10b981",
    ports: [
      { id: "in", direction: "input", dataType: "filtered", label: "Payload" },
    ],
    defaultConfig: { url: "", retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
  },
};

export const CATEGORIES: { key: NodeCategory; label: string }[] = [
  { key: "triggers", label: "Triggers" },
  { key: "filters", label: "Filters" },
  { key: "actions", label: "Actions" },
];

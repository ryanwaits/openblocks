import type { WorkflowNode, WorkflowEdge, WorkflowNodeType } from "@/types/workflow";
import type {
  StxFilterConfig, FtFilterConfig, NftFilterConfig,
  ContractCallFilterConfig, ContractDeployFilterConfig,
  PrintEventFilterConfig, WebhookActionConfig, EventTriggerConfig,
} from "@/types/node-configs";

// Mirrors the discriminated union from @secondlayer/shared/schemas/filters
export type StreamFilter =
  | { type: "stx_transfer"; sender?: string; recipient?: string; minAmount?: number; maxAmount?: number }
  | { type: "stx_mint"; recipient?: string; minAmount?: number }
  | { type: "stx_burn"; sender?: string; minAmount?: number }
  | { type: "stx_lock"; lockedAddress?: string; minAmount?: number }
  | { type: "ft_transfer"; assetIdentifier?: string; sender?: string; recipient?: string; minAmount?: number }
  | { type: "ft_mint"; assetIdentifier?: string; recipient?: string; minAmount?: number }
  | { type: "ft_burn"; assetIdentifier?: string; sender?: string; minAmount?: number }
  | { type: "nft_transfer"; assetIdentifier?: string; sender?: string; recipient?: string; tokenId?: string }
  | { type: "nft_mint"; assetIdentifier?: string; recipient?: string; tokenId?: string }
  | { type: "nft_burn"; assetIdentifier?: string; sender?: string; tokenId?: string }
  | { type: "contract_call"; contractId?: string; functionName?: string; caller?: string }
  | { type: "contract_deploy"; deployer?: string; contractName?: string }
  | { type: "print_event"; contractId?: string; topic?: string; contains?: string };

export interface StreamOptions {
  decodeClarityValues: boolean;
  includeRawTx: boolean;
  includeBlockMetadata: boolean;
  maxRetries: number;
}

export interface CreateStreamPayload {
  name: string;
  webhookUrl: string;
  filters: StreamFilter[];
  options: StreamOptions;
  startBlock?: number;
}

export type CompileResult =
  | { ok: true; stream: CreateStreamPayload }
  | { ok: false; errors: string[] };

const FILTER_NODE_TYPES: Set<WorkflowNodeType> = new Set([
  "stx-filter", "ft-filter", "nft-filter",
  "contract-call-filter", "contract-deploy-filter", "print-event-filter",
]);

export function compileStream(
  name: string,
  nodes: Map<string, WorkflowNode>,
  edges: Map<string, WorkflowEdge>,
): CompileResult {
  const errors: string[] = [];

  // Find triggers and actions
  const triggers = [...nodes.values()].filter((n) => n.type === "event-trigger");
  const actions = [...nodes.values()].filter((n) => n.type === "webhook-action");

  if (triggers.length === 0) errors.push("Missing Event Trigger node");
  if (triggers.length > 1) errors.push("Only one Event Trigger is allowed");
  if (actions.length === 0) errors.push("Missing Webhook Action node");
  if (actions.length > 1) errors.push("Only one Webhook Action is allowed");
  if (errors.length > 0) return { ok: false, errors };

  const trigger = triggers[0]!;
  const action = actions[0]!;
  const triggerConfig = trigger.config as EventTriggerConfig;
  const actionConfig = action.config as WebhookActionConfig;

  if (!actionConfig.url) {
    errors.push("Webhook URL is required");
    return { ok: false, errors };
  }

  // Build adjacency: sourceNodeId → targetNodeIds (via edges)
  const adj = new Map<string, string[]>();
  for (const edge of edges.values()) {
    const list = adj.get(edge.sourceNodeId) ?? [];
    list.push(edge.targetNodeId);
    adj.set(edge.sourceNodeId, list);
  }

  // Walk from trigger → collect all filter nodes reachable before the action
  const filters: StreamFilter[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.get(nodeId);
    if (!node) return;

    if (FILTER_NODE_TYPES.has(node.type)) {
      const compiled = compileFilter(node);
      if (compiled) filters.push(compiled);
    }

    for (const next of adj.get(nodeId) ?? []) {
      if (next !== action.id) walk(next);
    }
  }

  walk(trigger.id);

  if (filters.length === 0) {
    errors.push("At least one filter node is required between trigger and webhook");
    return { ok: false, errors };
  }

  // Verify action is reachable
  const allReachable = new Set<string>();
  function walkAll(nodeId: string) {
    if (allReachable.has(nodeId)) return;
    allReachable.add(nodeId);
    for (const next of adj.get(nodeId) ?? []) walkAll(next);
  }
  walkAll(trigger.id);

  if (!allReachable.has(action.id)) {
    errors.push("Webhook is not connected to the trigger");
    return { ok: false, errors };
  }

  return {
    ok: true,
    stream: {
      name,
      webhookUrl: actionConfig.url,
      filters,
      options: {
        decodeClarityValues: actionConfig.decodeClarityValues ?? true,
        includeRawTx: actionConfig.includeRawTx ?? false,
        includeBlockMetadata: actionConfig.includeBlockMetadata ?? true,
        maxRetries: actionConfig.retryCount ?? 3,
      },
      startBlock: triggerConfig.startBlock,
    },
  };
}

function compileFilter(node: WorkflowNode): StreamFilter | null {
  switch (node.type) {
    case "stx-filter": {
      const c = node.config as StxFilterConfig;
      return compileStxFilter(c);
    }
    case "ft-filter": {
      const c = node.config as FtFilterConfig;
      return compileFtFilter(c);
    }
    case "nft-filter": {
      const c = node.config as NftFilterConfig;
      return compileNftFilter(c);
    }
    case "contract-call-filter": {
      const c = node.config as ContractCallFilterConfig;
      return { type: "contract_call", ...stripUndefined({ contractId: c.contractId, functionName: c.functionName, caller: c.caller }) };
    }
    case "contract-deploy-filter": {
      const c = node.config as ContractDeployFilterConfig;
      return { type: "contract_deploy", ...stripUndefined({ deployer: c.deployer, contractName: c.contractName }) };
    }
    case "print-event-filter": {
      const c = node.config as PrintEventFilterConfig;
      return { type: "print_event", ...stripUndefined({ contractId: c.contractId, topic: c.topic, contains: c.contains }) };
    }
    default:
      return null;
  }
}

function compileStxFilter(c: StxFilterConfig): StreamFilter {
  switch (c.eventType) {
    case "transfer":
      return { type: "stx_transfer", ...stripUndefined({ sender: c.sender, recipient: c.recipient, minAmount: c.minAmount, maxAmount: c.maxAmount }) };
    case "mint":
      return { type: "stx_mint", ...stripUndefined({ recipient: c.recipient, minAmount: c.minAmount }) };
    case "burn":
      return { type: "stx_burn", ...stripUndefined({ sender: c.sender, minAmount: c.minAmount }) };
    case "lock":
      // sender in our config maps to lockedAddress in the API
      return { type: "stx_lock", ...stripUndefined({ lockedAddress: c.sender, minAmount: c.minAmount }) };
  }
}

function compileFtFilter(c: FtFilterConfig): StreamFilter {
  switch (c.eventType) {
    case "transfer":
      return { type: "ft_transfer", ...stripUndefined({ assetIdentifier: c.assetIdentifier, sender: c.sender, recipient: c.recipient, minAmount: c.minAmount }) };
    case "mint":
      return { type: "ft_mint", ...stripUndefined({ assetIdentifier: c.assetIdentifier, recipient: c.recipient, minAmount: c.minAmount }) };
    case "burn":
      return { type: "ft_burn", ...stripUndefined({ assetIdentifier: c.assetIdentifier, sender: c.sender, minAmount: c.minAmount }) };
  }
}

function compileNftFilter(c: NftFilterConfig): StreamFilter {
  switch (c.eventType) {
    case "transfer":
      return { type: "nft_transfer", ...stripUndefined({ assetIdentifier: c.assetIdentifier, sender: c.sender, recipient: c.recipient, tokenId: c.tokenId }) };
    case "mint":
      return { type: "nft_mint", ...stripUndefined({ assetIdentifier: c.assetIdentifier, recipient: c.recipient, tokenId: c.tokenId }) };
    case "burn":
      return { type: "nft_burn", ...stripUndefined({ assetIdentifier: c.assetIdentifier, sender: c.sender, tokenId: c.tokenId }) };
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

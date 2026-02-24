"use client";

import type { WorkflowNode } from "@/types/workflow";
import type {
  EventTriggerConfig, StxFilterConfig, FtFilterConfig, NftFilterConfig,
  ContractCallFilterConfig, ContractDeployFilterConfig, PrintEventFilterConfig, WebhookActionConfig,
} from "@/types/node-configs";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { NodePort } from "./node-port";
import { NodeIcon } from "@/components/icons/node-icon";

const NODE_WIDTH = 280;
const HEADER_H = 44;
const BODY_PAD = 16;
const ROW_H = 22;
const EMPTY_BODY_H = 36;

export type ExecutionState = "idle" | "active" | "error";

interface ConfigDetail {
  label: string;
  value: string;
}

function truncate(s: string, max = 14): string {
  return s.length > max ? s.slice(0, max) + "\u2026" : s;
}

export function getConfigDetails(node: WorkflowNode): ConfigDetail[] {
  const details: ConfigDetail[] = [];
  const add = (label: string, value: string | undefined | null) => {
    if (value) details.push({ label, value });
  };

  switch (node.type) {
    case "event-trigger": {
      const c = node.config as EventTriggerConfig;
      const mode = c.triggerMode ?? "live";
      switch (mode) {
        case "live":
          add("MODE", "live");
          break;
        case "single-block":
          add("BLOCK", c.singleBlock != null ? String(c.singleBlock) : undefined);
          break;
        case "range":
          add("RANGE", c.startBlock != null && c.endBlock != null ? `${c.startBlock}\u2013${c.endBlock}` : undefined);
          break;
      }
      break;
    }
    case "stx-filter": {
      const c = node.config as StxFilterConfig;
      add("Type", c.eventType);
      add("Sender", c.sender ? truncate(c.sender) : undefined);
      add("Recipient", c.recipient ? truncate(c.recipient) : undefined);
      if (c.minAmount) add("Min", String(c.minAmount));
      if (c.maxAmount) add("Max", String(c.maxAmount));
      break;
    }
    case "ft-filter": {
      const c = node.config as FtFilterConfig;
      add("Type", c.eventType);
      add("Asset", c.assetIdentifier ? truncate(c.assetIdentifier) : undefined);
      add("Sender", c.sender ? truncate(c.sender) : undefined);
      add("Recipient", c.recipient ? truncate(c.recipient) : undefined);
      if (c.minAmount) add("Min", String(c.minAmount));
      break;
    }
    case "nft-filter": {
      const c = node.config as NftFilterConfig;
      add("Type", c.eventType);
      add("Asset", c.assetIdentifier ? truncate(c.assetIdentifier) : undefined);
      add("Sender", c.sender ? truncate(c.sender) : undefined);
      add("Recipient", c.recipient ? truncate(c.recipient) : undefined);
      add("Token ID", c.tokenId);
      break;
    }
    case "contract-call-filter": {
      const c = node.config as ContractCallFilterConfig;
      add("Contract", c.contractId ? truncate(c.contractId) : undefined);
      add("Function", c.functionName);
      add("Caller", c.caller ? truncate(c.caller) : undefined);
      break;
    }
    case "contract-deploy-filter": {
      const c = node.config as ContractDeployFilterConfig;
      add("Deployer", c.deployer ? truncate(c.deployer) : undefined);
      add("Name", c.contractName);
      break;
    }
    case "print-event-filter": {
      const c = node.config as PrintEventFilterConfig;
      add("Contract", c.contractId ? truncate(c.contractId) : undefined);
      add("Topic", c.topic);
      add("Contains", c.contains);
      break;
    }
    case "webhook-action": {
      const c = node.config as WebhookActionConfig;
      if (c.url) {
        try {
          add("URL", new URL(c.url).host);
        } catch {
          add("URL", truncate(c.url, 20));
        }
      }
      if (c.retryCount && c.retryCount !== 3) add("Retries", String(c.retryCount));
      if (c.includeRawTx) add("Raw TX", "yes");
      if (c.decodeClarityValues) add("Decode", "yes");
      if (c.includeBlockMetadata) add("Block meta", "yes");
      break;
    }
  }
  return details;
}

export function getNodeHeight(node: WorkflowNode): number {
  const details = getConfigDetails(node);
  const bodyH = details.length > 0 ? details.length * ROW_H + BODY_PAD : EMPTY_BODY_H;
  return HEADER_H + bodyH;
}

interface BaseNodeProps {
  node: WorkflowNode;
  isSelected: boolean;
  isMultiSelected?: boolean;
  executionState?: ExecutionState;
  onPortPointerDown?: (nodeId: string, portId: string, e: React.PointerEvent) => void;
}

export function BaseNode({ node, isSelected, isMultiSelected = false, executionState = "idle", onPortPointerDown }: BaseNodeProps) {
  const def = NODE_DEFINITIONS[node.type];
  const inputPorts = def.ports.filter((p) => p.direction === "input");
  const outputPorts = def.ports.filter((p) => p.direction === "output");
  const details = getConfigDetails(node);
  const totalHeight = getNodeHeight(node);

  const highlighted = isSelected || isMultiSelected;

  const borderColor = executionState === "error"
    ? "#ef4444"
    : executionState === "active"
      ? "#22c55e"
      : highlighted ? "#7b61ff" : "#e5e7eb";

  const glowShadow = executionState === "error"
    ? "0 0 0 2px rgba(239,68,68,0.3)"
    : executionState === "active"
      ? "0 0 0 2px rgba(34,197,94,0.3)"
      : highlighted ? "0 0 0 2px rgba(123,97,255,0.2)" : undefined;

  return (
    <g transform={`translate(${node.position.x},${node.position.y})`} data-node-id={node.id}>
      <foreignObject width={NODE_WIDTH} height={totalHeight} style={{ overflow: "visible" }}>
        <div
          className="flex flex-col rounded-xl border bg-white shadow-md"
          style={{
            width: NODE_WIDTH,
            borderColor,
            borderWidth: highlighted || executionState !== "idle" ? 2 : 1,
            boxShadow: glowShadow,
          }}
          data-node-header="true"
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ backgroundColor: def.color + "20" }}
            >
              <NodeIcon icon={def.icon} size={14} color={def.color} />
            </div>
            <span className="text-sm font-medium text-gray-900 truncate">{node.label}</span>
          </div>
          {/* Body */}
          {details.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: EMPTY_BODY_H }}>
              <p className="text-xs text-gray-400 italic">Double-click to configure</p>
            </div>
          ) : (
            <div className="px-3 py-2">
              {details.map((d, i) => (
                <div
                  key={d.label}
                  className="flex items-baseline justify-between gap-2 py-0.5"
                  style={i < details.length - 1 ? { borderBottom: "1px solid #f3f4f6" } : undefined}
                >
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0">{d.label}</span>
                  <span className="text-xs text-gray-700 font-mono truncate">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </foreignObject>

      {/* Input ports */}
      {inputPorts.map((port, i) => (
        <NodePort
          key={port.id}
          port={port}
          nodeWidth={NODE_WIDTH}
          nodeHeight={totalHeight}
          index={i}
          totalPorts={inputPorts.length}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
        />
      ))}

      {/* Output ports */}
      {outputPorts.map((port, i) => (
        <NodePort
          key={port.id}
          port={port}
          nodeWidth={NODE_WIDTH}
          nodeHeight={totalHeight}
          index={i}
          totalPorts={outputPorts.length}
          onPointerDown={(e) => onPortPointerDown?.(node.id, port.id, e)}
        />
      ))}
    </g>
  );
}

export { NODE_WIDTH };

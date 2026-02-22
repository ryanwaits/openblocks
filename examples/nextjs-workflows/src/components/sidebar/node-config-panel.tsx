"use client";

import { createElement } from "react";
import { icons } from "lucide-react";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import type { WorkflowNode, WorkflowNodeType } from "@/types/workflow";
import type { NodeConfigMap } from "@/types/node-configs";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";
import { EventTriggerForm } from "./config-forms/event-trigger-form";
import { StxFilterForm } from "./config-forms/stx-filter-form";
import { FtFilterForm } from "./config-forms/ft-filter-form";
import { NftFilterForm } from "./config-forms/nft-filter-form";
import { ContractCallFilterForm } from "./config-forms/contract-call-filter-form";
import { ContractDeployFilterForm } from "./config-forms/contract-deploy-filter-form";
import { PrintEventFilterForm } from "./config-forms/print-event-filter-form";
import { WebhookActionForm } from "./config-forms/webhook-action-form";
import { Trash2 } from "lucide-react";

export function NodeConfigPanel({ mutations }: { mutations: WorkflowMutationsApi }) {
  const configNodeId = useWorkflowStore((s) => s.configNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);

  if (!configNodeId) return null;
  const node = nodes.get(configNodeId);
  if (!node) return null;

  const def = NODE_DEFINITIONS[node.type];
  const Icon = icons[def.icon as keyof typeof icons];

  function handleConfigChange(config: Partial<NodeConfigMap[WorkflowNodeType]>) {
    mutations.updateNode({ ...node!, config: { ...node!.config, ...config } as WorkflowNode["config"] });
  }

  function handleLabelChange(label: string) {
    mutations.updateNode({ ...node!, label });
  }

  return (
    <div className="flex h-full w-72 flex-col border-l bg-white" style={{ borderColor: "#e5e7eb" }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: def.color + "20" }}>
          {Icon && createElement(Icon, { size: 15, color: def.color })}
        </div>
        <input
          className="flex-1 bg-transparent text-sm font-semibold text-gray-900 outline-none"
          value={node.label}
          onChange={(e) => handleLabelChange(e.target.value)}
        />
      </div>

      {/* Config form */}
      <div className="flex-1 overflow-y-auto p-4">
        <ConfigForm node={node} onChange={handleConfigChange} />
      </div>

      {/* Footer */}
      <div className="border-t p-4" style={{ borderColor: "#e5e7eb" }}>
        <button
          onClick={() => {
            mutations.deleteNode(node.id);
            useWorkflowStore.getState().selectNode(null);
            useWorkflowStore.getState().openConfig(null);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
        >
          <Trash2 size={13} />
          Delete Node
        </button>
      </div>
    </div>
  );
}

function ConfigForm({ node, onChange }: { node: WorkflowNode; onChange: (config: Record<string, unknown>) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = node.config as any;
  switch (node.type) {
    case "event-trigger":
      return <EventTriggerForm config={config} onChange={onChange} />;
    case "stx-filter":
      return <StxFilterForm config={config} onChange={onChange} />;
    case "ft-filter":
      return <FtFilterForm config={config} onChange={onChange} />;
    case "nft-filter":
      return <NftFilterForm config={config} onChange={onChange} />;
    case "contract-call-filter":
      return <ContractCallFilterForm config={config} onChange={onChange} />;
    case "contract-deploy-filter":
      return <ContractDeployFilterForm config={config} onChange={onChange} />;
    case "print-event-filter":
      return <PrintEventFilterForm config={config} onChange={onChange} />;
    case "webhook-action":
      return <WebhookActionForm config={config} onChange={onChange} />;
    default:
      return <p className="text-xs text-gray-400">No configuration available</p>;
  }
}

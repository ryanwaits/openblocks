"use client";

import { useState, useRef, useEffect, createElement } from "react";
import { Plus, Circle } from "lucide-react";
import { icons } from "lucide-react";
import { useBoardStore, DEFAULT_STREAM } from "@/lib/store/board-store";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";
import type { StreamStatus, WorkflowNodeType } from "@/types/workflow";

const STATUS_CONFIG: Record<StreamStatus, { fill: string; label: string }> = {
  draft: { fill: "#9ca3af", label: "Draft" },
  deploying: { fill: "#ca8a04", label: "Deploying" },
  active: { fill: "#16a34a", label: "Active" },
  paused: { fill: "#d97706", label: "Paused" },
  failed: { fill: "#dc2626", label: "Failed" },
};

const FILTER_NODE_TYPES: WorkflowNodeType[] = [
  "stx-filter", "ft-filter", "nft-filter",
  "contract-call-filter", "contract-deploy-filter", "print-event-filter",
];

interface WorkflowListSidebarProps {
  mutations: WorkflowMutationsApi;
  boardId: string;
  onSelectWorkflow?: (wfId: string) => void;
}

export function WorkflowListSidebar({ mutations, boardId, onSelectWorkflow }: WorkflowListSidebarProps) {
  const workflows = useBoardStore((s) => s.workflows);
  const selectedWorkflowId = useBoardStore((s) => s.selectedWorkflowId);
  const selectWorkflow = useBoardStore((s) => s.selectWorkflow);

  const handleAddWorkflow = () => {
    const wfId = crypto.randomUUID();
    const wfName = `Workflow ${workflows.size + 1}`;

    // Create the workflow record
    mutations.addWorkflow({
      id: wfId,
      name: wfName,
      stream: { ...DEFAULT_STREAM },
    });

    // Auto-place a trigger→webhook chain
    const triggerId = crypto.randomUUID();
    const actionId = crypto.randomUUID();
    const edgeId = crypto.randomUUID();

    // Find an open vertical position
    const existingNodes = Array.from(useBoardStore.getState().nodes.values());
    const maxY = existingNodes.length > 0
      ? Math.max(...existingNodes.map((n) => n.position.y)) + 200
      : 200;

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${wfId}`;

    mutations.addNode({
      id: triggerId,
      type: "event-trigger",
      label: "Event Trigger",
      position: { x: 100, y: maxY },
      config: {},
      workflowId: wfId,
    });
    mutations.addNode({
      id: actionId,
      type: "webhook-action",
      label: "Webhook",
      position: { x: 420, y: maxY },
      config: { url: webhookUrl, retryCount: 3, includeRawTx: false, decodeClarityValues: true, includeBlockMetadata: true },
      workflowId: wfId,
    });
    mutations.addEdge({
      id: edgeId,
      sourceNodeId: triggerId,
      sourcePortId: "event-out",
      targetNodeId: actionId,
      targetPortId: "in",
      workflowId: wfId,
    });

    selectWorkflow(wfId);
  };

  return (
    <div className="flex h-full w-56 flex-col border-r bg-white" style={{ borderColor: "#e5e7eb" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#e5e7eb" }}>
        <h2 className="text-sm font-semibold text-gray-900">Workflows</h2>
        <button
          onClick={handleAddWorkflow}
          className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          title="New workflow"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {Array.from(workflows.values()).map((wf) => {
          const isSelected = wf.id === selectedWorkflowId;
          const cfg = STATUS_CONFIG[wf.stream.status];

          return (
            <WorkflowRow
              key={wf.id}
              wfId={wf.id}
              name={wf.name}
              statusFill={cfg.fill}
              statusLabel={cfg.label}
              deliveries={wf.stream.totalDeliveries}
              isSelected={isSelected}
              onSelect={() => onSelectWorkflow ? onSelectWorkflow(wf.id) : selectWorkflow(wf.id)}
            />
          );
        })}

        {workflows.size === 0 && (
          <p className="px-2 py-4 text-xs text-gray-400 text-center">No workflows yet</p>
        )}
      </div>
    </div>
  );
}

interface WorkflowRowProps {
  wfId: string;
  name: string;
  statusFill: string;
  statusLabel: string;
  deliveries: number;
  isSelected: boolean;
  onSelect: () => void;
}

function WorkflowRow({ wfId, name, statusFill, statusLabel, deliveries, isSelected, onSelect }: WorkflowRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
      onClick={onSelect}
    >
      <Circle size={7} fill={statusFill} stroke="none" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 truncate">{name}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {statusLabel}{deliveries > 0 ? ` · ${deliveries} delivered` : ""}
        </p>
      </div>
      {/* Per-row add filter button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen); }}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-500"
          title="Add filter node"
        >
          <Plus size={12} />
        </button>
        {pickerOpen && (
          <FilterNodePicker
            workflowId={wfId}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

function FilterNodePicker({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const setPlacementMode = useCanvasInteractionStore((s) => s.setPlacementMode);

  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border bg-white py-1 shadow-lg"
      style={{ borderColor: "#e5e7eb" }}
    >
      {FILTER_NODE_TYPES.map((type) => {
        const def = NODE_DEFINITIONS[type];
        const Icon = icons[def.icon as keyof typeof icons];
        return (
          <button
            key={type}
            onClick={(e) => {
              e.stopPropagation();
              setPlacementMode({ nodeType: type, workflowId });
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: def.color + "20" }}>
              {Icon && createElement(Icon, { size: 11, color: def.color })}
            </div>
            {def.label}
          </button>
        );
      })}
    </div>
  );
}

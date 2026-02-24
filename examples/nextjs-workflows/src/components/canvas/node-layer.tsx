"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { BaseNode, type ExecutionState } from "@/components/nodes/base-node";
import type { StreamStatus } from "@/types/workflow";

interface NodeLayerProps {
  onPortPointerDown?: (nodeId: string, portId: string, e: React.PointerEvent) => void;
}

function getExecutionState(status: StreamStatus): ExecutionState {
  if (status === "active") return "active";
  if (status === "failed") return "error";
  return "idle";
}

export function NodeLayer({ onPortPointerDown }: NodeLayerProps) {
  const nodes = useBoardStore((s) => s.nodes);
  const selectedNodeId = useBoardStore((s) => s.selectedNodeId);
  const selectedNodeIds = useBoardStore((s) => s.selectedNodeIds);
  const workflows = useBoardStore((s) => s.workflows);

  return (
    <g>
      {Array.from(nodes.values()).map((node) => {
        const wf = workflows.get(node.workflowId);
        const streamStatus = wf?.stream.status ?? "draft";
        const executionState = streamStatus !== "draft" ? getExecutionState(streamStatus) : "idle";

        return (
          <BaseNode
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            isMultiSelected={selectedNodeIds.has(node.id)}
            executionState={executionState}
            onPortPointerDown={onPortPointerDown}
          />
        );
      })}
    </g>
  );
}

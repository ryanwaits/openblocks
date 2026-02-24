"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import { getWorkflowBBox } from "@/lib/workflow/bounding-box";
import { WorkflowRegionTint } from "./workflow-region-tint";
import { WorkflowAnchorBadge } from "./workflow-anchor-badge";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

// Match mock-d spacing: pad=40, badgeH=56, regionPadTop=16
// Region tint adds its own PADDING=40, so we extend bbox to compensate.
const BADGE_AREA = 72; // vertical extension above node bbox (badgeH + regionPadTop = 56+16)

interface WorkflowOverlaysLayerProps {
  mutations: WorkflowMutationsApi;
  boardId: string;
}

export function WorkflowOverlaysLayer({ mutations, boardId }: WorkflowOverlaysLayerProps) {
  const workflows = useBoardStore((s) => s.workflows);
  const nodes = useBoardStore((s) => s.nodes);

  // Group nodes by workflowId
  const workflowNodeMap = new Map<string, typeof nodes extends Map<string, infer V> ? V[] : never>();
  for (const node of nodes.values()) {
    const arr = workflowNodeMap.get(node.workflowId) ?? [];
    arr.push(node);
    workflowNodeMap.set(node.workflowId, arr);
  }

  return (
    <g>
      {Array.from(workflows.keys()).map((wfId) => {
        if (wfId === UNASSIGNED_WORKFLOW_ID) return null;
        const wfNodes = workflowNodeMap.get(wfId) ?? [];
        if (wfNodes.length === 0) return null;
        const bbox = getWorkflowBBox(wfNodes);
        const wf = workflows.get(wfId);
        if (!wf) return null;

        const triggerNode = wfNodes.find((n) => n.type === "event-trigger");

        // Extend region top to fit badge area above nodes
        const extendedBbox = {
          ...bbox,
          y: bbox.y - BADGE_AREA,
          h: bbox.h + BADGE_AREA,
        };

        return (
          <g key={wfId}>
            <WorkflowRegionTint bbox={extendedBbox} status={wf.stream.status} />
            <WorkflowAnchorBadge
              wfId={wfId}
              bbox={bbox}
              triggerX={triggerNode?.position.x ?? bbox.x}
              mutations={mutations}
              boardId={boardId}
            />
          </g>
        );
      })}
    </g>
  );
}

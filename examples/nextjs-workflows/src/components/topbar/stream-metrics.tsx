"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { Activity } from "lucide-react";

interface StreamMetricsProps {
  onBadgeClick?: (wfId: string) => void;
}

export function StreamMetrics({ onBadgeClick }: StreamMetricsProps) {
  const workflows = useBoardStore((s) => s.workflows);
  const selectedWorkflowIds = useBoardStore((s) => s.selectedWorkflowIds);

  // Build pills for each selected non-draft workflow
  const pills: { wfId: string; name: string; total: number; failed: number; block: number | null }[] = [];

  for (const wfId of selectedWorkflowIds) {
    const wf = workflows.get(wfId);
    if (!wf || wf.stream.status === "draft") continue;
    pills.push({
      wfId,
      name: wf.name,
      total: wf.stream.totalDeliveries,
      failed: wf.stream.failedDeliveries,
      block: wf.stream.lastTriggeredBlock,
    });
  }

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {pills.map((p) => (
        <button
          key={p.wfId}
          onClick={() => onBadgeClick?.(p.wfId)}
          className="flex items-center gap-3 rounded-lg border bg-white/90 px-3 py-1.5 text-xs backdrop-blur transition-colors hover:bg-white"
          style={{ borderColor: "#e5e7eb" }}
        >
          <Activity size={13} className="text-gray-400" />
          <span className="font-medium text-gray-600 truncate max-w-[120px]">{p.name}</span>
          <div className="flex items-center gap-1">
            <span className="font-medium text-gray-900">{p.total}</span>
            <span className="text-gray-400">delivered</span>
          </div>
          {p.failed > 0 && (
            <div className="flex items-center gap-1">
              <span className="font-medium text-red-600">{p.failed}</span>
              <span className="text-gray-400">failed</span>
            </div>
          )}
          {p.block && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">block</span>
              <span className="font-medium text-gray-700">#{p.block}</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

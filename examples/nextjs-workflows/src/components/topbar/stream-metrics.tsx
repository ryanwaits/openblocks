"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { Activity } from "lucide-react";

export function StreamMetrics({ onClick }: { onClick?: () => void }) {
  const workflows = useBoardStore((s) => s.workflows);

  // Aggregate across all non-draft workflows
  let totalDeliveries = 0;
  let failedDeliveries = 0;
  let lastTriggeredBlock: number | null = null;
  let hasActive = false;

  for (const wf of workflows.values()) {
    if (wf.stream.status === "draft") continue;
    hasActive = true;
    totalDeliveries += wf.stream.totalDeliveries;
    failedDeliveries += wf.stream.failedDeliveries;
    if (wf.stream.lastTriggeredBlock) {
      lastTriggeredBlock = Math.max(lastTriggeredBlock ?? 0, wf.stream.lastTriggeredBlock);
    }
  }

  if (!hasActive) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border bg-white/90 px-3 py-1.5 text-xs backdrop-blur transition-colors hover:bg-white"
      style={{ borderColor: "#e5e7eb" }}
    >
      <Activity size={13} className="text-gray-400" />
      <div className="flex items-center gap-1">
        <span className="font-medium text-gray-900">{totalDeliveries}</span>
        <span className="text-gray-400">delivered</span>
      </div>
      {failedDeliveries > 0 && (
        <div className="flex items-center gap-1">
          <span className="font-medium text-red-600">{failedDeliveries}</span>
          <span className="text-gray-400">failed</span>
        </div>
      )}
      {lastTriggeredBlock && (
        <div className="flex items-center gap-1">
          <span className="text-gray-400">block</span>
          <span className="font-medium text-gray-700">#{lastTriggeredBlock}</span>
        </div>
      )}
    </button>
  );
}

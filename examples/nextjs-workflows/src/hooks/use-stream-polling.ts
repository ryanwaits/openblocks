"use client";

import { useEffect, useRef } from "react";
import { useBoardStore } from "@/lib/store/board-store";
import { streamsApi } from "@/lib/api/streams-client";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

const POLL_INTERVAL = 10_000; // 10s

/** Polls all active/paused workflows — no single workflowId needed. */
export function useStreamPolling(mutations: WorkflowMutationsApi) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function poll() {
      const { workflows } = useBoardStore.getState();
      for (const [wfId, wf] of workflows) {
        if (!wf.stream.streamId) continue;
        if (wf.stream.status !== "active" && wf.stream.status !== "paused") continue;

        streamsApi.get(wf.stream.streamId).then((res) => {
          const statusMap: Record<string, string> = {
            inactive: "paused",
            active: "active",
            paused: "paused",
            failed: "failed",
          };
          const currentWf = useBoardStore.getState().workflows.get(wfId);
          if (!currentWf) return;
          mutations.updateWorkflow(wfId, {
            stream: {
              ...currentWf.stream,
              status: (statusMap[res.status] ?? res.status) as "active" | "paused" | "failed",
              totalDeliveries: res.totalDeliveries ?? 0,
              failedDeliveries: res.failedDeliveries ?? 0,
              lastTriggeredAt: res.lastTriggeredAt ?? null,
              lastTriggeredBlock: res.lastTriggeredBlock ?? null,
              errorMessage: res.errorMessage ?? null,
            },
          });
        }).catch(() => {
          // Silently ignore polling errors
        });
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mutations]);
}

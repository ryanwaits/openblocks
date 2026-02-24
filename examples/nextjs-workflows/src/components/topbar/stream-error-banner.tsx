"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { useStreamDeploy } from "@/hooks/use-stream-deploy";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

export function StreamErrorBanner({ mutations }: { mutations: WorkflowMutationsApi }) {
  const workflows = useBoardStore((s) => s.workflows);

  // Find first workflow with an error
  let errorWfId: string | null = null;
  let errorMessage: string | null = null;
  for (const [wfId, wf] of workflows) {
    if (wf.stream.errorMessage) {
      errorWfId = wfId;
      errorMessage = wf.stream.errorMessage;
      break;
    }
  }

  if (!errorMessage || !errorWfId) return null;

  const wfId = errorWfId;

  return (
    <StreamErrorBannerInner
      wfId={wfId}
      errorMessage={errorMessage}
      mutations={mutations}
    />
  );
}

function StreamErrorBannerInner({
  wfId,
  errorMessage,
  mutations,
}: {
  wfId: string;
  errorMessage: string;
  mutations: WorkflowMutationsApi;
}) {
  const { deploy } = useStreamDeploy(mutations, wfId);

  return (
    <div className="absolute left-1/2 top-16 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 shadow-sm">
      <AlertTriangle size={14} className="shrink-0 text-red-500" />
      <span className="text-xs text-red-700">{errorMessage}</span>
      <button
        onClick={() => deploy()}
        className="ml-2 flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-200"
      >
        <RefreshCw size={11} />
        Retry
      </button>
      <button
        onClick={() => {
          const wf = useBoardStore.getState().workflows.get(wfId);
          if (wf) {
            mutations.updateWorkflow(wfId, {
              stream: { ...wf.stream, errorMessage: null },
            });
          }
        }}
        className="flex items-center justify-center rounded-md p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
      >
        <X size={13} />
      </button>
    </div>
  );
}

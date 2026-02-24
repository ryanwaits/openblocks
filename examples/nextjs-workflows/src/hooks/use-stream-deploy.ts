"use client";

import { useCallback, useState } from "react";
import { useBoardStore } from "@/lib/store/board-store";
import { compileStream } from "@/lib/workflow/compile-stream";
import { streamsApi } from "@/lib/api/streams-client";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

export function useStreamDeploy(mutations: WorkflowMutationsApi, workflowId: string) {
  const [deploying, setDeploying] = useState(false);

  const deploy = useCallback(async () => {
    const { nodes, edges, workflows } = useBoardStore.getState();
    const wf = workflows.get(workflowId);
    if (!wf) return { ok: false as const, errors: ["Workflow not found"] };

    const result = compileStream(wf.name, nodes, edges, workflowId);
    if (!result.ok) {
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, errorMessage: result.errors.join("; ") },
      });
      return { ok: false as const, errors: result.errors };
    }

    setDeploying(true);
    mutations.updateWorkflow(workflowId, {
      stream: { ...wf.stream, status: "deploying", errorMessage: null },
    });

    try {
      // Re-read stream in case it changed
      const currentWf = useBoardStore.getState().workflows.get(workflowId);
      const stream = currentWf?.stream ?? wf.stream;

      let activeStreamId: string;

      if (stream.streamId) {
        const updated = await streamsApi.update(stream.streamId, result.stream);
        if (updated.status !== "active") await streamsApi.enable(stream.streamId);
        activeStreamId = stream.streamId;
        mutations.updateWorkflow(workflowId, {
          stream: {
            ...stream,
            status: "active",
            lastDeployedAt: new Date().toISOString(),
            errorMessage: null,
          },
        });
      } else {
        const { stream: created } = await streamsApi.create(result.stream);
        if (created.status !== "active") await streamsApi.enable(created.id);
        activeStreamId = created.id;
        mutations.updateWorkflow(workflowId, {
          stream: {
            ...stream,
            streamId: created.id,
            status: "active",
            lastDeployedAt: new Date().toISOString(),
            errorMessage: null,
          },
        });
      }

      // Execute post-deploy action (trigger/replay)
      if (result.postDeployAction) {
        try {
          const action = result.postDeployAction;
          if (action.type === "trigger") {
            await streamsApi.trigger(activeStreamId, action.blockHeight);
          } else if (action.type === "replay") {
            await streamsApi.replay(activeStreamId, action.fromBlock, action.toBlock);
          }
        } catch (err) {
          console.warn("Post-deploy action failed:", err);
        }
      }

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deploy failed";
      const currentStream = useBoardStore.getState().workflows.get(workflowId)?.stream ?? wf.stream;
      mutations.updateWorkflow(workflowId, {
        stream: { ...currentStream, status: "failed", errorMessage: message },
      });
      return { ok: false as const, errors: [message] };
    } finally {
      setDeploying(false);
    }
  }, [mutations, workflowId]);

  const enable = useCallback(async () => {
    const wf = useBoardStore.getState().workflows.get(workflowId);
    if (!wf?.stream.streamId) return;
    try {
      await streamsApi.enable(wf.stream.streamId);
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, status: "active", errorMessage: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Enable failed";
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, errorMessage: message },
      });
    }
  }, [mutations, workflowId]);

  const disable = useCallback(async () => {
    const wf = useBoardStore.getState().workflows.get(workflowId);
    if (!wf?.stream.streamId) return;
    try {
      await streamsApi.disable(wf.stream.streamId);
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, status: "paused" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Disable failed";
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, errorMessage: message },
      });
    }
  }, [mutations, workflowId]);

  const remove = useCallback(async () => {
    const wf = useBoardStore.getState().workflows.get(workflowId);
    if (!wf?.stream.streamId) return;
    try {
      await streamsApi.delete(wf.stream.streamId);
      mutations.updateWorkflow(workflowId, {
        stream: {
          streamId: null, status: "draft", lastDeployedAt: null, errorMessage: null,
          totalDeliveries: 0, failedDeliveries: 0, lastTriggeredAt: null, lastTriggeredBlock: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      mutations.updateWorkflow(workflowId, {
        stream: { ...wf.stream, errorMessage: message },
      });
    }
  }, [mutations, workflowId]);

  return { deploy, enable, disable, remove, deploying };
}

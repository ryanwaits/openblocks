"use client";

import { useEffect, useRef } from "react";
import { useBoardStore, DEFAULT_STREAM } from "@/lib/store/board-store";
import { detectWorkflowChains, type DetectedChain } from "@/lib/workflow/detect-workflows";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";

function chainKey(chain: DetectedChain): string {
  return chain.triggerNodeId + ":" + chain.nodeIds.join(",");
}

export function useWorkflowDetection(mutations: WorkflowMutationsApi, boardId: string) {
  const prevChainsRef = useRef<Map<string, string>>(new Map()); // triggerNodeId → chainKey
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const run = () => {
      const { nodes, edges, workflows } = useBoardStore.getState();
      const chains = detectWorkflowChains(nodes, edges, workflows);
      console.log("[wf-detection] workflows in store:", Array.from(workflows.entries()).map(([id, wf]) => ({ id, name: wf.name, status: wf.stream.status })));
      console.log("[wf-detection] detected chains:", chains.map(c => ({ trigger: c.triggerNodeId, nodes: c.nodeIds })));
      console.log("[wf-detection] node assignments:", Array.from(nodes.values()).map(n => ({ id: n.id, type: n.type, workflowId: n.workflowId })));

      // Build current trigger→chainKey map
      const currentChains = new Map<string, DetectedChain>();
      for (const chain of chains) {
        currentChains.set(chain.triggerNodeId, chain);
      }

      // Build trigger→workflowId for existing workflows
      const triggerToWfId = new Map<string, string>();
      for (const node of nodes.values()) {
        if (node.type === "event-trigger" && node.workflowId !== UNASSIGNED_WORKFLOW_ID) {
          triggerToWfId.set(node.id, node.workflowId);
        }
      }

      // --- New chains: trigger has a complete chain but no workflow ---
      for (const [triggerId, chain] of currentChains) {
        const key = chainKey(chain);
        const prev = prevChainsRef.current.get(triggerId);
        if (prev === key) continue; // unchanged

        const existingWfId = triggerToWfId.get(triggerId);
        const webhookNodeId = chain.nodeIds.find(
          (id) => nodes.get(id)?.type === "webhook-action",
        );

        if (existingWfId) {
          mutations.reassignWorkflowChain(existingWfId, chain.nodeIds, chain.edgeIds, webhookNodeId);
        } else {
          // Dedup: check if another workflow already contains this trigger
          let alreadyOwned = false;
          for (const wf of workflows.values()) {
            const wfNodes = Array.from(nodes.values()).filter((n) => n.workflowId === wf.id);
            if (wfNodes.some((n) => n.id === triggerId)) {
              alreadyOwned = true;
              break;
            }
          }
          if (alreadyOwned) continue;

          const wfId = crypto.randomUUID();
          const wfName = `Workflow ${workflows.size + 1}`;
          mutations.createWorkflowWithNodes(
            { id: wfId, name: wfName, stream: { ...DEFAULT_STREAM } },
            chain.nodeIds,
            chain.edgeIds,
            webhookNodeId,
          );
        }
      }

      // --- Broken chains: trigger had a workflow but chain is now incomplete ---
      for (const [triggerId, prevKey] of prevChainsRef.current) {
        if (currentChains.has(triggerId)) continue; // still valid

        const existingWfId = triggerToWfId.get(triggerId);
        if (!existingWfId) continue;

        const wf = workflows.get(existingWfId);
        if (!wf) continue;

        // Protect non-draft workflows
        if (wf.stream.status !== "draft") continue;

        mutations.unlinkWorkflow(existingWfId);
      }

      // --- Orphan cleanup: remove draft workflow records with 0 assigned nodes ---
      for (const [wfId, wf] of workflows) {
        if (wf.stream.status !== "draft") continue;
        const hasNodes = Array.from(nodes.values()).some((n) => n.workflowId === wfId);
        if (!hasNodes) {
          console.log("[wf-detection] cleaning up orphaned workflow", wfId, wf.name);
          mutations.unlinkWorkflow(wfId);
        }
      }

      // Update prev ref
      const nextPrev = new Map<string, string>();
      for (const [triggerId, chain] of currentChains) {
        nextPrev.set(triggerId, chainKey(chain));
      }
      prevChainsRef.current = nextPrev;
    };

    const unsubscribe = useBoardStore.subscribe(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, 100);
    });

    // Run once on mount
    run();

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mutations, boardId]);
}

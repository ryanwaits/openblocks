import type { WorkflowNode, WorkflowEdge } from "@/types/workflow";

export interface WorkflowMutationsApi {
  addNode: (node: WorkflowNode) => void;
  updateNode: (node: WorkflowNode) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  deleteEdge: (edgeId: string) => void;
  updateMeta: (updates: Record<string, unknown>) => void;
  updateCursor: (x: number, y: number) => void;
}

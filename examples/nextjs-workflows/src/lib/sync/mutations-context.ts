import type { WorkflowNode, WorkflowEdge, WorkflowRecord, BoardMeta } from "@/types/workflow";

export interface WorkflowMutationsApi {
  addNode: (node: WorkflowNode) => void;
  updateNode: (node: WorkflowNode) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  deleteEdge: (edgeId: string) => void;
  addWorkflow: (wf: WorkflowRecord) => void;
  updateWorkflow: (wfId: string, updates: Partial<WorkflowRecord>) => void;
  deleteWorkflow: (wfId: string) => void;
  unlinkWorkflow: (wfId: string) => void;
  setWorkflowIds: (nodeIds: string[], edgeIds: string[], workflowId: string) => void;
  updateBoardMeta: (updates: Partial<BoardMeta>) => void;
  moveNodes: (updates: { id: string; position: { x: number; y: number } }[]) => void;
  updateCursor: (x: number, y: number) => void;
}

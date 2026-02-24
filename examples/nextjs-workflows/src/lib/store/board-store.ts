import { create } from "zustand";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type {
  WorkflowNode,
  WorkflowEdge,
  BoardMeta,
  WorkflowRecord,
  StreamState,
} from "@/types/workflow";

export const DEFAULT_STREAM: StreamState = {
  streamId: null,
  status: "draft",
  lastDeployedAt: null,
  errorMessage: null,
  totalDeliveries: 0,
  failedDeliveries: 0,
  lastTriggeredAt: null,
  lastTriggeredBlock: null,
};

interface BoardState {
  boardMeta: BoardMeta;
  workflows: Map<string, WorkflowRecord>;
  nodes: Map<string, WorkflowNode>;
  edges: Map<string, WorkflowEdge>;
  selectedWorkflowId: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: Set<string>;
  configNodeId: string | null;

  // Sync methods — called exclusively by useLivelySync
  syncNodes: (nodes: WorkflowNode[]) => void;
  syncEdges: (edges: WorkflowEdge[]) => void;
  syncWorkflows: (workflows: WorkflowRecord[]) => void;
  syncBoardMeta: (meta: BoardMeta) => void;

  // Selection — local UI state only
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  selectWorkflow: (id: string | null) => void;
  openConfig: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  setSelectedNodeIds: (ids: Set<string>) => void;
  clearSelection: () => void;

  // Derived helpers
  getWorkflowNodes: (wfId: string) => WorkflowNode[];
  getWorkflowEdges: (wfId: string) => WorkflowEdge[];
  getConnectedNodeIds: (nodeId: string) => string[];
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boardMeta: { name: "Untitled Board" },
  workflows: new Map(),
  nodes: new Map(),
  edges: new Map(),
  selectedWorkflowId: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedNodeIds: new Set(),
  configNodeId: null,

  syncNodes: (nodes) => {
    const map = new Map<string, WorkflowNode>();
    for (const n of nodes) map.set(n.id, n);
    set({ nodes: map });
  },

  syncEdges: (edges) => {
    const map = new Map<string, WorkflowEdge>();
    for (const e of edges) map.set(e.id, e);
    set({ edges: map });
  },

  syncWorkflows: (workflows) => {
    const map = new Map<string, WorkflowRecord>();
    for (const wf of workflows) map.set(wf.id, wf);
    set({ workflows: map });
  },

  syncBoardMeta: (meta) => set({ boardMeta: meta }),

  selectNode: (id) => {
    const state = get();
    if (id) {
      const node = state.nodes.get(id);
      if (node) {
        const wfId = node.workflowId === UNASSIGNED_WORKFLOW_ID ? null : node.workflowId;
        set({ selectedNodeId: id, selectedEdgeId: null, selectedNodeIds: new Set(), selectedWorkflowId: wfId });
        return;
      }
    }
    set({ selectedNodeId: id, selectedEdgeId: null, selectedNodeIds: new Set() });
  },

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  selectWorkflow: (id) => set({ selectedWorkflowId: id }),

  toggleNodeSelection: (id) => {
    const state = get();
    const next = new Set(state.selectedNodeIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedNodeIds: next });
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  clearSelection: () => set({ selectedNodeIds: new Set(), selectedNodeId: null }),

  openConfig: (id) => {
    const state = get();
    if (id) {
      const node = state.nodes.get(id);
      if (node) {
        const wfId = node.workflowId === UNASSIGNED_WORKFLOW_ID ? null : node.workflowId;
        set({ configNodeId: id, selectedNodeId: id, selectedEdgeId: null, selectedWorkflowId: wfId });
        return;
      }
    }
    set({ configNodeId: id, selectedNodeId: id, selectedEdgeId: null });
  },

  getWorkflowNodes: (wfId) => {
    return Array.from(get().nodes.values()).filter((n) => n.workflowId === wfId);
  },

  getWorkflowEdges: (wfId) => {
    return Array.from(get().edges.values()).filter((e) => e.workflowId === wfId);
  },

  getConnectedNodeIds: (nodeId) => {
    const state = get();
    const node = state.nodes.get(nodeId);
    if (!node) return [];
    // Unassigned nodes are standalone — don't select all unassigned
    if (node.workflowId === UNASSIGNED_WORKFLOW_ID) return [node.id];
    return Array.from(state.nodes.values())
      .filter((n) => n.workflowId === node.workflowId)
      .map((n) => n.id);
  },
}));

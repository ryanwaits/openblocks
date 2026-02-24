import { create } from "zustand";
import type { WorkflowNodeType } from "@/types/workflow";

interface ConnectionDraft {
  sourceNodeId: string;
  sourcePortId: string;
  cursorX: number;
  cursorY: number;
}

interface PlacementMode {
  nodeType: WorkflowNodeType;
  workflowId?: string;
}

export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CanvasInteractionState {
  tool: "select" | "hand";
  setTool: (tool: "select" | "hand") => void;
  connectionDraft: ConnectionDraft | null;
  setConnectionDraft: (draft: ConnectionDraft | null) => void;
  draggingNodeId: string | null;
  setDraggingNodeId: (id: string | null) => void;
  placementMode: PlacementMode | null;
  setPlacementMode: (mode: PlacementMode | null) => void;
  clearPlacementMode: () => void;
  marqueeRect: MarqueeRect | null;
  setMarqueeRect: (rect: MarqueeRect | null) => void;
}

export const useCanvasInteractionStore = create<CanvasInteractionState>((set) => ({
  tool: "select",
  setTool: (tool) => set({ tool }),
  connectionDraft: null,
  setConnectionDraft: (draft) => set({ connectionDraft: draft }),
  draggingNodeId: null,
  setDraggingNodeId: (id) => set({ draggingNodeId: id }),
  placementMode: null,
  setPlacementMode: (mode) => set({ placementMode: mode }),
  clearPlacementMode: () => set({ placementMode: null }),
  marqueeRect: null,
  setMarqueeRect: (rect) => set({ marqueeRect: rect }),
}));

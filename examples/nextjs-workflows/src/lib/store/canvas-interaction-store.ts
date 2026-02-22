import { create } from "zustand";

interface ConnectionDraft {
  sourceNodeId: string;
  sourcePortId: string;
  cursorX: number;
  cursorY: number;
}

interface CanvasInteractionState {
  tool: "select" | "hand";
  setTool: (tool: "select" | "hand") => void;
  connectionDraft: ConnectionDraft | null;
  setConnectionDraft: (draft: ConnectionDraft | null) => void;
  draggingNodeId: string | null;
  setDraggingNodeId: (id: string | null) => void;
}

export const useCanvasInteractionStore = create<CanvasInteractionState>((set) => ({
  tool: "select",
  setTool: (tool) => set({ tool }),
  connectionDraft: null,
  setConnectionDraft: (draft) => set({ connectionDraft: draft }),
  draggingNodeId: null,
  setDraggingNodeId: (id) => set({ draggingNodeId: id }),
}));

import { create } from "zustand";
import type { UndoEntry } from "@/types/undo";

const MAX_STACK = 50;

interface UndoState {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  push: (entry: UndoEntry) => void;
  popUndo: () => UndoEntry | undefined;
  popRedo: () => UndoEntry | undefined;
  clear: () => void;
}

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  push: (entry) =>
    set((state) => {
      const stack = [...state.undoStack, entry];
      if (stack.length > MAX_STACK) stack.shift();
      return { undoStack: stack, redoStack: [] };
    }),

  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return undefined;
    const entry = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    }));
    return entry;
  },

  popRedo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return undefined;
    const entry = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry],
    }));
    return entry;
  },

  clear: () => set({ undoStack: [], redoStack: [] }),
}));

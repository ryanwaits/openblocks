import { create } from "zustand";
import type { BoardObject } from "@/types/board";

interface BoardState {
  objects: Map<string, BoardObject>;
  selectedIds: Set<string>;
  syncAll: (objects: BoardObject[]) => void;
  setSelected: (id: string | null) => void;
  setSelectedIds: (ids: Set<string>) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: new Map(),
  selectedIds: new Set(),

  syncAll: (objects) =>
    set((state) => {
      const map = new Map<string, BoardObject>();
      for (const obj of objects) map.set(obj.id, obj);
      let selectedIds = state.selectedIds;
      for (const id of state.selectedIds) {
        if (!map.has(id)) {
          if (selectedIds === state.selectedIds)
            selectedIds = new Set(state.selectedIds);
          selectedIds.delete(id);
        }
      }
      return { objects: map, selectedIds };
    }),

  setSelected: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
}));

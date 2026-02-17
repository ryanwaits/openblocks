import { create } from "zustand";
import type { BoardObject } from "@/types/board";

interface BoardState {
  objects: Map<string, BoardObject>;
  selectedIds: Set<string>;
  syncAll: (objects: BoardObject[]) => void;
  addObject: (object: BoardObject) => void;
  updateObject: (object: BoardObject) => void;
  deleteObject: (objectId: string) => void;
  setSelected: (id: string | null) => void;
  setSelectedIds: (ids: Set<string>) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: new Map(),
  selectedIds: new Set(),

  syncAll: (objects) =>
    set(() => {
      const map = new Map<string, BoardObject>();
      for (const obj of objects) {
        map.set(obj.id, obj);
      }
      return { objects: map };
    }),

  addObject: (object) =>
    set((state) => {
      const next = new Map(state.objects);
      next.set(object.id, object);
      return { objects: next };
    }),

  updateObject: (object) =>
    set((state) => {
      const next = new Map(state.objects);
      next.set(object.id, object);
      return { objects: next };
    }),

  deleteObject: (objectId) =>
    set((state) => {
      const next = new Map(state.objects);
      next.delete(objectId);
      const nextSelected = new Set(state.selectedIds);
      nextSelected.delete(objectId);
      return { objects: next, selectedIds: nextSelected };
    }),

  setSelected: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
}));

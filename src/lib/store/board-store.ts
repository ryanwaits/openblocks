import { create } from "zustand";
import type { BoardObject } from "@/types/board";

interface BoardState {
  objects: Map<string, BoardObject>;
  selectedId: string | null;
  syncAll: (objects: BoardObject[]) => void;
  addObject: (object: BoardObject) => void;
  updateObject: (object: BoardObject) => void;
  deleteObject: (objectId: string) => void;
  setSelected: (id: string | null) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: new Map(),
  selectedId: null,

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
      return { objects: next, selectedId: state.selectedId === objectId ? null : state.selectedId };
    }),

  setSelected: (id) => set({ selectedId: id }),
}));

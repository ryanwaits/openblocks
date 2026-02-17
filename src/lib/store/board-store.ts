import { create } from "zustand";
import type { BoardObject } from "@/types/board";

function buildConnectionIndex(objects: Map<string, BoardObject>): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const obj of objects.values()) {
    if (obj.type !== "line") continue;
    if (obj.start_object_id) {
      if (!index.has(obj.start_object_id)) index.set(obj.start_object_id, new Set());
      index.get(obj.start_object_id)!.add(obj.id);
    }
    if (obj.end_object_id) {
      if (!index.has(obj.end_object_id)) index.set(obj.end_object_id, new Set());
      index.get(obj.end_object_id)!.add(obj.id);
    }
  }
  return index;
}

function addToIndex(index: Map<string, Set<string>>, obj: BoardObject): Map<string, Set<string>> {
  if (obj.type !== "line") return index;
  const next = new Map(index);
  if (obj.start_object_id) {
    const set = new Set(next.get(obj.start_object_id) || []);
    set.add(obj.id);
    next.set(obj.start_object_id, set);
  }
  if (obj.end_object_id) {
    const set = new Set(next.get(obj.end_object_id) || []);
    set.add(obj.id);
    next.set(obj.end_object_id, set);
  }
  return next;
}

function removeFromIndex(index: Map<string, Set<string>>, obj: BoardObject | undefined, objectId: string): Map<string, Set<string>> {
  const next = new Map(index);
  // Remove objectId from all sets (it might be a shape that lines connect to)
  const connectedLines = next.get(objectId);
  if (connectedLines) {
    next.delete(objectId);
  }
  // If it's a line, remove its entries from connected shapes
  if (obj?.type === "line") {
    if (obj.start_object_id) {
      const set = next.get(obj.start_object_id);
      if (set) {
        const newSet = new Set(set);
        newSet.delete(objectId);
        if (newSet.size === 0) next.delete(obj.start_object_id);
        else next.set(obj.start_object_id, newSet);
      }
    }
    if (obj.end_object_id) {
      const set = next.get(obj.end_object_id);
      if (set) {
        const newSet = new Set(set);
        newSet.delete(objectId);
        if (newSet.size === 0) next.delete(obj.end_object_id);
        else next.set(obj.end_object_id, newSet);
      }
    }
  }
  return next;
}

interface BoardState {
  objects: Map<string, BoardObject>;
  connectionIndex: Map<string, Set<string>>;
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
  connectionIndex: new Map(),
  selectedIds: new Set(),

  syncAll: (objects) =>
    set(() => {
      const map = new Map<string, BoardObject>();
      for (const obj of objects) {
        map.set(obj.id, obj);
      }
      return { objects: map, connectionIndex: buildConnectionIndex(map) };
    }),

  addObject: (object) =>
    set((state) => {
      const next = new Map(state.objects);
      next.set(object.id, object);
      return { objects: next, connectionIndex: addToIndex(state.connectionIndex, object) };
    }),

  updateObject: (object) =>
    set((state) => {
      const prev = state.objects.get(object.id);
      const next = new Map(state.objects);
      next.set(object.id, object);
      // If connection endpoints changed, rebuild index for this object
      let newIndex = state.connectionIndex;
      if (object.type === "line" && prev?.type === "line" &&
          (prev.start_object_id !== object.start_object_id || prev.end_object_id !== object.end_object_id)) {
        newIndex = removeFromIndex(newIndex, prev, object.id);
        newIndex = addToIndex(newIndex, object);
      }
      return { objects: next, connectionIndex: newIndex };
    }),

  deleteObject: (objectId) =>
    set((state) => {
      const obj = state.objects.get(objectId);
      const next = new Map(state.objects);
      next.delete(objectId);
      const nextSelected = new Set(state.selectedIds);
      nextSelected.delete(objectId);
      return {
        objects: next,
        selectedIds: nextSelected,
        connectionIndex: removeFromIndex(state.connectionIndex, obj, objectId),
      };
    }),

  setSelected: (id) => set({ selectedIds: id ? new Set([id]) : new Set() }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
}));

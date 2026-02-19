import { useCallback } from "react";
import { useUndoStore } from "@/lib/store/undo-store";
import type { BoardObject } from "@/types/board";
import type { UndoEntry } from "@/types/undo";

interface MutationFns {
  createObject: (obj: BoardObject) => void;
  updateObject: (obj: BoardObject) => void;
  deleteObject: (id: string) => void;
}

export function useUndoRedo(mutations: MutationFns) {
  const recordAction = useCallback(
    (entry: UndoEntry) => {
      useUndoStore.getState().push(entry);
    },
    []
  );

  const applyInverse = useCallback(
    (entry: UndoEntry) => {
      switch (entry.type) {
        case "create":
          for (const obj of entry.objects) {
            mutations.deleteObject(obj.id);
          }
          break;
        case "delete":
          for (const obj of entry.objects) {
            mutations.createObject(obj);
          }
          break;
        case "update":
          for (const obj of entry.before) {
            mutations.updateObject(obj);
          }
          break;
      }
    },
    [mutations]
  );

  const applyForward = useCallback(
    (entry: UndoEntry) => {
      switch (entry.type) {
        case "create":
          for (const obj of entry.objects) {
            mutations.createObject(obj);
          }
          break;
        case "delete":
          for (const obj of entry.objects) {
            mutations.deleteObject(obj.id);
          }
          break;
        case "update":
          for (const obj of entry.after) {
            mutations.updateObject(obj);
          }
          break;
      }
    },
    [mutations]
  );

  const undo = useCallback(() => {
    const entry = useUndoStore.getState().popUndo();
    if (entry) applyInverse(entry);
  }, [applyInverse]);

  const redo = useCallback(() => {
    const entry = useUndoStore.getState().popRedo();
    if (entry) applyForward(entry);
  }, [applyForward]);

  return { recordAction, undo, redo };
}

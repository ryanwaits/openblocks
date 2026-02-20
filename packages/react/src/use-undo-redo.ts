import { useSyncExternalStore, useCallback } from "react";
import { useRoom } from "./room-context.js";

/**
 * Returns a stable callback that triggers undo on the room's storage.
 */
export function useUndo(): () => void {
  const room = useRoom();
  return useCallback(() => (room as any).undo(), [room]);
}

/**
 * Returns a stable callback that triggers redo on the room's storage.
 */
export function useRedo(): () => void {
  const room = useRoom();
  return useCallback(() => (room as any).redo(), [room]);
}

/**
 * Returns whether undo is available. Re-renders when this changes.
 */
export function useCanUndo(): boolean {
  const room = useRoom();

  return useSyncExternalStore(
    useCallback(
      (cb) => {
        const history = (room as any).getHistory();
        return history ? history.subscribe(cb) : () => {};
      },
      [room]
    ),
    useCallback(() => {
      const history = (room as any).getHistory();
      return history ? history.canUndo() : false;
    }, [room]),
    () => false
  );
}

/**
 * Returns whether redo is available. Re-renders when this changes.
 */
export function useCanRedo(): boolean {
  const room = useRoom();

  return useSyncExternalStore(
    useCallback(
      (cb) => {
        const history = (room as any).getHistory();
        return history ? history.subscribe(cb) : () => {};
      },
      [room]
    ),
    useCallback(() => {
      const history = (room as any).getHistory();
      return history ? history.canRedo() : false;
    }, [room]),
    () => false
  );
}

/**
 * Combined hook returning all undo/redo utilities.
 */
export function useHistory(): {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
} {
  return {
    undo: useUndo(),
    redo: useRedo(),
    canUndo: useCanUndo(),
    canRedo: useCanRedo(),
  };
}

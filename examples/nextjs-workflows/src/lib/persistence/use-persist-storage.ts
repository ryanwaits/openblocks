"use client";

import { useEffect } from "react";
import { useRoom, useStorageRoot } from "@waits/lively-react";
import { saveSnapshot } from "./indexeddb";

const DEBOUNCE_MS = 2000;

/**
 * Subscribes deeply to storage changes and debounce-saves
 * serialized snapshots to IndexedDB for offline recovery.
 */
export function usePersistStorage(roomId: string): void {
  const room = useRoom();
  const storage = useStorageRoot();
  const root = storage?.root ?? null;

  useEffect(() => {
    if (!root) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    function persist() {
      const currentRoot = room.getCurrentRoot();
      if (!currentRoot) return;
      const snapshot = currentRoot._serialize();
      saveSnapshot(roomId, snapshot);
    }

    function handleChange() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(persist, DEBOUNCE_MS);
    }

    // Save initial state
    persist();

    const unsub = room.subscribe(root, handleChange, { isDeep: true });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [root, room, roomId]);
}

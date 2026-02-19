"use client";

import { useEffect, useRef } from "react";
import type { LiveObject, LiveMap, PresenceUser, CursorData } from "@waits/openblocks-client";
import { useBoardRoom } from "./openblocks-provider";
import { useBoardStore } from "@/lib/store/board-store";
import { usePresenceStore } from "@/lib/store/presence-store";
import { useFrameStore } from "@/lib/store/frame-store";
import { useUndoStore } from "@/lib/store/undo-store";
import type { BoardObject, Frame } from "@/types/board";

function shallowEqual(a: BoardObject, b: BoardObject): boolean {
  const keysA = Object.keys(a) as (keyof BoardObject)[];
  const keysB = Object.keys(b) as (keyof BoardObject)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function liveObjectToBoardObject(lo: LiveObject): BoardObject | null {
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  const obj = { ...raw } as unknown as BoardObject;
  if (typeof obj.points === "string") {
    try {
      obj.points = JSON.parse(obj.points as unknown as string);
    } catch {
      obj.points = undefined;
    }
  }
  return obj;
}

function liveObjectToFrame(lo: LiveObject): Frame | null {
  if (typeof lo.toObject !== "function") return null;
  return lo.toObject() as unknown as Frame;
}

export function useOpenBlocksSync() {
  const { room, root, status } = useBoardRoom();
  const isConnected = status === "connected";

  const { addObject, updateObject, deleteObject, syncAll } = useBoardStore();
  const { updatePresence, updateCursor } = usePresenceStore();

  const prevObjectsRef = useRef<Map<string, BoardObject>>(new Map());
  const initialSyncDone = useRef(false);

  // Bridge presence → Zustand
  useEffect(() => {
    const sync = () => {
      const self = room.getSelf();
      const others = room.getOthers();
      const all = self ? [self, ...others] : [...others];
      // Deduplicate by userId (a user may have multiple connections/tabs)
      const seen = new Set<string>();
      const users = all.filter((u) => {
        if (seen.has(u.userId)) return false;
        seen.add(u.userId);
        return true;
      });
      updatePresence(users);
    };
    sync();
    return room.subscribe("presence", sync);
  }, [room, updatePresence]);

  // Bridge cursors → Zustand
  useEffect(() => {
    return room.subscribe("cursors", () => {
      room.getCursors().forEach((cursor: CursorData) => {
        updateCursor(cursor);
      });
    });
  }, [room, updateCursor]);

  // Subscribe to CRDT storage changes → Zustand
  useEffect(() => {
    if (!root) return;

    const objectsMap = root.get("objects") as LiveMap<LiveObject> | undefined;
    const framesMap = root.get("frames") as LiveMap<LiveObject> | undefined;

    function syncObjects() {
      if (!objectsMap) return;

      const prev = prevObjectsRef.current;
      const next = new Map<string, BoardObject>();
      objectsMap.forEach((lo: LiveObject, key: string) => {
        const obj = liveObjectToBoardObject(lo);
        if (obj) next.set(key, obj);
      });

      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        syncAll(Array.from(next.values()));
        prevObjectsRef.current = next;
        useUndoStore.getState().clear();
        return;
      }

      for (const [id, obj] of next) {
        const prevObj = prev.get(id);
        if (!prevObj) {
          addObject(obj);
        } else if (!shallowEqual(prevObj, obj)) {
          updateObject(obj);
        }
      }
      for (const id of prev.keys()) {
        if (!next.has(id)) {
          deleteObject(id);
        }
      }
      prevObjectsRef.current = next;
    }

    function syncFrames() {
      if (!framesMap) return;
      const frames: Frame[] = [];
      framesMap.forEach((lo: LiveObject) => {
        const frame = liveObjectToFrame(lo);
        if (frame) frames.push(frame);
      });
      useFrameStore.getState().syncFrames(frames);
    }

    syncObjects();
    syncFrames();

    const unsubObjects = objectsMap
      ? room.subscribe(objectsMap, syncObjects, { isDeep: true })
      : undefined;
    const unsubFrames = framesMap
      ? room.subscribe(framesMap, syncFrames, { isDeep: true })
      : undefined;

    return () => {
      unsubObjects?.();
      unsubFrames?.();
    };
  }, [root, room, syncAll, addObject, updateObject, deleteObject]);

  return { isConnected, room, root };
}

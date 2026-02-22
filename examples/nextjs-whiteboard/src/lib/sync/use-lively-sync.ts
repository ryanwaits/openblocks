"use client";

import { useEffect } from "react";
import type { LiveObject, LiveMap } from "@waits/lively-client";
import { useRoom, useStorageRoot } from "@waits/lively-react";
import { useBoardStore } from "@/lib/store/board-store";
import { useFrameStore } from "@/lib/store/frame-store";
import type { BoardObject, Frame } from "@/types/board";
import { findFrameForPosition } from "@/lib/geometry/frames";

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

export function useLivelySync(): void {
  const room = useRoom();
  const storage = useStorageRoot();
  const root = storage?.root ?? null;

  const syncAll = useBoardStore((s) => s.syncAll);

  useEffect(() => {
    if (!root) return;

    const objectsMap = root.get("objects") as LiveMap<LiveObject> | undefined;
    const framesMap = root.get("frames") as LiveMap<LiveObject> | undefined;

    function syncObjects() {
      if (!objectsMap) return;
      const arr: BoardObject[] = [];
      const currentFrames = useFrameStore.getState().frames;
      objectsMap.forEach((lo: LiveObject) => {
        const obj = liveObjectToBoardObject(lo);
        if (obj) {
          // Lazy migration: compute frame_id for legacy objects without one
          if (!obj.frame_id && currentFrames.length > 0) {
            obj.frame_id = findFrameForPosition(obj.x, obj.y, obj.width, obj.height, currentFrames);
          }
          arr.push(obj);
        }
      });
      syncAll(arr);
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
  }, [root, room, syncAll]);
}

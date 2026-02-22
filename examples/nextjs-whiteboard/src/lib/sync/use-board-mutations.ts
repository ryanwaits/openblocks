"use client";

import { useCallback } from "react";
import { type LiveMap, LiveObject as LO } from "@waits/lively-client";
import type { LiveObject } from "@waits/lively-client";
import { useMutation, useUpdateCursor } from "@waits/lively-react";
import type { BoardObject, Frame } from "@/types/board";
import { useViewportStore } from "@/lib/store/viewport-store";
import { cascadeDeleteFrame } from "./cascade-delete-frame";

function boardObjectToLiveData(obj: BoardObject): Record<string, unknown> {
  const data: Record<string, unknown> = { ...obj };
  // Serialize points as JSON string for CRDT storage
  if (obj.points) {
    data.points = JSON.stringify(obj.points);
  }
  return data;
}

export function useBoardMutations() {
  const updateCursorFn = useUpdateCursor();

  const createObject = useMutation(
    ({ storage }, obj: BoardObject) => {
      const objects = storage.root.get("objects") as LiveMap<LiveObject>;
      objects.set(obj.id, new LO(boardObjectToLiveData(obj)));
    },
    []
  );

  const updateObject = useMutation(
    ({ storage }, obj: BoardObject) => {
      const objects = storage.root.get("objects") as LiveMap<LiveObject>;
      const existing = objects.get(obj.id);
      if (!existing) return;
      // Only send fields that actually changed — avoids inflating Lamport clocks
      const newData = boardObjectToLiveData(obj);
      const diff: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(newData)) {
        if (existing.get(key) !== value) {
          diff[key] = value;
        }
      }
      diff.updated_at = new Date().toISOString();
      if (Object.keys(diff).length <= 1) return; // only updated_at, nothing changed
      existing.update(diff);
    },
    []
  );

  const deleteObject = useMutation(
    ({ storage }, id: string) => {
      (storage.root.get("objects") as LiveMap<LiveObject>).delete(id);
    },
    []
  );

  const createFrame = useMutation(
    ({ storage }, frame: Frame) => {
      (storage.root.get("frames") as LiveMap<LiveObject>).set(frame.id, new LO({ ...frame }));
    },
    []
  );

  const deleteFrame = useMutation(
    ({ storage }, frameId: string) => {
      const objects = storage.root.get("objects") as LiveMap<LiveObject>;
      const frames = storage.root.get("frames") as LiveMap<LiveObject>;
      cascadeDeleteFrame(objects, frames, frameId);
    },
    []
  );

  const renameFrame = useMutation(
    ({ storage }, frameId: string, newLabel: string) => {
      const frames = storage.root.get("frames") as LiveMap<LiveObject>;
      const frame = frames.get(frameId);
      if (frame) frame.update({ label: newLabel });
    },
    []
  );

  const updateCursor = useCallback(
    (x: number, y: number) => {
      const { pos, scale } = useViewportStore.getState();
      updateCursorFn(x, y, pos, scale);
    },
    [updateCursorFn]
  );

  return { createObject, updateObject, deleteObject, createFrame, deleteFrame, renameFrame, updateCursor };
}

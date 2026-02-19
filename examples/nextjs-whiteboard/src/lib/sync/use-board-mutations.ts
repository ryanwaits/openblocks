"use client";

import { useCallback, useMemo } from "react";
import { type Room, type LiveMap, LiveObject as LO } from "@waits/openblocks-client";
import type { LiveObject } from "@waits/openblocks-client";
import type { BoardObject, Frame } from "@/types/board";
import { frameOriginX, FRAME_ORIGIN_Y, BOARD_WIDTH, BOARD_HEIGHT } from "@/lib/geometry/frames";

function boardObjectToLiveData(obj: BoardObject): Record<string, unknown> {
  const data: Record<string, unknown> = { ...obj };
  // Serialize points as JSON string for CRDT storage
  if (obj.points) {
    data.points = JSON.stringify(obj.points);
  }
  return data;
}

export function useBoardMutations(room: Room, root: LiveObject | null) {
  const objectsMap = useMemo(
    () => root?.get("objects") as LiveMap<LiveObject> | undefined,
    [root]
  );
  const framesMap = useMemo(
    () => root?.get("frames") as LiveMap<LiveObject> | undefined,
    [root]
  );

  const createObject = useCallback(
    (obj: BoardObject) => {
      if (!objectsMap) return;
      room.batch(() => {
        objectsMap.set(obj.id, new LO(boardObjectToLiveData(obj)));
      });
    },
    [room, objectsMap]
  );

  const updateObject = useCallback(
    (obj: BoardObject) => {
      if (!objectsMap) return;
      const existing = objectsMap.get(obj.id);
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
      room.batch(() => {
        existing.update(diff);
      });
    },
    [room, objectsMap]
  );

  const deleteObject = useCallback(
    (id: string) => {
      if (!objectsMap) return;
      room.batch(() => {
        objectsMap.delete(id);
      });
    },
    [room, objectsMap]
  );

  const createFrame = useCallback(
    (frame: Frame) => {
      if (!framesMap) return;
      room.batch(() => {
        framesMap.set(frame.id, new LO({ ...frame }));
      });
    },
    [room, framesMap]
  );

  const deleteFrame = useCallback(
    (frameId: string) => {
      if (!framesMap || !objectsMap) return;
      const frameLO = framesMap.get(frameId);
      if (!frameLO) return;

      const frameData = frameLO.toObject() as unknown as Frame;

      room.batch(() => {
        // Compute frame bounds
        const fx = frameOriginX(frameData.index);
        const fy = FRAME_ORIGIN_Y;
        const fr = fx + BOARD_WIDTH;
        const fb = fy + BOARD_HEIGHT;

        // Collect objects to delete (center within frame bounds)
        const deletedIds = new Set<string>();
        objectsMap.forEach((lo: LiveObject, id: string) => {
          const obj = lo.toObject() as unknown as BoardObject;
          if (obj.type === "line") return;
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          if (cx >= fx && cx <= fr && cy >= fy && cy <= fb) {
            deletedIds.add(id);
          }
        });

        // Cascade: lines connected to deleted objects
        objectsMap.forEach((lo: LiveObject, id: string) => {
          const obj = lo.toObject() as unknown as BoardObject;
          if (obj.type !== "line") return;
          if ((obj.start_object_id && deletedIds.has(obj.start_object_id)) ||
              (obj.end_object_id && deletedIds.has(obj.end_object_id))) {
            deletedIds.add(id);
          }
        });

        // Unconnected lines within bounds
        objectsMap.forEach((lo: LiveObject, id: string) => {
          if (deletedIds.has(id)) return;
          const obj = lo.toObject() as unknown as BoardObject;
          if (obj.type !== "line") return;
          let points = obj.points;
          if (typeof points === "string") {
            try { points = JSON.parse(points as unknown as string); } catch { return; }
          }
          if (points && points.length >= 2) {
            const cx = (points[0].x + points[points.length - 1].x) / 2;
            const cy = (points[0].y + points[points.length - 1].y) / 2;
            if (cx >= fx && cx <= fr && cy >= fy && cy <= fb) {
              deletedIds.add(id);
            }
          }
        });

        // Delete objects
        for (const id of deletedIds) {
          objectsMap.delete(id);
        }

        // Delete frame
        framesMap.delete(frameId);
      });
    },
    [room, framesMap, objectsMap]
  );

  const updateCursor = useCallback(
    (x: number, y: number) => {
      room.updateCursor(x, y);
    },
    [room]
  );

  return { createObject, updateObject, deleteObject, createFrame, deleteFrame, updateCursor };
}

"use client";

import { useCallback, useRef, useState } from "react";
import { computeLineBounds } from "@/lib/geometry/edge-intersection";
import type { BoardObject } from "@/types/board";

interface LineDrawingState {
  points: Array<{ x: number; y: number }>;
  isDrawing: boolean;
  cursorPos: { x: number; y: number } | null;
  startObjectId: string | null;
  endObjectId: string | null;
}

interface UseLineDrawingReturn {
  drawingState: LineDrawingState;
  startPoint: (pos: { x: number; y: number }, objectId?: string | null) => void;
  addPoint: (pos: { x: number; y: number }, objectId?: string | null) => void;
  setCursorPos: (pos: { x: number; y: number } | null) => void;
  finalize: (boardId: string, userId: string | null, displayName: string | undefined, zIndex: number) => BoardObject | null;
  cancel: () => void;
  removeLastPoint: () => void;
}

const INITIAL_STATE: LineDrawingState = {
  points: [],
  isDrawing: false,
  cursorPos: null,
  startObjectId: null,
  endObjectId: null,
};

export function useLineDrawing(): UseLineDrawingReturn {
  const [state, setState] = useState<LineDrawingState>(INITIAL_STATE);
  const stateRef = useRef(state);

  const updateState = (next: LineDrawingState) => {
    stateRef.current = next;
    setState(next);
  };

  const startPoint = useCallback((pos: { x: number; y: number }, objectId?: string | null) => {
    updateState({
      points: [pos],
      isDrawing: true,
      cursorPos: null,
      startObjectId: objectId ?? null,
      endObjectId: null,
    });
  }, []);

  const addPoint = useCallback((pos: { x: number; y: number }, objectId?: string | null) => {
    const s = stateRef.current;
    if (!s.isDrawing) return;
    updateState({
      ...s,
      points: [...s.points, pos],
      endObjectId: objectId ?? s.endObjectId,
    });
  }, []);

  const setCursorPos = useCallback((pos: { x: number; y: number } | null) => {
    const s = stateRef.current;
    if (!s.isDrawing) return;
    updateState({ ...s, cursorPos: pos });
  }, []);

  const finalize = useCallback(
    (boardId: string, userId: string | null, displayName: string | undefined, zIndex: number): BoardObject | null => {
      const { points: rawPoints, startObjectId, endObjectId } = stateRef.current;
      if (rawPoints.length < 2) {
        updateState(INITIAL_STATE);
        return null;
      }

      // Deduplicate consecutive near-identical points (from double-click)
      const points = [rawPoints[0]];
      for (let i = 1; i < rawPoints.length; i++) {
        const prev = points[points.length - 1];
        const cur = rawPoints[i];
        if (Math.abs(cur.x - prev.x) > 1 || Math.abs(cur.y - prev.y) > 1) {
          points.push(cur);
        }
      }
      if (points.length < 2) {
        updateState(INITIAL_STATE);
        return null;
      }

      // Check minimum distance
      const first = points[0];
      const last = points[points.length - 1];
      const dist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2);
      if (dist < 5) {
        updateState(INITIAL_STATE);
        return null;
      }

      const bounds = computeLineBounds(points);
      const obj: BoardObject = {
        id: crypto.randomUUID(),
        board_id: boardId,
        type: "line",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color: "transparent",
        text: "",
        z_index: zIndex,
        created_by: userId,
        created_by_name: displayName,
        updated_at: new Date().toISOString(),
        points,
        stroke_color: "#374151",
        stroke_width: 2,
        end_arrow: true,
        start_object_id: startObjectId,
        end_object_id: endObjectId,
      };

      updateState(INITIAL_STATE);
      return obj;
    },
    []
  );

  const cancel = useCallback(() => {
    updateState(INITIAL_STATE);
  }, []);

  const removeLastPoint = useCallback(() => {
    const s = stateRef.current;
    if (!s.isDrawing || s.points.length <= 1) return;
    updateState({ ...s, points: s.points.slice(0, -1) });
  }, []);

  return {
    drawingState: state,
    startPoint,
    addPoint,
    setCursorPos,
    finalize,
    cancel,
    removeLastPoint,
  };
}

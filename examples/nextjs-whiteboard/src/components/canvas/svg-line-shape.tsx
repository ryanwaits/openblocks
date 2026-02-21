"use client";

import { memo, useMemo, useCallback, useRef } from "react";
import { computeEdgePoint, computeLineBounds } from "@/lib/geometry/edge-intersection";
import { findSnapTarget } from "@/lib/geometry/snap";
import { useViewportStore } from "@/lib/store/viewport-store";
import type { BoardObject } from "@/types/board";

interface LineShapeProps {
  id: string;
  object: BoardObject;
  objects: Map<string, BoardObject>;
  isSelected: boolean;
  onSelect?: (id: string, shiftKey?: boolean) => void;
  onDragMove?: (id: string, x: number, y: number) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onLineUpdate?: (id: string, updates: Partial<BoardObject>) => void;
  onLineUpdateEnd?: (id: string, updates: Partial<BoardObject>) => void;
  interactive?: boolean;
}

/** Build an arrowhead polygon string pointing in the direction of (dx, dy) at tip (tx, ty). */
function arrowheadPoints(tx: number, ty: number, fx: number, fy: number, length = 10, width = 8): string {
  const dx = tx - fx;
  const dy = ty - fy;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return "";
  const ux = dx / mag;
  const uy = dy / mag;
  // Perpendicular
  const px = -uy;
  const py = ux;
  const baseX = tx - ux * length;
  const baseY = ty - uy * length;
  const hw = width / 2;
  return `${tx},${ty} ${baseX + px * hw},${baseY + py * hw} ${baseX - px * hw},${baseY - py * hw}`;
}

export const SvgLineShape = memo(function SvgLineShape({
  id, object, objects, isSelected, onSelect,
  onDragMove, onDragEnd,
  onLineUpdate, onLineUpdateEnd, interactive = true,
}: LineShapeProps) {
  const bodyDragRef = useRef<{ startPoints: Array<{ x: number; y: number }>; startClientX: number; startClientY: number; scale: number } | null>(null);

  // Resolve connected endpoints
  const resolvedPoints = useMemo(() => {
    const pts = object.points ? [...object.points] : [];
    if (pts.length < 2) return pts;
    if (object.start_object_id) {
      const startObj = objects.get(object.start_object_id);
      if (startObj) pts[0] = computeEdgePoint(startObj, pts[1]);
    }
    if (object.end_object_id) {
      const endObj = objects.get(object.end_object_id);
      if (endObj) pts[pts.length - 1] = computeEdgePoint(endObj, pts[pts.length - 2]);
    }
    return pts;
  }, [object.points, object.start_object_id, object.end_object_id, objects]);

  const midpoint = useMemo(() => {
    if (resolvedPoints.length === 0) return { x: 0, y: 0 };
    let sumX = 0, sumY = 0;
    for (const p of resolvedPoints) { sumX += p.x; sumY += p.y; }
    return { x: sumX / resolvedPoints.length, y: sumY / resolvedPoints.length };
  }, [resolvedPoints]);

  const segmentMidpoints = useMemo(() => {
    const mps: Array<{ x: number; y: number; segIndex: number }> = [];
    for (let i = 0; i < resolvedPoints.length - 1; i++) {
      mps.push({
        x: (resolvedPoints[i].x + resolvedPoints[i + 1].x) / 2,
        y: (resolvedPoints[i].y + resolvedPoints[i + 1].y) / 2,
        segIndex: i,
      });
    }
    return mps;
  }, [resolvedPoints]);

  // --- Body drag (only when not connected) ---
  const canDragBody = interactive && (!!onDragEnd || !!onLineUpdateEnd) && !object.start_object_id && !object.end_object_id;

  const handleBodyPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect?.(id, e.shiftKey);
    if (!canDragBody || !object.points) return;
    const scale = useViewportStore.getState().scale;
    const startBounds = computeLineBounds(object.points);
    bodyDragRef.current = {
      startPoints: [...object.points],
      startClientX: e.clientX,
      startClientY: e.clientY,
      scale,
    };
    const handleMove = (ev: PointerEvent) => {
      const d = bodyDragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      if (onDragMove) {
        onDragMove(id, startBounds.x + dx, startBounds.y + dy);
      } else {
        const newPoints = d.startPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const bounds = computeLineBounds(newPoints);
        (onLineUpdate ?? onLineUpdateEnd!)(id, {
          points: newPoints,
          x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
          start_object_id: null, end_object_id: null,
        });
      }
    };
    const handleUp = (ev: PointerEvent) => {
      const d = bodyDragRef.current;
      if (!d) { cleanup(); return; }
      const dx = (ev.clientX - d.startClientX) / d.scale;
      const dy = (ev.clientY - d.startClientY) / d.scale;
      if (onDragEnd) {
        onDragEnd(id, startBounds.x + dx, startBounds.y + dy);
      } else {
        const newPoints = d.startPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const bounds = computeLineBounds(newPoints);
        onLineUpdateEnd!(id, {
          points: newPoints,
          x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
          start_object_id: null, end_object_id: null,
        });
      }
      bodyDragRef.current = null;
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [id, onSelect, canDragBody, object.points, onDragMove, onDragEnd, onLineUpdate, onLineUpdateEnd]);

  // --- Endpoint drag ---
  const handleEndpointPointerDown = useCallback((pointIndex: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!onLineUpdate || !onLineUpdateEnd || !object.points) return;
    const scale = useViewportStore.getState().scale;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPoint = { ...object.points[pointIndex] };
    const isFirst = pointIndex === 0;
    const isLast = pointIndex === object.points.length - 1;

    const handleMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / scale;
      const dy = (ev.clientY - startClientY) / scale;
      const newPos = { x: startPoint.x + dx, y: startPoint.y + dy };
      const newPoints = [...object.points!];
      newPoints[pointIndex] = newPos;
      const bounds = computeLineBounds(newPoints);
      const snap = findSnapTarget(newPos, objects);
      const updates: Partial<BoardObject> = {
        points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
      };
      if (isFirst) updates.start_object_id = snap?.objectId ?? null;
      if (isLast) updates.end_object_id = snap?.objectId ?? null;
      onLineUpdate(id, updates);
    };

    const handleUp = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / scale;
      const dy = (ev.clientY - startClientY) / scale;
      const newPos = { x: startPoint.x + dx, y: startPoint.y + dy };
      const newPoints = [...object.points!];
      newPoints[pointIndex] = newPos;
      const snap = findSnapTarget(newPos, objects);
      if (snap) newPoints[pointIndex] = { x: snap.x, y: snap.y };
      const finalBounds = computeLineBounds(newPoints);
      const updates: Partial<BoardObject> = {
        points: newPoints, x: finalBounds.x, y: finalBounds.y, width: finalBounds.width, height: finalBounds.height,
      };
      if (isFirst) updates.start_object_id = snap?.objectId ?? null;
      if (isLast) updates.end_object_id = snap?.objectId ?? null;
      onLineUpdateEnd(id, updates);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [id, object.points, objects, onLineUpdate, onLineUpdateEnd]);

  // --- Midpoint click ---
  const handleMidpointClick = useCallback((segIndex: number, pos: { x: number; y: number }) => {
    if (!onLineUpdateEnd || !object.points) return;
    const newPoints = [...object.points];
    newPoints.splice(segIndex + 1, 0, pos);
    const bounds = computeLineBounds(newPoints);
    onLineUpdateEnd(id, {
      points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    });
  }, [id, object.points, onLineUpdateEnd]);

  if (resolvedPoints.length < 2) return null;

  const polylinePoints = resolvedPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const strokeColor = object.stroke_color || "#374151";
  const strokeWidth = object.stroke_width || 2;
  const hasStartArrow = object.start_arrow ?? false;
  const hasEndArrow = object.end_arrow ?? false;

  return (
    <g
      onPointerDown={handleBodyPointerDown}
      style={{ cursor: canDragBody ? "move" : interactive ? "pointer" : "default" }}
    >
      {/* Selection highlight */}
      {isSelected && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={strokeWidth + 6}
          opacity={0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}

      {/* Invisible hit area */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Main line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />

      {/* Start arrowhead */}
      {hasStartArrow && resolvedPoints.length >= 2 && (
        <polygon
          points={arrowheadPoints(
            resolvedPoints[0].x, resolvedPoints[0].y,
            resolvedPoints[1].x, resolvedPoints[1].y,
          )}
          fill={strokeColor}
          pointerEvents="none"
        />
      )}

      {/* End arrowhead */}
      {hasEndArrow && resolvedPoints.length >= 2 && (
        <polygon
          points={arrowheadPoints(
            resolvedPoints[resolvedPoints.length - 1].x, resolvedPoints[resolvedPoints.length - 1].y,
            resolvedPoints[resolvedPoints.length - 2].x, resolvedPoints[resolvedPoints.length - 2].y,
          )}
          fill={strokeColor}
          pointerEvents="none"
        />
      )}

      {/* Endpoint handles when selected */}
      {isSelected && interactive && resolvedPoints.map((p, i) => (
        <circle
          key={`ep-${i}`}
          cx={p.x}
          cy={p.y}
          r={5}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5}
          style={{ cursor: "crosshair" }}
          onPointerDown={(e) => handleEndpointPointerDown(i, e)}
        />
      ))}

      {/* Midpoint handles (diamonds) */}
      {isSelected && interactive && onLineUpdateEnd && segmentMidpoints.map((mp) => (
        <rect
          key={`mp-${mp.segIndex}`}
          x={mp.x - 4}
          y={mp.y - 4}
          width={8}
          height={8}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1}
          transform={`rotate(45,${mp.x},${mp.y})`}
          style={{ cursor: "pointer" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            handleMidpointClick(mp.segIndex, { x: mp.x, y: mp.y });
          }}
        />
      ))}

      {/* Label at midpoint */}
      {object.label && (
        <g pointerEvents="none">
          <rect
            x={midpoint.x - (object.label.length * 4)}
            y={midpoint.y - 10}
            width={object.label.length * 8}
            height={20}
            rx={3}
            ry={3}
            fill="white"
            opacity={0.9}
          />
          <text
            x={midpoint.x}
            y={midpoint.y + 4}
            fontSize={12}
            fill="#374151"
            textAnchor="middle"
            fontFamily="Inter, sans-serif"
          >
            {object.label}
          </text>
        </g>
      )}
    </g>
  );
});

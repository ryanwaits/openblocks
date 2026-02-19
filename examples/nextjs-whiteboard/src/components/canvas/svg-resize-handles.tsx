"use client";

import { memo, useRef, useCallback } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";

interface SvgResizeHandlesProps {
  width: number;
  height: number;
  scale: number;
  rotation?: number;
  objectX?: number;
  objectY?: number;
  onResize: (updates: { x: number; y: number; width: number; height: number }) => void;
  onResizeEnd: (updates: { x: number; y: number; width: number; height: number }) => void;
}

const HANDLE_SIZE = 8;
const MIN_WIDTH = 50;
const MIN_HEIGHT = 30;

type Corner = "tl" | "tr" | "bl" | "br";

const corners: { key: Corner; getX: (w: number) => number; getY: (h: number) => number }[] = [
  { key: "tl", getX: () => 0, getY: () => 0 },
  { key: "tr", getX: (w) => w, getY: () => 0 },
  { key: "bl", getX: () => 0, getY: (h) => h },
  { key: "br", getX: (w) => w, getY: (h) => h },
];

function computeUpdates(corner: Corner, dx: number, dy: number, startW: number, startH: number) {
  let newX = 0, newY = 0, newW = startW, newH = startH;
  switch (corner) {
    case "br": newW = Math.max(MIN_WIDTH, startW + dx); newH = Math.max(MIN_HEIGHT, startH + dy); break;
    case "bl": newW = Math.max(MIN_WIDTH, startW - dx); newH = Math.max(MIN_HEIGHT, startH + dy); newX = startW - newW; break;
    case "tr": newW = Math.max(MIN_WIDTH, startW + dx); newH = Math.max(MIN_HEIGHT, startH - dy); newY = startH - newH; break;
    case "tl": newW = Math.max(MIN_WIDTH, startW - dx); newH = Math.max(MIN_HEIGHT, startH - dy); newX = startW - newW; newY = startH - newH; break;
  }
  return { x: newX, y: newY, width: newW, height: newH };
}

function computeRotatedUpdates(
  corner: Corner, dx: number, dy: number,
  startW: number, startH: number,
  rotation: number, objX: number, objY: number,
) {
  const rad = rotation * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localDx = dx * cos + dy * sin;
  const localDy = -dx * sin + dy * cos;
  const local = computeUpdates(corner, localDx, localDy, startW, startH);

  const oldCx = objX + startW / 2;
  const oldCy = objY + startH / 2;

  let aX: number, aY: number;
  switch (corner) {
    case "br": aX = -startW / 2; aY = -startH / 2; break;
    case "bl": aX = startW / 2; aY = -startH / 2; break;
    case "tr": aX = -startW / 2; aY = startH / 2; break;
    case "tl": aX = startW / 2; aY = startH / 2; break;
  }

  const anchorWX = oldCx + aX * cos - aY * sin;
  const anchorWY = oldCy + aX * sin + aY * cos;

  let naX: number, naY: number;
  switch (corner) {
    case "br": naX = -local.width / 2; naY = -local.height / 2; break;
    case "bl": naX = local.width / 2; naY = -local.height / 2; break;
    case "tr": naX = -local.width / 2; naY = local.height / 2; break;
    case "tl": naX = local.width / 2; naY = local.height / 2; break;
  }

  const newCx = anchorWX - (naX * cos - naY * sin);
  const newCy = anchorWY - (naX * sin + naY * cos);
  const newX = newCx - local.width / 2;
  const newY = newCy - local.height / 2;

  return { x: newX - objX, y: newY - objY, width: local.width, height: local.height };
}

export const SvgResizeHandles = memo(function SvgResizeHandles({
  width, height, scale, rotation = 0, objectX = 0, objectY = 0,
  onResize, onResizeEnd,
}: SvgResizeHandlesProps) {
  const dragRef = useRef<{
    corner: Corner;
    startClientX: number;
    startClientY: number;
    startW: number;
    startH: number;
    stageScale: number;
    rotation: number;
    objX: number;
    objY: number;
  } | null>(null);

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeEndRef.current = onResizeEnd;

  const compute = useCallback((dx: number, dy: number) => {
    const d = dragRef.current!;
    if (d.rotation === 0) {
      return computeUpdates(d.corner, dx, dy, d.startW, d.startH);
    }
    return computeRotatedUpdates(d.corner, dx, dy, d.startW, d.startH, d.rotation, d.objX, d.objY);
  }, []);

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.stageScale;
    const dy = (e.clientY - d.startClientY) / d.stageScale;
    onResizeRef.current(compute(dx, dy));
  }, [compute]);

  const handleWindowMouseUp = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClientX) / d.stageScale;
    const dy = (e.clientY - d.startClientY) / d.stageScale;
    onResizeEndRef.current(compute(dx, dy));
    dragRef.current = null;
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [compute, handleWindowMouseMove]);

  const handleMouseDown = useCallback((corner: Corner, e: React.PointerEvent) => {
    e.stopPropagation();
    const stageScale = useViewportStore.getState().scale;

    dragRef.current = {
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startW: width,
      startH: height,
      stageScale,
      rotation,
      objX: objectX,
      objY: objectY,
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  }, [width, height, rotation, objectX, objectY, handleWindowMouseMove, handleWindowMouseUp]);

  const handleSize = HANDLE_SIZE / scale;
  const halfHandle = handleSize / 2;

  // Coordinates relative to shape center (since parent <g> is translated to center)
  const hw = width / 2;
  const hh = height / 2;

  return (
    <>
      {corners.map(({ key, getX, getY }) => (
        <rect
          key={key}
          x={getX(width) - hw - halfHandle}
          y={getY(height) - hh - halfHandle}
          width={handleSize}
          height={handleSize}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1.5 / scale}
          rx={1.5 / scale}
          ry={1.5 / scale}
          style={{ cursor: key === "tl" || key === "br" ? "nwse-resize" : "nesw-resize" }}
          onPointerDown={(e) => handleMouseDown(key, e)}
        />
      ))}
    </>
  );
});

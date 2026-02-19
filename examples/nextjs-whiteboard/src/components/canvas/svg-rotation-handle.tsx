"use client";

import { memo, useRef, useCallback } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";

interface SvgRotationHandleProps {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  objectX: number;
  objectY: number;
  onRotate: (rotation: number) => void;
  onRotateEnd: (rotation: number) => void;
}

const HANDLE_DISTANCE = 25;
const SNAP_INCREMENT = 15;

export const SvgRotationHandle = memo(function SvgRotationHandle({
  width, height, scale, rotation, objectX, objectY,
  onRotate, onRotateEnd,
}: SvgRotationHandleProps) {
  const dragRef = useRef<{
    centerX: number;
    centerY: number;
  } | null>(null);

  const onRotateRef = useRef(onRotate);
  onRotateRef.current = onRotate;
  const onRotateEndRef = useRef(onRotateEnd);
  onRotateEndRef.current = onRotateEnd;

  const computeAngle = useCallback((clientX: number, clientY: number, shiftKey: boolean) => {
    const d = dragRef.current;
    if (!d) return rotation;
    const dx = clientX - d.centerX;
    const dy = clientY - d.centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    angle = ((angle % 360) + 360) % 360;
    if (shiftKey) {
      angle = Math.round(angle / SNAP_INCREMENT) * SNAP_INCREMENT;
    }
    return angle;
  }, [rotation]);

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    onRotateRef.current(computeAngle(e.clientX, e.clientY, e.shiftKey));
  }, [computeAngle]);

  const handleWindowMouseUp = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return;
    onRotateEndRef.current(computeAngle(e.clientX, e.clientY, e.shiftKey));
    dragRef.current = null;
    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
  }, [computeAngle, handleWindowMouseMove]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();

    // Compute shape center in screen coordinates
    const { pos, scale: vpScale } = useViewportStore.getState();
    const shapeCx = objectX + width / 2;
    const shapeCy = objectY + height / 2;

    // We need the SVG element's bounding rect to convert canvas→screen
    const svgEl = (e.target as SVGElement).ownerSVGElement;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();

    dragRef.current = {
      centerX: svgRect.left + shapeCx * vpScale + pos.x,
      centerY: svgRect.top + shapeCy * vpScale + pos.y,
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  }, [width, height, objectX, objectY, handleWindowMouseMove, handleWindowMouseUp]);

  const handleDist = HANDLE_DISTANCE / scale;
  const handleRadius = 4 / scale;
  const hh = height / 2;

  return (
    <>
      {/* Stem line from top-center to handle */}
      <line
        x1={0}
        y1={-hh}
        x2={0}
        y2={-hh - handleDist}
        stroke="#3b82f6"
        strokeWidth={1 / scale}
        pointerEvents="none"
      />
      {/* Rotation handle circle */}
      <circle
        cx={0}
        cy={-hh - handleDist}
        r={handleRadius}
        fill="white"
        stroke="#3b82f6"
        strokeWidth={1.5 / scale}
        style={{ cursor: "grab" }}
        onPointerDown={handlePointerDown}
      />
    </>
  );
});

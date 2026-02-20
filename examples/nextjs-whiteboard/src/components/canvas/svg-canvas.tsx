"use client";

import { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useFrameStore } from "@/lib/store/frame-store";
import { BOARD_WIDTH, BOARD_HEIGHT, frameOriginX, FRAME_ORIGIN_Y } from "@/lib/geometry/frames";
import { animateViewport } from "@/lib/animation/viewport-animation";

export interface BoardCanvasHandle {
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  navigateToFrame: (frameIndex: number) => void;
  zoomToFitAll: () => Promise<void>;
  getSvgElement: () => SVGSVGElement | null;
  setViewport: (pos: { x: number; y: number }, scale: number) => void;
}

interface SvgCanvasProps {
  boardId?: string;
  onStageMouseMove: (pos: { x: number; y: number } | null) => void;
  onStageMouseLeave?: () => void;
  onClickEmpty?: () => void;
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
  onCanvasDoubleClick?: (canvasX: number, canvasY: number) => void;
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;
  mode?: "select" | "hand";
  isCreationMode?: boolean;
  children?: React.ReactNode;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.15;
const DOT_SPACING = 30;
const FRAME_LABEL_FONT_SIZE = 24;
const FRAME_LABEL_OFFSET_Y = 40;

/**
 * Convert screen (client) coordinates to canvas coordinates
 * using the current viewport position and scale.
 */
function screenToCanvas(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  pos: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: (clientX - svgRect.left - pos.x) / scale,
    y: (clientY - svgRect.top - pos.y) / scale,
  };
}

export const SvgCanvas = forwardRef<BoardCanvasHandle, SvgCanvasProps>(function SvgCanvas(
  { boardId, onStageMouseMove, onStageMouseLeave, onClickEmpty, onCanvasClick, onCanvasDoubleClick, onSelectionRect, onSelectionComplete, mode = "select", isCreationMode = false, children },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const dragSelectRef = useRef<{ startX: number; startY: number } | null>(null);
  const didDragSelectRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animCancelRef = useRef<(() => void) | null>(null);
  const handDragRef = useRef<{ startClientX: number; startClientY: number; startPosX: number; startPosY: number } | null>(null);

  // We store pos/scale in a mutable ref for 60fps manipulation.
  // The viewport store is updated in sync for other components to read.
  const vpRef = useRef({ pos: { x: 0, y: 0 }, scale: 1 });

  const frames = useFrameStore((s) => s.frames);

  function applyTransform(pos: { x: number; y: number }, scale: number) {
    vpRef.current = { pos, scale };
    if (cameraRef.current) {
      cameraRef.current.setAttribute("transform", `translate(${pos.x},${pos.y}) scale(${scale})`);
    }
    useViewportStore.getState().setViewport(pos, scale);
  }

  const debouncedSave = useCallback((pos: { x: number; y: number }, scale: number) => {
    if (!boardId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      useViewportStore.getState().saveForBoard(boardId);
    }, 300);
  }, [boardId]);

  const zoomBy = useCallback(
    (delta: number) => {
      const { pos, scale: oldScale } = vpRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + delta));
      const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
      const mousePointTo = {
        x: (center.x - pos.x) / oldScale,
        y: (center.y - pos.y) / oldScale,
      };
      const newPos = {
        x: center.x - mousePointTo.x * newScale,
        y: center.y - mousePointTo.y * newScale,
      };
      applyTransform(newPos, newScale);
      debouncedSave(newPos, newScale);
    },
    [dimensions, debouncedSave],
  );

  const navigateToFrame = useCallback(
    (frameIndex: number) => {
      if (dimensions.width === 0) return;
      animCancelRef.current?.();

      const targetScale = 1;
      const frameCenterX = frameOriginX(frameIndex) + BOARD_WIDTH / 2;
      const frameCenterY = FRAME_ORIGIN_Y + BOARD_HEIGHT / 2;
      const targetPos = {
        x: dimensions.width / 2 - frameCenterX * targetScale,
        y: dimensions.height / 2 - frameCenterY * targetScale,
      };

      const from = { pos: vpRef.current.pos, scale: vpRef.current.scale };
      const to = { pos: targetPos, scale: targetScale };

      const cancel = animateViewport(from, to, 500, (pos, scale) => {
        applyTransform(pos, scale);
      });
      animCancelRef.current = cancel;

      useFrameStore.getState().setActiveFrame(frameIndex, boardId);
      setTimeout(() => debouncedSave(targetPos, targetScale), 520);
    },
    [dimensions, debouncedSave, boardId],
  );

  const zoomToFitAll = useCallback(async () => {
    if (dimensions.width === 0 || frames.length === 0) return;
    animCancelRef.current?.();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const frame of frames) {
      const ox = frameOriginX(frame.index);
      const oy = FRAME_ORIGIN_Y;
      minX = Math.min(minX, ox);
      minY = Math.min(minY, oy - FRAME_LABEL_OFFSET_Y - FRAME_LABEL_FONT_SIZE);
      maxX = Math.max(maxX, ox + BOARD_WIDTH);
      maxY = Math.max(maxY, oy + BOARD_HEIGHT);
    }

    const padding = 100;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const targetScale = Math.min(dimensions.width / contentW, dimensions.height / contentH, 1);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetPos = {
      x: dimensions.width / 2 - centerX * targetScale,
      y: dimensions.height / 2 - centerY * targetScale,
    };

    const from = { pos: vpRef.current.pos, scale: vpRef.current.scale };
    const to = { pos: targetPos, scale: targetScale };

    return new Promise<void>((resolve) => {
      const cancel = animateViewport(from, to, 400, (pos, scale) => {
        applyTransform(pos, scale);
      });
      animCancelRef.current = cancel;
      setTimeout(() => {
        debouncedSave(targetPos, targetScale);
        resolve();
      }, 420);
    });
  }, [dimensions, frames, debouncedSave]);

  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const pos = { x: dimensions.width / 2, y: dimensions.height / 2 };
      applyTransform(pos, 1);
      debouncedSave(pos, 1);
    },
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(-ZOOM_STEP),
    navigateToFrame,
    zoomToFitAll,
    getSvgElement: () => svgRef.current,
    setViewport: (pos, scale) => applyTransform(pos, scale),
  }), [dimensions, zoomBy, debouncedSave, navigateToFrame, zoomToFitAll]);

  // Measure container on mount
  const measuredRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      });
      observer.observe(node);
      setDimensions({ width: node.clientWidth, height: node.clientHeight });
    }
  }, []);

  // On initial render, navigate to last active frame at 100% zoom
  useEffect(() => {
    if (dimensions.width > 0 && !initialized.current && frames.length > 0) {
      initialized.current = true;

      const frameIndex = boardId
        ? useFrameStore.getState().restoreActiveFrame(boardId)
        : 0;

      const targetScale = 1;
      const frameCenterX = frameOriginX(frameIndex) + BOARD_WIDTH / 2;
      const frameCenterY = FRAME_ORIGIN_Y + BOARD_HEIGHT / 2;
      const targetPos = {
        x: dimensions.width / 2 - frameCenterX * targetScale,
        y: dimensions.height / 2 - frameCenterY * targetScale,
      };

      applyTransform(targetPos, targetScale);
      if (boardId) {
        useViewportStore.getState().saveForBoard(boardId);
      }
    }
  }, [dimensions, boardId, frames]);

  const getSvgRect = useCallback(() => {
    return svgRef.current?.getBoundingClientRect() ?? new DOMRect();
  }, []);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const rect = getSvgRect();
    return screenToCanvas(clientX, clientY, rect, vpRef.current.pos, vpRef.current.scale);
  }, [getSvgRect]);

  // --- Wheel: ctrl/meta = zoom, plain = pan ---
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const { pos, scale: oldScale } = vpRef.current;

      if (e.ctrlKey || e.metaKey) {
        const rect = getSvgRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;
        const mousePointTo = {
          x: (pointerX - pos.x) / oldScale,
          y: (pointerY - pos.y) / oldScale,
        };
        const direction = e.deltaY > 0 ? -1 : 1;
        const factor = 1.05;
        let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        const newPos = {
          x: pointerX - mousePointTo.x * newScale,
          y: pointerY - mousePointTo.y * newScale,
        };
        applyTransform(newPos, newScale);
        debouncedSave(newPos, newScale);
      } else {
        const newPos = { x: pos.x - e.deltaX, y: pos.y - e.deltaY };
        applyTransform(newPos, oldScale);
        debouncedSave(newPos, oldScale);
      }
    },
    [debouncedSave, getSvgRect],
  );

  // --- Hand tool drag (pan) ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (mode === "hand") {
        handDragRef.current = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPosX: vpRef.current.pos.x,
          startPosY: vpRef.current.pos.y,
        };
        (e.target as SVGSVGElement).setPointerCapture?.(e.pointerId);
        return;
      }

      // Selection rect — only start when clicking on empty canvas (svg itself or the bg rect)
      if (mode === "select") {
        const target = e.target as SVGElement;
        if (target === svgRef.current || target.dataset.canvasBg === "true") {
          const pos = getCanvasPos(e.clientX, e.clientY);
          dragSelectRef.current = { startX: pos.x, startY: pos.y };
        }
      }
    },
    [mode, getCanvasPos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Hand drag
      if (handDragRef.current) {
        const { startClientX, startClientY, startPosX, startPosY } = handDragRef.current;
        const newPos = {
          x: startPosX + (e.clientX - startClientX),
          y: startPosY + (e.clientY - startClientY),
        };
        applyTransform(newPos, vpRef.current.scale);
        return;
      }

      // Report canvas mouse position
      const canvasPos = getCanvasPos(e.clientX, e.clientY);
      onStageMouseMove(canvasPos);

      // Selection rect
      if (dragSelectRef.current) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        const { startX, startY } = dragSelectRef.current;
        const x = Math.min(startX, pos.x);
        const y = Math.min(startY, pos.y);
        const width = Math.abs(pos.x - startX);
        const height = Math.abs(pos.y - startY);
        if (width > 5 || height > 5) {
          onSelectionRect?.({ x, y, width, height });
        }
      }
    },
    [getCanvasPos, onStageMouseMove, onSelectionRect],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // End hand drag
      if (handDragRef.current) {
        const { pos } = vpRef.current;
        debouncedSave(pos, vpRef.current.scale);
        handDragRef.current = null;
        return;
      }

      // End selection rect
      if (dragSelectRef.current) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        const { startX, startY } = dragSelectRef.current;
        const x = Math.min(startX, pos.x);
        const y = Math.min(startY, pos.y);
        const width = Math.abs(pos.x - startX);
        const height = Math.abs(pos.y - startY);
        dragSelectRef.current = null;
        if (width > 5 || height > 5) {
          didDragSelectRef.current = true;
          onSelectionComplete?.({ x, y, width, height });
        }
        onSelectionRect?.(null);
      }
    },
    [getCanvasPos, debouncedSave, onSelectionRect, onSelectionComplete],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (didDragSelectRef.current) {
        didDragSelectRef.current = false;
        return;
      }
      const target = e.target as SVGElement;
      const isEmptyArea = target === svgRef.current || target.dataset.canvasBg === "true";

      // In creation mode, allow placing items anywhere (even on top of existing shapes)
      if (isCreationMode && onCanvasClick) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        onCanvasClick(pos.x, pos.y);
        return;
      }

      if (isEmptyArea) {
        if (onCanvasClick) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          onCanvasClick(pos.x, pos.y);
          return;
        }
        onClickEmpty?.();
      }
    },
    [onClickEmpty, onCanvasClick, getCanvasPos, isCreationMode],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      if (target === svgRef.current || target.dataset.canvasBg === "true") {
        if (onCanvasDoubleClick) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          onCanvasDoubleClick(pos.x, pos.y);
        }
      }
    },
    [onCanvasDoubleClick, getCanvasPos],
  );

  const isHand = mode === "hand";

  return (
    <div
      ref={measuredRef}
      className="h-full w-full"
      style={{ cursor: isHand ? "grab" : "default" }}
    >
      {dimensions.width > 0 && (
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            handDragRef.current = null;
            onStageMouseLeave?.();
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          style={{ display: "block", touchAction: "none" }}
        >
          <defs>
            {/* Dot grid pattern */}
            <pattern id="dot-grid" width={DOT_SPACING} height={DOT_SPACING} patternUnits="userSpaceOnUse">
              <circle cx={DOT_SPACING / 2} cy={DOT_SPACING / 2} r={1.5} fill="#d1d5db" />
            </pattern>
            {/* Shadow filter for shapes */}
            <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
            </filter>
            {/* Frame shadow filter */}
            <filter id="shadow-frame" x="-5%" y="-5%" width="110%" height="115%">
              <feDropShadow dx="0" dy="4" stdDeviation="20" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* Transparent background rect (captures clicks on empty canvas) */}
          <rect
            width={dimensions.width}
            height={dimensions.height}
            fill="transparent"
            data-canvas-bg="true"
          />

          {/* Camera group — transform set via ref for 60fps */}
          <g ref={cameraRef}>
            {/* Frame backgrounds */}
            {frames.map((frame) => (
              <FrameBackground
                key={frame.id}
                originX={frameOriginX(frame.index)}
                originY={FRAME_ORIGIN_Y}
                label={frame.label}
              />
            ))}

            {/* Content (shapes, lines, drawing layer) */}
            {children}
          </g>
        </svg>
      )}
    </div>
  );
});

function FrameBackground({ originX, originY, label }: { originX: number; originY: number; label: string }) {
  return (
    <g>
      {/* Label above frame */}
      <text
        x={originX}
        y={originY - FRAME_LABEL_OFFSET_Y + FRAME_LABEL_FONT_SIZE}
        fontSize={FRAME_LABEL_FONT_SIZE}
        fontFamily="Inter, system-ui, sans-serif"
        fontWeight="bold"
        fill="#9ca3af"
      >
        {label}
      </text>

      {/* White background with shadow */}
      <rect
        x={originX}
        y={originY}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        rx={8}
        ry={8}
        fill="#ffffff"
        filter="url(#shadow-frame)"
        data-canvas-bg="true"
      />

      {/* Dot grid */}
      <rect
        x={originX}
        y={originY}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        rx={8}
        ry={8}
        fill="url(#dot-grid)"
        data-canvas-bg="true"
      />

      {/* Border */}
      <rect
        x={originX}
        y={originY}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        rx={8}
        ry={8}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={2}
        pointerEvents="none"
      />
    </g>
  );
}

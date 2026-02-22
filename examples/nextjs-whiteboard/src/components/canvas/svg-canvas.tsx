"use client";

import { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useFrameStore } from "@/lib/store/frame-store";
import { frameOriginX, FRAME_ORIGIN_Y } from "@/lib/geometry/frames";
import { animateViewport } from "@/lib/animation/viewport-animation";
import type { BoardObject } from "@/types/board";

export interface BoardCanvasHandle {
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  navigateToFrame: (frameIndex: number) => void;
  zoomToFitAll: (objects?: Map<string, BoardObject>) => Promise<void>;
  panToObjects: (bounds: { x: number; y: number; width: number; height: number }[]) => void;
  getSvgElement: () => SVGSVGElement | null;
  setViewport: (pos: { x: number; y: number }, scale: number) => void;
}

interface SvgCanvasProps {
  boardId?: string;
  onStageMouseMove: (pos: { x: number; y: number } | null) => void;
  onStageMouseLeave?: () => void;
  onClickEmpty?: () => void;
  onCanvasClick?: (canvasX: number, canvasY: number, metaKey?: boolean) => void;
  onCanvasDoubleClick?: (canvasX: number, canvasY: number) => void;
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;
  mode?: "select" | "hand";
  isCreationMode?: boolean;
  children?: React.ReactNode;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 10;
const ZOOM_FACTOR = 1.15; // 15% per step, multiplicative
const DOT_SPACING = 30;

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
  const patternRef = useRef<SVGPatternElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
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
    // tldraw-style dot grid: scale tile size, modulo the offset (no patternTransform)
    if (patternRef.current && dotRef.current) {
      const s = DOT_SPACING * scale;
      const xo = 0.5 + pos.x;
      const yo = 0.5 + pos.y;
      // Modulo wraps offset to stay within one tile — avoids floating-point precision issues
      const gxo = xo > 0 ? xo % s : s + (xo % s);
      const gyo = yo > 0 ? yo % s : s + (yo % s);
      patternRef.current.setAttribute("width", String(s));
      patternRef.current.setAttribute("height", String(s));
      dotRef.current.setAttribute("cx", String(gxo));
      dotRef.current.setAttribute("cy", String(gyo));
      dotRef.current.setAttribute("r", String(Math.max(0.5, 1.5 * Math.min(scale, 2))));
    }
    useViewportStore.getState().setViewport(pos, scale);
  }

  const debouncedSave = useCallback((pos: { x: number; y: number }, scale: number) => {
    if (!boardId) return;
    const frameId = useFrameStore.getState().frames.find(
      (f) => f.index === useFrameStore.getState().activeFrameIndex
    )?.id;
    const key = frameId ? `${boardId}:${frameId}` : boardId;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      useViewportStore.getState().saveForBoard(key);
    }, 300);
  }, [boardId]);

  const zoomBy = useCallback(
    (direction: number) => {
      const { pos, scale: oldScale } = vpRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
        direction > 0 ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR
      ));
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

      // Save current frame's viewport before switching
      if (boardId) {
        const currentFrameId = useFrameStore.getState().frames.find(
          (f) => f.index === useFrameStore.getState().activeFrameIndex
        )?.id;
        if (currentFrameId) {
          const currentKey = `${boardId}:${currentFrameId}`;
          const { pos, scale } = vpRef.current;
          useViewportStore.getState().setViewport(pos, scale);
          useViewportStore.getState().saveForBoard(currentKey);
        }
      }

      // Try restoring target frame's viewport
      const targetFrame = useFrameStore.getState().frames.find((f) => f.index === frameIndex);
      const targetFrameId = targetFrame?.id;

      let targetPos: { x: number; y: number };
      let targetScale: number;

      if (boardId && targetFrameId) {
        const saved = useViewportStore.getState().restoreForBoard(`${boardId}:${targetFrameId}`);
        if (saved) {
          targetPos = saved.pos;
          targetScale = saved.scale;
        } else {
          // Default: center on frame origin at scale 1
          targetScale = 1;
          const frameCenterX = frameOriginX(frameIndex);
          const frameCenterY = FRAME_ORIGIN_Y;
          targetPos = {
            x: dimensions.width / 2 - frameCenterX * targetScale,
            y: dimensions.height / 2 - frameCenterY * targetScale,
          };
        }
      } else {
        targetScale = 1;
        const frameCenterX = frameOriginX(frameIndex);
        const frameCenterY = FRAME_ORIGIN_Y;
        targetPos = {
          x: dimensions.width / 2 - frameCenterX * targetScale,
          y: dimensions.height / 2 - frameCenterY * targetScale,
        };
      }

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

  const zoomToFitAll = useCallback(async (scopedObjects?: Map<string, BoardObject>) => {
    if (dimensions.width === 0) return;
    animCancelRef.current?.();

    if (scopedObjects && scopedObjects.size > 0) {
      // Fit to active frame's objects
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of scopedObjects.values()) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + obj.width);
        maxY = Math.max(maxY, obj.y + obj.height);
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
    }

    // Fallback: fit all frames
    if (frames.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const frame of frames) {
      const ox = frameOriginX(frame.index);
      const oy = FRAME_ORIGIN_Y;
      minX = Math.min(minX, ox);
      minY = Math.min(minY, oy);
      maxX = Math.max(maxX, ox + 4000);
      maxY = Math.max(maxY, oy + 3000);
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

  const panToObjects = useCallback((bounds: { x: number; y: number; width: number; height: number }[]) => {
    if (dimensions.width === 0 || bounds.length === 0) return;
    animCancelRef.current?.();

    // Compute union bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of bounds) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    const padding = 80;
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    // Visibility check: if bbox center is already within viewport, skip
    const { pos, scale } = vpRef.current;
    const screenX = bboxCenterX * scale + pos.x;
    const screenY = bboxCenterY * scale + pos.y;
    if (screenX >= 0 && screenX <= dimensions.width && screenY >= 0 && screenY <= dimensions.height) {
      return;
    }

    // Compute target scale: keep current unless bbox doesn't fit, then zoom out
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const fitScale = Math.min(dimensions.width / contentW, dimensions.height / contentH);
    const targetScale = Math.min(scale, fitScale);

    const targetPos = {
      x: dimensions.width / 2 - bboxCenterX * targetScale,
      y: dimensions.height / 2 - bboxCenterY * targetScale,
    };

    const from = { pos, scale };
    const to = { pos: targetPos, scale: targetScale };
    const cancel = animateViewport(from, to, 400, (p, s) => {
      applyTransform(p, s);
    });
    animCancelRef.current = cancel;
    setTimeout(() => debouncedSave(targetPos, targetScale), 420);
  }, [dimensions, debouncedSave]);

  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const pos = { x: dimensions.width / 2, y: dimensions.height / 2 };
      applyTransform(pos, 1);
      debouncedSave(pos, 1);
    },
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    navigateToFrame,
    zoomToFitAll,
    panToObjects,
    getSvgElement: () => svgRef.current,
    setViewport: (pos, scale) => applyTransform(pos, scale),
  }), [dimensions, zoomBy, debouncedSave, navigateToFrame, zoomToFitAll, panToObjects]);

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

  // On initial render, restore saved viewport or fall back to frame centering
  useEffect(() => {
    if (dimensions.width > 0 && !initialized.current && frames.length > 0) {
      initialized.current = true;

      // Restore active frame index first
      const frameIndex = boardId
        ? useFrameStore.getState().restoreActiveFrame(boardId)
        : 0;

      const activeFrameId = useFrameStore.getState().frames.find(
        (f) => f.index === frameIndex
      )?.id;

      // Try restoring per-frame viewport
      if (boardId && activeFrameId) {
        const saved = useViewportStore.getState().restoreForBoard(`${boardId}:${activeFrameId}`);
        if (saved) {
          applyTransform(saved.pos, saved.scale);
          return;
        }
      }

      // Try legacy board-level viewport
      if (boardId) {
        const saved = useViewportStore.getState().restoreForBoard(boardId);
        if (saved) {
          applyTransform(saved.pos, saved.scale);
          return;
        }
      }

      // First visit — center on active frame origin
      const targetScale = 1;
      const frameCenterX = frameOriginX(frameIndex);
      const frameCenterY = FRAME_ORIGIN_Y;
      const targetPos = {
        x: dimensions.width / 2 - frameCenterX * targetScale,
        y: dimensions.height / 2 - frameCenterY * targetScale,
      };

      applyTransform(targetPos, targetScale);
      if (boardId && activeFrameId) {
        useViewportStore.getState().saveForBoard(`${boardId}:${activeFrameId}`);
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
  // Native non-passive listener so preventDefault() actually blocks browser back/forward swipe
  const handleWheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  handleWheelRef.current = useCallback(
    (e: WheelEvent) => {
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

  // Attach non-passive wheel listener to the SVG element
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => handleWheelRef.current?.(e);
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [dimensions]); // re-attach when SVG mounts (dimensions gate)

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
        onCanvasClick(pos.x, pos.y, e.metaKey || e.ctrlKey);
        return;
      }

      if (isEmptyArea) {
        if (onCanvasClick) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          onCanvasClick(pos.x, pos.y, e.metaKey || e.ctrlKey);
          return;
        }
        onClickEmpty?.();
      }
    },
    [onClickEmpty, onCanvasClick, getCanvasPos, isCreationMode],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onCanvasDoubleClick) return;
      const target = e.target as SVGElement;
      const isEmptyArea = target === svgRef.current || target.dataset.canvasBg === "true";

      if (isCreationMode || isEmptyArea) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        onCanvasDoubleClick(pos.x, pos.y);
      }
    },
    [onCanvasDoubleClick, getCanvasPos, isCreationMode],
  );

  const isHand = mode === "hand";

  return (
    <div
      ref={measuredRef}
      className="h-full w-full overflow-hidden"
      style={{ cursor: isHand ? "grab" : "default", willChange: "transform" }}
    >
      {dimensions.width > 0 && (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
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
            {/* Dot grid pattern — tile size & dot offset set via refs in applyTransform */}
            <pattern
              ref={patternRef}
              id="dot-grid"
              width={DOT_SPACING}
              height={DOT_SPACING}
              patternUnits="userSpaceOnUse"
            >
              <circle ref={dotRef} cx={DOT_SPACING / 2} cy={DOT_SPACING / 2} r={1.5} fill="#d1d5db" />
            </pattern>
            {/* Shadow filter for shapes */}
            <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1" />
            </filter>
          </defs>

          {/* Dot grid background — oversized for bleed protection */}
          <rect
            x={-200}
            y={-200}
            width={dimensions.width + 400}
            height={dimensions.height + 400}
            fill="url(#dot-grid)"
            data-canvas-bg="true"
          />

          {/* Camera group — transform set via ref for 60fps */}
          <g ref={cameraRef}>
            {/* Content (shapes, lines, drawing layer) */}
            {children}
          </g>
        </svg>
      )}
    </div>
  );
});

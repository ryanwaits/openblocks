"use client";

import { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { screenToCanvas } from "@/lib/canvas-utils";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasHandle {
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getSvgElement: () => SVGSVGElement | null;
  setViewport: (pos: { x: number; y: number }, scale: number) => void;
  panToWorkflow: (bbox: BBox) => void;
}

interface WorkflowCanvasProps {
  workflowId?: string;
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
  children?: React.ReactNode;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const ZOOM_FACTOR = 1.15;
const DOT_SPACING = 30;

export const WorkflowCanvas = forwardRef<CanvasHandle, WorkflowCanvasProps>(function WorkflowCanvas(
  { workflowId, onCanvasClick, children },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handDragRef = useRef<{ startClientX: number; startClientY: number; startPosX: number; startPosY: number } | null>(null);
  const vpRef = useRef({ pos: { x: 0, y: 0 }, scale: 1 });
  const panAnimRef = useRef<number | null>(null);

  function applyTransform(pos: { x: number; y: number }, scale: number) {
    vpRef.current = { pos, scale };
    if (cameraRef.current) {
      cameraRef.current.setAttribute("transform", `translate(${pos.x},${pos.y}) scale(${scale})`);
    }
    if (patternRef.current && dotRef.current) {
      const s = DOT_SPACING * scale;
      const xo = 0.5 + pos.x;
      const yo = 0.5 + pos.y;
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
    if (!workflowId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      useViewportStore.getState().saveForWorkflow(workflowId);
    }, 300);
  }, [workflowId]);

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

  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const pos = { x: dimensions.width / 2, y: dimensions.height / 2 };
      applyTransform(pos, 1);
      debouncedSave(pos, 1);
    },
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    getSvgElement: () => svgRef.current,
    setViewport: (pos, scale) => applyTransform(pos, scale),
    panToWorkflow: (bbox: BBox) => {
      if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current);
      const PADDING = 100;
      const scaleX = dimensions.width / (bbox.w + PADDING * 2);
      const scaleY = dimensions.height / (bbox.h + PADDING * 2);
      const targetScale = Math.min(1.0, scaleX, scaleY);
      const centerX = bbox.x + bbox.w / 2;
      const centerY = bbox.y + bbox.h / 2;
      const targetPos = {
        x: dimensions.width / 2 - centerX * targetScale,
        y: dimensions.height / 2 - centerY * targetScale,
      };

      const startPos = { ...vpRef.current.pos };
      const startScale = vpRef.current.scale;
      const startTime = performance.now();
      const DURATION = 400;

      function easeOut(t: number) {
        return 1 - Math.pow(1 - t, 3);
      }

      function tick(now: number) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / DURATION);
        const e = easeOut(t);
        const pos = {
          x: startPos.x + (targetPos.x - startPos.x) * e,
          y: startPos.y + (targetPos.y - startPos.y) * e,
        };
        const scale = startScale + (targetScale - startScale) * e;
        applyTransform(pos, scale);
        if (t < 1) {
          panAnimRef.current = requestAnimationFrame(tick);
        } else {
          panAnimRef.current = null;
          debouncedSave(pos, scale);
        }
      }
      panAnimRef.current = requestAnimationFrame(tick);
    },
  }), [dimensions, zoomBy, debouncedSave]);

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

  // Restore viewport on mount
  useEffect(() => {
    if (dimensions.width > 0 && !initialized.current) {
      initialized.current = true;
      if (workflowId) {
        const saved = useViewportStore.getState().restoreForWorkflow(workflowId);
        if (saved) {
          applyTransform(saved.pos, saved.scale);
          return;
        }
      }
      // Default: center canvas
      applyTransform({ x: dimensions.width / 2, y: dimensions.height / 2 }, 1);
    }
  }, [dimensions, workflowId]);

  const getSvgRect = useCallback(() => {
    return svgRef.current?.getBoundingClientRect() ?? new DOMRect();
  }, []);

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const rect = getSvgRect();
    return screenToCanvas(clientX, clientY, rect, vpRef.current.pos, vpRef.current.scale);
  }, [getSvgRect]);

  // Wheel: ctrl/meta = zoom, plain = pan
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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => handleWheelRef.current?.(e);
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [dimensions]);

  const tool = useCanvasInteractionStore((s) => s.tool);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (tool === "hand") {
        handDragRef.current = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPosX: vpRef.current.pos.x,
          startPosY: vpRef.current.pos.y,
        };
        (e.target as SVGSVGElement).setPointerCapture?.(e.pointerId);
      }
    },
    [tool],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (handDragRef.current) {
        const { startClientX, startClientY, startPosX, startPosY } = handDragRef.current;
        const newPos = {
          x: startPosX + (e.clientX - startClientX),
          y: startPosY + (e.clientY - startClientY),
        };
        applyTransform(newPos, vpRef.current.scale);
      }
    },
    [],
  );

  const handlePointerUp = useCallback(
    () => {
      if (handDragRef.current) {
        const { pos } = vpRef.current;
        debouncedSave(pos, vpRef.current.scale);
        handDragRef.current = null;
      }
    },
    [debouncedSave],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      const isEmptyArea = target === svgRef.current || target.dataset.canvasBg === "true";
      if (isEmptyArea && onCanvasClick) {
        const pos = getCanvasPos(e.clientX, e.clientY);
        onCanvasClick(pos.x, pos.y);
      }
    },
    [onCanvasClick, getCanvasPos],
  );

  const isHand = tool === "hand";

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
          onPointerLeave={() => { handDragRef.current = null; }}
          onClick={handleClick}
          style={{ display: "block", touchAction: "none" }}
        >
          <defs>
            <pattern
              ref={patternRef}
              id="dot-grid"
              width={DOT_SPACING}
              height={DOT_SPACING}
              patternUnits="userSpaceOnUse"
            >
              <circle ref={dotRef} cx={DOT_SPACING / 2} cy={DOT_SPACING / 2} r={1.5} fill="#d1d5db" />
            </pattern>
          </defs>

          <rect
            x={-200}
            y={-200}
            width={dimensions.width + 400}
            height={dimensions.height + 400}
            fill="url(#dot-grid)"
            data-canvas-bg="true"
          />

          <g ref={cameraRef}>
            {children}
            <MarqueeRectOverlay />
          </g>
        </svg>
      )}
    </div>
  );
});

function MarqueeRectOverlay() {
  const marquee = useCanvasInteractionStore((s) => s.marqueeRect);
  if (!marquee) return null;
  return (
    <rect
      x={marquee.x}
      y={marquee.y}
      width={marquee.w}
      height={marquee.h}
      fill="rgba(123,97,255,0.08)"
      stroke="#7b61ff"
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}

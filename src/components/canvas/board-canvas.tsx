"use client";

import { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { Stage, Layer, Rect, Shape } from "react-konva";
import type Konva from "konva";
import { useViewportStore } from "@/lib/store/viewport-store";

export interface BoardCanvasHandle {
  resetZoom: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface BoardCanvasProps {
  boardId?: string;
  onStageMouseMove: (relativePointerPos: { x: number; y: number } | null) => void;
  onStageMouseLeave?: () => void;
  onClickEmpty?: () => void;
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;
  mode?: "select" | "hand";
  children?: React.ReactNode;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;
const DOT_SPACING = 30;
const BOARD_WIDTH = 4000;
const BOARD_HEIGHT = 3000;
const BOARD_OFFSET_X = -BOARD_WIDTH / 2;
const BOARD_OFFSET_Y = -BOARD_HEIGHT / 2;

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  { boardId, onStageMouseMove, onStageMouseLeave, onClickEmpty, onCanvasClick, onSelectionRect, onSelectionComplete, mode = "select", children },
  ref
) {
  const stageRef = useRef<Konva.Stage>(null);
  const boardLayerRef = useRef<Konva.Layer>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const dragSelectRef = useRef<{ startX: number; startY: number } | null>(null);
  const didDragSelectRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const debouncedSave = useCallback((pos: { x: number; y: number }, scale: number) => {
    if (!boardId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      useViewportStore.getState().saveForBoard(boardId);
    }, 300);
  }, [boardId]);

  const centerBoard = useCallback((w: number, h: number, scale: number) => {
    const pos = { x: w / 2, y: h / 2 };
    const stage = stageRef.current;
    if (stage) {
      stage.scale({ x: scale, y: scale });
      stage.position(pos);
    }
    return pos;
  }, []);

  const zoomBy = useCallback(
    (delta: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const oldScale = stage.scaleX();
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale + delta));
      // Zoom centered on viewport middle
      const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
      const mousePointTo = {
        x: (center.x - stage.x()) / oldScale,
        y: (center.y - stage.y()) / oldScale,
      };
      stage.scale({ x: newScale, y: newScale });
      const newPos = {
        x: center.x - mousePointTo.x * newScale,
        y: center.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);
      useViewportStore.getState().setViewport(newPos, newScale);
      debouncedSave(newPos, newScale);
    },
    [dimensions, debouncedSave]
  );

  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const pos = centerBoard(dimensions.width, dimensions.height, 1);
      useViewportStore.getState().setViewport(pos, 1);
      debouncedSave(pos, 1);
    },
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(-ZOOM_STEP),
  }), [dimensions, centerBoard, zoomBy, debouncedSave]);

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

  // Restore saved viewport or center board on initial render
  useEffect(() => {
    if (dimensions.width > 0 && !initialized.current) {
      initialized.current = true;
      const saved = boardId ? useViewportStore.getState().restoreForBoard(boardId, { x: dimensions.width / 2, y: dimensions.height / 2 }) : null;
      if (saved) {
        const stage = stageRef.current;
        if (stage) {
          stage.scale({ x: saved.scale, y: saved.scale });
          stage.position(saved.pos);
        }
        useViewportStore.getState().setViewport(saved.pos, saved.scale);
      } else {
        const pos = centerBoard(dimensions.width, dimensions.height, 1);
        useViewportStore.getState().setViewport(pos, 1);
      }
      boardLayerRef.current?.cache();
    }
  }, [dimensions, centerBoard, boardId]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition()!;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const factor = 1.05;
      let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      stage.position(newPos);

      useViewportStore.getState().setViewport(newPos, newScale);
      debouncedSave(newPos, newScale);
    },
    [debouncedSave]
  );

  const handleDragEnd = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.position();
    const scale = stage.scaleX();
    useViewportStore.getState().setViewport(pos, scale);
    debouncedSave(pos, scale);
  }, [debouncedSave]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Only start drag-select when clicking on empty stage in select mode
      if (mode !== "select") return;
      if (e.target !== e.target.getStage()) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      dragSelectRef.current = { startX: pos.x, startY: pos.y };
    },
    [mode]
  );

  const handleMouseMoveSelect = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    onStageMouseMove(stage.getRelativePointerPosition());

    // Drag-select tracking
    if (!dragSelectRef.current) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const { startX, startY } = dragSelectRef.current;
    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const width = Math.abs(pos.x - startX);
    const height = Math.abs(pos.y - startY);
    // Only show rect if dragged more than 5px
    if (width > 5 || height > 5) {
      onSelectionRect?.({ x, y, width, height });
    }
  }, [onStageMouseMove, onSelectionRect]);

  const handleMouseUp = useCallback(() => {
    if (!dragSelectRef.current) return;
    const stage = stageRef.current;
    if (!stage) {
      dragSelectRef.current = null;
      onSelectionRect?.(null);
      return;
    }
    const pos = stage.getRelativePointerPosition();
    if (!pos) {
      dragSelectRef.current = null;
      onSelectionRect?.(null);
      return;
    }
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
  }, [onSelectionRect, onSelectionComplete]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Skip click if a drag-select just completed (mouseup fires before click)
      if (didDragSelectRef.current) {
        didDragSelectRef.current = false;
        return;
      }
      if (e.target === e.target.getStage()) {
        const stage = stageRef.current;
        if (stage && onCanvasClick) {
          const pos = stage.getRelativePointerPosition();
          if (pos) {
            onCanvasClick(pos.x, pos.y);
            return;
          }
        }
        onClickEmpty?.();
      }
    },
    [onClickEmpty, onCanvasClick]
  );

  const handleDragMove = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    useViewportStore.getState().setViewport(stage.position(), stage.scaleX());
  }, []);

  const isHand = mode === "hand";

  return (
    <div
      ref={measuredRef}
      className="h-full w-full"
      style={{ cursor: isHand ? "grab" : "default" }}
    >
      {dimensions.width > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          draggable={isHand}
          onWheel={handleWheel}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveSelect}
          onMouseUp={handleMouseUp}
          onMouseLeave={onStageMouseLeave}
          onClick={handleClick}
        >
          {/* Board boundary + dot grid — cached as bitmap for perf */}
          <Layer ref={boardLayerRef} listening={false}>
            <Rect
              x={BOARD_OFFSET_X}
              y={BOARD_OFFSET_Y}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              fill="#ffffff"
              cornerRadius={8}
              shadowColor="rgba(0,0,0,0.12)"
              shadowBlur={40}
              shadowOffsetY={4}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <DotGrid />
            <Rect
              x={BOARD_OFFSET_X}
              y={BOARD_OFFSET_Y}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              stroke="#e5e7eb"
              strokeWidth={2}
              cornerRadius={8}
              listening={false}
            />
          </Layer>

          {/* Content layer */}
          <Layer>{children}</Layer>
        </Stage>
      )}
    </div>
  );
});

// Pre-render a single dot tile for use as a canvas pattern
let dotTileCanvas: HTMLCanvasElement | null = null;
function getDotTile(): HTMLCanvasElement {
  if (!dotTileCanvas) {
    dotTileCanvas = document.createElement("canvas");
    dotTileCanvas.width = DOT_SPACING;
    dotTileCanvas.height = DOT_SPACING;
    const tctx = dotTileCanvas.getContext("2d")!;
    tctx.fillStyle = "#d1d5db";
    tctx.beginPath();
    tctx.arc(DOT_SPACING / 2, DOT_SPACING / 2, 1.5, 0, Math.PI * 2);
    tctx.fill();
  }
  return dotTileCanvas;
}

function DotGrid() {
  const gridStartX = Math.ceil(BOARD_OFFSET_X / DOT_SPACING) * DOT_SPACING;
  const gridStartY = Math.ceil(BOARD_OFFSET_Y / DOT_SPACING) * DOT_SPACING;

  return (
    <Shape
      sceneFunc={(context) => {
        const ctx = context._context;
        const tile = getDotTile();
        const pattern = ctx.createPattern(tile, "repeat");
        if (!pattern) return;

        ctx.save();
        // Offset so pattern aligns with the grid origin
        ctx.translate(gridStartX + DOT_SPACING / 2, gridStartY + DOT_SPACING / 2);
        ctx.fillStyle = pattern;
        ctx.fillRect(
          -DOT_SPACING / 2,
          -DOT_SPACING / 2,
          BOARD_WIDTH - (gridStartX - BOARD_OFFSET_X) + DOT_SPACING,
          BOARD_HEIGHT - (gridStartY - BOARD_OFFSET_Y) + DOT_SPACING
        );
        ctx.restore();
      }}
    />
  );
}

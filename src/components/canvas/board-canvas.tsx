"use client";

import { useRef, useCallback, useState, useImperativeHandle, forwardRef, useEffect } from "react";
import { Stage, Layer, Rect, Shape, Group, Text } from "react-konva";
import type Konva from "konva";
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
  getStage: () => Konva.Stage | null;
}

interface BoardCanvasProps {
  boardId?: string;
  onStageMouseMove: (relativePointerPos: { x: number; y: number } | null) => void;
  onStageMouseLeave?: () => void;
  onClickEmpty?: () => void;
  onCanvasClick?: (canvasX: number, canvasY: number) => void;
  onCanvasDoubleClick?: (canvasX: number, canvasY: number) => void;
  onSelectionRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onSelectionComplete?: (rect: { x: number; y: number; width: number; height: number }) => void;
  mode?: "select" | "hand";
  children?: React.ReactNode;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.15;
const DOT_SPACING = 30;
const FRAME_LABEL_FONT_SIZE = 24;
const FRAME_LABEL_OFFSET_Y = 40;

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  { boardId, onStageMouseMove, onStageMouseLeave, onClickEmpty, onCanvasClick, onCanvasDoubleClick, onSelectionRect, onSelectionComplete, mode = "select", children },
  ref
) {
  const stageRef = useRef<Konva.Stage>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const dragSelectRef = useRef<{ startX: number; startY: number } | null>(null);
  const didDragSelectRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animCancelRef = useRef<(() => void) | null>(null);

  const frames = useFrameStore((s) => s.frames);

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

  const navigateToFrame = useCallback(
    (frameIndex: number) => {
      const stage = stageRef.current;
      if (!stage || dimensions.width === 0) return;
      // Cancel any running animation
      animCancelRef.current?.();

      const targetScale = 1;
      const frameCenterX = frameOriginX(frameIndex) + BOARD_WIDTH / 2;
      const frameCenterY = FRAME_ORIGIN_Y + BOARD_HEIGHT / 2;
      const targetPos = {
        x: dimensions.width / 2 - frameCenterX * targetScale,
        y: dimensions.height / 2 - frameCenterY * targetScale,
      };

      const from = { pos: stage.position(), scale: stage.scaleX() };
      const to = { pos: targetPos, scale: targetScale };

      const cancel = animateViewport(stage, from, to, 500, (pos, scale) => {
        useViewportStore.getState().setViewport(pos, scale);
      });
      animCancelRef.current = cancel;

      // Track active frame
      useFrameStore.getState().setActiveFrame(frameIndex, boardId);

      // After animation, save viewport
      setTimeout(() => {
        debouncedSave(targetPos, targetScale);
      }, 520);
    },
    [dimensions, debouncedSave, boardId]
  );

  const zoomToFitAll = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage || dimensions.width === 0 || frames.length === 0) return;
    animCancelRef.current?.();

    // Compute bounding box of all frames
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
    const targetScale = Math.min(
      dimensions.width / contentW,
      dimensions.height / contentH,
      1
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetPos = {
      x: dimensions.width / 2 - centerX * targetScale,
      y: dimensions.height / 2 - centerY * targetScale,
    };

    const from = { pos: stage.position(), scale: stage.scaleX() };
    const to = { pos: targetPos, scale: targetScale };

    return new Promise<void>((resolve) => {
      const cancel = animateViewport(stage, from, to, 400, (pos, scale) => {
        useViewportStore.getState().setViewport(pos, scale);
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
      const pos = centerBoard(dimensions.width, dimensions.height, 1);
      useViewportStore.getState().setViewport(pos, 1);
      debouncedSave(pos, 1);
    },
    zoomIn: () => zoomBy(ZOOM_STEP),
    zoomOut: () => zoomBy(-ZOOM_STEP),
    navigateToFrame,
    zoomToFitAll,
    getStage: () => stageRef.current,
  }), [dimensions, centerBoard, zoomBy, debouncedSave, navigateToFrame, zoomToFitAll]);

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
      const stage = stageRef.current;
      if (!stage) return;

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

      stage.scale({ x: targetScale, y: targetScale });
      stage.position(targetPos);
      useViewportStore.getState().setViewport(targetPos, targetScale);
      if (boardId) {
        useViewportStore.getState().saveForBoard(boardId);
      }
    }
  }, [dimensions, boardId, frames]);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      if (e.evt.ctrlKey || e.evt.metaKey) {
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
      } else {
        const pos = stage.position();
        const newPos = {
          x: pos.x - e.evt.deltaX,
          y: pos.y - e.evt.deltaY,
        };
        stage.position(newPos);
        useViewportStore.getState().setViewport(newPos, stage.scaleX());
        debouncedSave(newPos, stage.scaleX());
      }
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

    if (!dragSelectRef.current) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const { startX, startY } = dragSelectRef.current;
    const x = Math.min(startX, pos.x);
    const y = Math.min(startY, pos.y);
    const width = Math.abs(pos.x - startX);
    const height = Math.abs(pos.y - startY);
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

  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        const stage = stageRef.current;
        if (stage && onCanvasDoubleClick) {
          const pos = stage.getRelativePointerPosition();
          if (pos) {
            onCanvasDoubleClick(pos.x, pos.y);
          }
        }
      }
    },
    [onCanvasDoubleClick]
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
          onDblClick={handleDblClick}
        >
          {/* Frame backgrounds — each cached individually for perf */}
          <Layer listening={false}>
            {frames.map((frame) => (
              <FrameBackground
                key={frame.id}
                originX={frameOriginX(frame.index)}
                originY={FRAME_ORIGIN_Y}
                label={frame.label}
              />
            ))}
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

function DotGrid({ originX, originY }: { originX: number; originY: number }) {
  const gridStartX = Math.ceil(originX / DOT_SPACING) * DOT_SPACING;
  const gridStartY = Math.ceil(originY / DOT_SPACING) * DOT_SPACING;

  return (
    <Shape
      sceneFunc={(context) => {
        const ctx = context._context;
        const tile = getDotTile();
        const pattern = ctx.createPattern(tile, "repeat");
        if (!pattern) return;

        ctx.save();
        ctx.translate(gridStartX + DOT_SPACING / 2, gridStartY + DOT_SPACING / 2);
        ctx.fillStyle = pattern;
        ctx.fillRect(
          -DOT_SPACING / 2,
          -DOT_SPACING / 2,
          BOARD_WIDTH - (gridStartX - originX) + DOT_SPACING,
          BOARD_HEIGHT - (gridStartY - originY) + DOT_SPACING
        );
        ctx.restore();
      }}
    />
  );
}

function FrameBackground({ originX, originY, label }: { originX: number; originY: number; label: string }) {
  const groupRef = useRef<Konva.Group>(null);

  useEffect(() => {
    groupRef.current?.cache();
  }, [originX, originY]);

  return (
    <>
      {/* Label above frame */}
      <Text
        x={originX}
        y={originY - FRAME_LABEL_OFFSET_Y}
        text={label}
        fontSize={FRAME_LABEL_FONT_SIZE}
        fontFamily="Inter, system-ui, sans-serif"
        fontStyle="bold"
        fill="#9ca3af"
      />
      {/* Cached frame group: white rect + dot grid + border */}
      <Group ref={groupRef}>
        <Rect
          x={originX}
          y={originY}
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
        <DotGrid originX={originX} originY={originY} />
        <Rect
          x={originX}
          y={originY}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          stroke="#e5e7eb"
          strokeWidth={2}
          cornerRadius={8}
          listening={false}
        />
      </Group>
    </>
  );
}

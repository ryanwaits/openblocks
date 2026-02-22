"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { useBoardStore } from "@/lib/store/board-store";
import { CursorsOverlay } from "@/components/presence/cursors-overlay";
import { OnlineUsers } from "@/components/presence/online-users";
import { NameDialog } from "@/components/auth/name-dialog";
import { Sidebar } from "@/components/canvas/sidebar";
import { FrameSwitcher } from "@/components/canvas/frame-switcher";
import { ShortcutHint, useShortcutHint } from "@/components/canvas/shortcut-hint";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { GhostPreview } from "@/components/canvas/ghost-preview";
import { InlineTextEditor } from "@/components/canvas/inline-text-editor";
import { FormattingToolbar } from "@/components/canvas/formatting-toolbar";
import { LineFormattingToolbar } from "@/components/canvas/line-formatting-toolbar";
import { SvgCanvas, type BoardCanvasHandle } from "@/components/canvas/svg-canvas";
import { CanvasObjects } from "@/components/canvas/canvas-objects";
import { SvgLineDrawingLayer } from "@/components/canvas/svg-line-drawing-layer";
import { SvgDrawingPreviewLayer } from "@/components/canvas/svg-drawing-preview-layer";
import { useViewportStore } from "@/lib/store/viewport-store";
import { buildConnectionIndex } from "@/lib/utils/connection-index";
import { computeLineBounds, computeEdgePoint } from "@/lib/geometry/edge-intersection";
import { maxZInTier } from "@/lib/geometry/render-tiers";
import { getRotatedAABB } from "@/lib/geometry/rotation";
import { findSnapTarget } from "@/lib/geometry/snap";
import type { BoardObject, ToolMode, Frame } from "@/types/board";
import { useFrameStore } from "@/lib/store/frame-store";
import { useLineDrawing } from "@/hooks/use-line-drawing";
import { useFreehandDrawing } from "@/hooks/use-freehand-drawing";
import { AICommandBar } from "@/components/ai/ai-command-bar";
import { LivelyProvider, RoomProvider, useSelf, useOthers, useHistory, useFollowUser, useErrorListener, useLostConnectionListener, useOthersListener, useSyncStatus, useUpdateMyPresence } from "@waits/lively-react";
import { ConnectionBadge } from "@waits/lively-ui";
import { client, buildInitialStorage } from "@/lib/sync/client";
import { useLivelySync } from "@/lib/sync/use-lively-sync";
import { useBoardMutations } from "@/lib/sync/use-board-mutations";

const CREATION_TOOLS: ToolMode[] = ["sticky", "rectangle", "text", "circle", "diamond", "pill", "stamp"];
const EDITABLE_TYPES: BoardObject["type"][] = ["sticky", "text"];

/** Isolated viewport-dependent overlays — subscribe independently so BoardPageInner doesn't re-render on pan/zoom */

function SelectionRectOverlay({ rect }: { rect: { x: number; y: number; width: number; height: number } }) {
  const scale = useViewportStore((s) => s.scale);
  const pos = useViewportStore((s) => s.pos);
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: rect.x * scale + pos.x,
        top: rect.y * scale + pos.y,
        width: rect.width * scale,
        height: rect.height * scale,
        border: "1.5px solid #3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        borderRadius: 2,
      }}
    />
  );
}

function PositionedFormattingToolbar({ object, onFormatChange }: { object: BoardObject; onFormatChange: (updates: Partial<BoardObject>) => void }) {
  const scale = useViewportStore((s) => s.scale);
  const pos = useViewportStore((s) => s.pos);
  const bounds = getRotatedAABB(object);
  return (
    <FormattingToolbar
      object={object}
      onFormatChange={onFormatChange}
      screenX={bounds.x * scale + pos.x}
      screenY={bounds.y * scale + pos.y}
      screenW={bounds.width * scale}
    />
  );
}

function PositionedLineFormattingToolbar({ object, onUpdate }: { object: BoardObject; onUpdate: (updates: Partial<BoardObject>) => void }) {
  const scale = useViewportStore((s) => s.scale);
  const pos = useViewportStore((s) => s.pos);
  const bounds = object.points && object.points.length >= 2
    ? computeLineBounds(object.points)
    : { x: object.x, y: object.y, width: object.width, height: object.height };
  return (
    <LineFormattingToolbar
      object={object}
      onUpdate={onUpdate}
      screenX={bounds.x * scale + pos.x}
      screenY={bounds.y * scale + pos.y}
      screenW={bounds.width * scale}
    />
  );
}

export default function BoardPage() {
  const params = useParams();
  const roomId = params.id as string;
  const { userId, displayName, isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <NameDialog />
      </div>
    );
  }

  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId={roomId}
        userId={userId || ""}
        displayName={displayName || ""}
        initialStorage={buildInitialStorage()}
      >
        <BoardPageInner roomId={roomId} userId={userId || ""} displayName={displayName || ""} />
      </RoomProvider>
    </LivelyProvider>
  );
}

function BoardPageInner({ roomId, userId, displayName }: { roomId: string; userId: string; displayName: string }) {
  const { objects, selectedIds, setSelected, setSelectedIds } = useBoardStore();
  const activeFrameIndex = useFrameStore((s) => s.activeFrameIndex);
  const activeFrameId = useFrameStore((s) => {
    const idx = s.activeFrameIndex;
    return s.frames.find((f) => f.index === idx)?.id;
  });

  // Filter objects to only show those belonging to the active frame
  const filteredObjects = useMemo(() => {
    if (!activeFrameId) return objects;
    const filtered = new Map<string, BoardObject>();
    for (const [id, obj] of objects) {
      if (obj.frame_id === activeFrameId || !obj.frame_id) {
        filtered.set(id, obj);
      }
    }
    return filtered;
  }, [objects, activeFrameId]);

  const connectionIndex = useMemo(() => buildConnectionIndex(filteredObjects), [filteredObjects]);
  const self = useSelf();
  const others = useOthers();
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stageMousePos, setStageMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const [aiOpen, setAiOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`ai-open:${roomId}`) === "true";
  });
  const canvasRef = useRef<BoardCanvasHandle>(null);
  const lastCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const resizeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const multiDragStartRef = useRef<Map<string, BoardObject> | null>(null);
  const clipboardRef = useRef<BoardObject[]>([]);
  const lineDrawing = useLineDrawing();
  const freehandDrawing = useFreehandDrawing();
  const [selectedStampType, setSelectedStampType] = useState("thumbsup");
  const shortcutHint = useShortcutHint();

  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

  useEffect(() => {
    localStorage.setItem(`ai-open:${roomId}`, String(aiOpen));
  }, [aiOpen, roomId]);

  // Clear selection and editing when switching frames
  const updatePresence = useUpdateMyPresence();
  useEffect(() => {
    setSelected(null);
    setEditingId(null);
    // Broadcast active frame to other users for cursor isolation
    if (activeFrameId) {
      updatePresence({ location: activeFrameId });
    }
  }, [activeFrameIndex, activeFrameId, setSelected, updatePresence]);

  useLivelySync();
  const mutations = useBoardMutations();
  const { undo, redo } = useHistory();
  const isFollowingRef = useRef(false);
  const { followingUserId, followUser: setFollowingUserId, stopFollowing } = useFollowUser({
    exitOnInteraction: false,
    onViewportChange: useCallback(
      (pos: { x: number; y: number }, scale: number) => canvasRef.current?.setViewport(pos, scale),
      []
    ),
  });
  // Keep ref in sync for the viewport subscription to read without re-renders
  isFollowingRef.current = !!followingUserId;

  const handleStageMouseMove = useCallback(
    (relativePointerPos: { x: number; y: number } | null) => {
      if (!relativePointerPos) return;
      setStageMousePos(relativePointerPos);
      lineDrawing.setCursorPos(relativePointerPos);
      if (activeTool === "draw" && freehandDrawing.state.isDrawing) {
        freehandDrawing.addPoint(relativePointerPos);
      }
      lastCursorPosRef.current = relativePointerPos;
      mutations.updateCursor(relativePointerPos.x, relativePointerPos.y);
    },
    [mutations, lineDrawing.setCursorPos, activeTool, freehandDrawing],
  );

  const handleStageMouseLeave = useCallback(() => {
    setStageMousePos(null);
  }, []);

  // Broadcast viewport on pan/zoom — skip when driven by follow mode to avoid feedback loop
  useEffect(() => {
    return useViewportStore.subscribe(() => {
      if (isFollowingRef.current) return;
      const { pos: vpPos, scale } = useViewportStore.getState();
      const cursorPos = lastCursorPosRef.current ?? {
        x: (window.innerWidth / 2 - vpPos.x) / scale,
        y: (window.innerHeight / 2 - vpPos.y) / scale,
      };
      mutations.updateCursor(cursorPos.x, cursorPos.y);
    });
  }, [mutations]);

  // Re-broadcast cursor+viewport when a new user joins so they get our current state immediately
  useOthersListener((event) => {
    if (event.type === "enter") {
      const { pos: vpPos, scale } = useViewportStore.getState();
      const cursorPos = lastCursorPosRef.current ?? {
        x: (window.innerWidth / 2 - vpPos.x) / scale,
        y: (window.innerHeight / 2 - vpPos.y) / scale,
      };
      mutations.updateCursor(cursorPos.x, cursorPos.y);
    }
  });

  useErrorListener((err) => console.error("[Lively]", err.message));
  useLostConnectionListener(() => console.warn("[Lively] Connection lost, reconnecting…"));
  const syncStatus = useSyncStatus();

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  const activeFrame = useFrameStore((s) => {
    const idx = s.activeFrameIndex;
    return s.frames.find((f) => f.index === idx);
  });

  const createObjectAt = useCallback(
    (type: BoardObject["type"], x: number, y: number) => {
      const defaults: Record<BoardObject["type"], { width: number; height: number; color: string }> = {
        sticky: { width: 200, height: 200, color: "#fef08a" },
        rectangle: { width: 200, height: 150, color: "#bfdbfe" },
        text: { width: 300, height: 40, color: "transparent" },
        circle: { width: 150, height: 150, color: "#dbeafe" },
        diamond: { width: 150, height: 150, color: "#e9d5ff" },
        pill: { width: 200, height: 80, color: "#d1fae5" },
        line: { width: 0, height: 0, color: "transparent" },
        drawing: { width: 0, height: 0, color: "transparent" },
        emoji: { width: 64, height: 64, color: "transparent" },
      };
      const d = defaults[type];
      const obj: BoardObject = {
        id: crypto.randomUUID(),
        board_id: roomId === "default" ? "00000000-0000-0000-0000-000000000000" : roomId,
        type,
        x: x - d.width / 2,
        y: y - d.height / 2,
        width: d.width,
        height: d.height,
        color: d.color,
        text: "",
        z_index: objects.size,
        created_by: userId || null,
        created_by_name: displayName || undefined,
        updated_at: new Date().toISOString(),
        frame_id: activeFrame?.id,
        ...(type === "emoji" ? { emoji_type: selectedStampType } : {}),
      };
      mutations.createObject(obj);
      setSelected(obj.id);
    },
    [roomId, objects.size, userId, displayName, mutations, activeFrame, selectedStampType, setSelected],
  );

  const finalizeLineDrawing = useCallback(() => {
    const boardUUID = roomId === "default" ? "00000000-0000-0000-0000-000000000000" : roomId;
    const obj = lineDrawing.finalize(boardUUID, userId || null, displayName || undefined, objects.size);
    if (obj) {
      obj.frame_id = activeFrame?.id;
      mutations.createObject(obj);
      setSelected(obj.id);
      setActiveTool("select");
    }
  }, [lineDrawing, roomId, userId, displayName, objects.size, mutations, activeFrame, setSelected]);

  const handleCanvasClick = useCallback(
    (canvasX: number, canvasY: number, metaKey?: boolean) => {
      (document.activeElement as HTMLElement)?.blur?.();
      if (activeTool === "line") {
        let pos = { x: canvasX, y: canvasY };
        const snap = findSnapTarget(pos, objects);
        if (snap) pos = { x: snap.x, y: snap.y };
        if (!lineDrawing.drawingState.isDrawing) {
          lineDrawing.startPoint(pos, snap?.objectId);
        } else {
          lineDrawing.addPoint(pos, snap?.objectId);
          const isConnectorComplete =
            snap?.objectId &&
            lineDrawing.drawingState.startObjectId &&
            snap.objectId !== lineDrawing.drawingState.startObjectId;
          if (metaKey || isConnectorComplete) finalizeLineDrawing();
        }
        return;
      }
      if (CREATION_TOOLS.includes(activeTool)) {
        const objType: BoardObject["type"] = activeTool === "stamp" ? "emoji" : activeTool as BoardObject["type"];
        createObjectAt(objType, canvasX, canvasY);
        setActiveTool("select");
      } else {
        setEditingId(null);
        setSelected(null);
      }
    },
    [activeTool, createObjectAt, setSelected, lineDrawing, finalizeLineDrawing, objects],
  );

  const handleCanvasDoubleClick = useCallback(
    (canvasX: number, canvasY: number) => {
      if (activeTool === "line" && lineDrawing.drawingState.isDrawing) {
        lineDrawing.removeLastPoint();
        let pos = { x: canvasX, y: canvasY };
        const snap = findSnapTarget(pos, objects);
        if (snap) pos = { x: snap.x, y: snap.y };
        lineDrawing.addPoint(pos, snap?.objectId);
        finalizeLineDrawing();
      }
    },
    [activeTool, lineDrawing, finalizeLineDrawing, objects],
  );

  const handleObjectClick = useCallback(
    (id: string) => {
      if (activeTool !== "select") return;
      const obj = objects.get(id);
      if (obj && EDITABLE_TYPES.includes(obj.type)) {
        setEditingId(id);
      }
    },
    [activeTool, objects],
  );

  const handleDragMove = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;

      if (selectedIds.has(objectId) && selectedIds.size > 1) {
        if (!multiDragStartRef.current) {
          const starts = new Map<string, BoardObject>();
          for (const id of selectedIds) {
            const o = objects.get(id);
            if (o) starts.set(id, o);
          }
          multiDragStartRef.current = starts;
        }
        const snap = multiDragStartRef.current.get(objectId);
        if (!snap) return;
        const dx = x - snap.x;
        const dy = y - snap.y;
        const now = new Date().toISOString();
        for (const id of selectedIds) {
          const s = multiDragStartRef.current.get(id);
          if (!s) continue;
          if ((s.type === "line" || s.type === "drawing") && s.points && s.points.length > 0 && !s.start_object_id && !s.end_object_id) {
            const newPoints = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            const bounds = computeLineBounds(newPoints);
            mutations.updateObject({ ...s, points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, updated_at: now });
          } else {
            mutations.updateObject({ ...s, x: s.x + dx, y: s.y + dy, updated_at: now });
          }
        }
        return;
      }

      if ((obj.type === "line" || obj.type === "drawing") && obj.points && obj.points.length > 0 && !obj.start_object_id && !obj.end_object_id) {
        const dx = x - obj.x;
        const dy = y - obj.y;
        const newPoints = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const bounds = computeLineBounds(newPoints);
        mutations.updateObject({ ...obj, points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, updated_at: new Date().toISOString() });
      } else {
        mutations.updateObject({ ...obj, x, y, updated_at: new Date().toISOString() });
      }
    },
    [objects, selectedIds, mutations],
  );

  const handleDragEnd = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;

      const objValues = objects.values();

      if (selectedIds.has(objectId) && selectedIds.size > 1 && multiDragStartRef.current) {
        const snap = multiDragStartRef.current.get(objectId);
        if (snap) {
          const dx = x - snap.x;
          const dy = y - snap.y;
          const now = new Date().toISOString();
          const sortedSelected = Array.from(selectedIds)
            .map(id => multiDragStartRef.current!.get(id))
            .filter(Boolean)
            .sort((a, b) => a!.z_index - b!.z_index);
          sortedSelected.forEach((s, i) => {
            if (!s) return;
            const tierMax = maxZInTier(objValues, s.type);
            const newZ = tierMax + 1 + i;
            if ((s.type === "line" || s.type === "drawing") && s.points && s.points.length > 0 && !s.start_object_id && !s.end_object_id) {
              const newPoints = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
              const bounds = computeLineBounds(newPoints);
              mutations.updateObject({ ...s, points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, z_index: newZ, updated_at: now });
            } else {
              mutations.updateObject({ ...s, x: s.x + dx, y: s.y + dy, z_index: newZ, updated_at: now });
            }
          });
        }
        multiDragStartRef.current = null;
        return;
      }

      const tierMax = maxZInTier(objValues, obj.type);
      const newZ = tierMax + 1;

      if ((obj.type === "line" || obj.type === "drawing") && obj.points && obj.points.length > 0 && !obj.start_object_id && !obj.end_object_id) {
        const dx = x - obj.x;
        const dy = y - obj.y;
        const newPoints = obj.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const bounds = computeLineBounds(newPoints);
        mutations.updateObject({ ...obj, points: newPoints, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, z_index: newZ, updated_at: new Date().toISOString() });
      } else {
        mutations.updateObject({ ...obj, x, y, z_index: newZ, updated_at: new Date().toISOString() });
      }
      multiDragStartRef.current = null;
    },
    [objects, selectedIds, mutations],
  );

  const handleResize = useCallback(
    (objectId: string, updates: { x: number; y: number; width: number; height: number }) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      if (!resizeOriginRef.current) {
        resizeOriginRef.current = { x: obj.x, y: obj.y };
      }
      const origin = resizeOriginRef.current;
      mutations.updateObject({
        ...obj,
        x: origin.x + updates.x, y: origin.y + updates.y,
        width: updates.width, height: updates.height,
        updated_at: new Date().toISOString(),
      });
    },
    [objects, mutations],
  );

  const handleResizeEnd = useCallback(
    (objectId: string, updates: { x: number; y: number; width: number; height: number }) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      const origin = resizeOriginRef.current || { x: obj.x, y: obj.y };
      const updated = {
        ...obj,
        x: origin.x + updates.x, y: origin.y + updates.y,
        width: updates.width, height: updates.height,
        updated_at: new Date().toISOString(),
      };
      mutations.updateObject(updated);
      resizeOriginRef.current = null;
    },
    [objects, mutations],
  );

  const handleRotate = useCallback(
    (objectId: string, rotation: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      mutations.updateObject({ ...obj, rotation, updated_at: new Date().toISOString() });
    },
    [objects, mutations],
  );

  const handleRotateEnd = useCallback(
    (objectId: string, rotation: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      const updated = { ...obj, rotation, updated_at: new Date().toISOString() };
      mutations.updateObject(updated);
    },
    [objects, mutations],
  );

  const handleLineUpdate = useCallback(
    (lineId: string, updates: Partial<BoardObject>) => {
      const obj = objects.get(lineId);
      if (!obj) return;
      mutations.updateObject({ ...obj, ...updates, updated_at: new Date().toISOString() });
    },
    [objects, mutations],
  );

  const handleLineUpdateEnd = useCallback(
    (lineId: string, updates: Partial<BoardObject>) => {
      const obj = objects.get(lineId);
      if (!obj) return;
      const updated = { ...obj, ...updates, updated_at: new Date().toISOString() };
      mutations.updateObject(updated);
    },
    [objects, mutations],
  );

  const handleInlineSave = useCallback(
    (text: string) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      mutations.updateObject({ ...obj, text, updated_at: new Date().toISOString() });
    },
    [editingId, objects, mutations],
  );

  const handleFormatChange = useCallback(
    (updates: Partial<BoardObject>) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      mutations.updateObject({ ...obj, ...updates, updated_at: new Date().toISOString() });
    },
    [editingId, objects, mutations],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedIds.size === 0) return;
      const now = new Date().toISOString();
      for (const id of selectedIds) {
        const obj = objects.get(id);
        if (!obj) continue;
        const updated = (obj.type === "line" || obj.type === "drawing")
          ? { ...obj, stroke_color: color, updated_at: now }
          : { ...obj, color, updated_at: now };
        mutations.updateObject(updated);
      }
    },
    [selectedIds, objects, mutations],
  );

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const toDelete = new Set(selectedIds);
    for (const id of selectedIds) {
      const connectedLines = connectionIndex.get(id);
      if (connectedLines) {
        for (const lineId of connectedLines) toDelete.add(lineId);
      }
    }
    for (const id of toDelete) {
      mutations.deleteObject(id);
    }
    setSelected(null);
    setEditingId(null);
  }, [selectedIds, connectionIndex, objects, mutations, setSelected]);

  const duplicateObjects = useCallback((objs: BoardObject[], offset = 20) => {
    const now = new Date().toISOString();
    const newObjs: BoardObject[] = [];
    const newIds = new Set<string>();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const tierMax = maxZInTier(objects.values(), obj.type);
      const newObj: BoardObject = {
        ...obj,
        id: crypto.randomUUID(),
        x: obj.x + offset, y: obj.y + offset,
        z_index: tierMax + 1 + i,
        created_by: userId || null,
        created_by_name: displayName || undefined,
        updated_at: now,
        frame_id: activeFrame?.id,
      };
      mutations.createObject(newObj);
      newObjs.push(newObj);
      newIds.add(newObj.id);
    }
    setSelectedIds(newIds);
    return newObjs;
  }, [objects, userId, displayName, mutations, setSelectedIds, activeFrame]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); canvasRef.current?.zoomIn(); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault(); canvasRef.current?.zoomOut(); return;
      }
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }
      const toolKeys: Record<string, ToolMode> = {
        "1": "select", "2": "hand",
        "s": "sticky", "t": "text", "r": "rectangle",
        "c": "circle", "d": "diamond", "p": "pill", "l": "line",
        "b": "draw", "e": "stamp",
      };
      if (!editingId && !(e.metaKey || e.ctrlKey) && toolKeys[e.key]) { setActiveTool(toolKeys[e.key]); return; }
      // Stamp type: Tab cycles through options when stamp tool active
      if (e.key === "Tab" && activeTool === "stamp" && !editingId) {
        e.preventDefault();
        const stampTypes = ["thumbsup", "heart", "fire", "star", "eyes", "laughing", "party", "plusone"];
        const idx = stampTypes.indexOf(selectedStampType);
        setSelectedStampType(stampTypes[(idx + 1) % stampTypes.length]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && selectedIds.size > 0) {
        e.preventDefault();
        clipboardRef.current = Array.from(selectedIds).map(id => objects.get(id)!).filter(Boolean);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && clipboardRef.current.length > 0) {
        e.preventDefault();
        clipboardRef.current = duplicateObjects(clipboardRef.current);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && selectedIds.size > 0) {
        e.preventDefault();
        duplicateObjects(Array.from(selectedIds).map(id => objects.get(id)!).filter(Boolean));
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingId) return;
        if (lineDrawing.drawingState.isDrawing) { lineDrawing.removeLastPoint(); return; }
        handleDelete();
      }
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement)?.blur?.();
        if (followingUserId) { stopFollowing(); return; }
        if (lineDrawing.drawingState.isDrawing) { lineDrawing.cancel(); return; }
        if (freehandDrawing.state.isDrawing) { freehandDrawing.cancel(); return; }
        if (editingId) { setEditingId(null); }
        else if (activeTool === "line" || activeTool === "draw" || CREATION_TOOLS.includes(activeTool)) { setActiveTool("select"); }
        else { setSelected(null); }
      }
      if (e.key === "/" && !editingId) { e.preventDefault(); setAiOpen(true); return; }
      if ((e.key === "[" || e.key === "]") && !editingId && !(e.metaKey || e.ctrlKey)) {
        const { frames: sortedFrames, activeFrameIndex } = useFrameStore.getState();
        if (sortedFrames.length < 2) return;
        const currentPos = sortedFrames.findIndex((f) => f.index === activeFrameIndex);
        if (e.key === "[" && currentPos > 0) {
          canvasRef.current?.navigateToFrame(sortedFrames[currentPos - 1].index);
        } else if (e.key === "]" && currentPos < sortedFrames.length - 1) {
          canvasRef.current?.navigateToFrame(sortedFrames[currentPos + 1].index);
        }
        return;
      }
      if (e.key === "Enter") {
        if (lineDrawing.drawingState.isDrawing) { finalizeLineDrawing(); return; }
        if (!editingId && selectedId) {
          const obj = objects.get(selectedId);
          if (obj && EDITABLE_TYPES.includes(obj.type)) setEditingId(selectedId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDelete, duplicateObjects, editingId, selectedId, selectedIds, objects, setSelected, activeTool, lineDrawing, finalizeLineDrawing, freehandDrawing, selectedStampType, setSelectedStampType, undo, redo, followingUserId, stopFollowing]);

  const handleSelectionRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number } | null) => { setSelectionRect(rect); },
    [],
  );

  const handleSelectionComplete = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      setSelectionRect(null);
      const ids = new Set<string>();
      const rx = rect.x, ry = rect.y, rr = rect.x + rect.width, rb = rect.y + rect.height;
      for (const obj of filteredObjects.values()) {
        let bounds: { x: number; y: number; width: number; height: number };
        if ((obj.type === "line" || obj.type === "drawing") && obj.points && obj.points.length >= 2) {
          bounds = computeLineBounds(obj.points);
        } else {
          bounds = getRotatedAABB(obj);
        }
        const ox = bounds.x, oy = bounds.y, or = bounds.x + bounds.width, ob = bounds.y + bounds.height;
        if (ox < rr && or > rx && oy < rb && ob > ry) ids.add(obj.id);
      }
      if (ids.size > 0) setSelectedIds(ids);
      else setSelected(null);
    },
    [filteredObjects, setSelected, setSelectedIds],
  );

  const handleNewFrame = useCallback(async () => {
    const { nextFrameIndex } = useFrameStore.getState();
    const index = nextFrameIndex();
    const frame: Frame = { id: crypto.randomUUID(), index, label: `Frame ${index + 1}` };
    mutations.createFrame(frame);
    if (canvasRef.current) {
      await canvasRef.current.zoomToFitAll();
      await new Promise((r) => setTimeout(r, 300));
      canvasRef.current.navigateToFrame(index);
    }
  }, [mutations]);

  const frames = useFrameStore((s) => s.frames);

  const handleDeleteFrame = useCallback(
    (frameId: string) => {
      const { frames: currentFrames } = useFrameStore.getState();
      if (currentFrames.length <= 1) return;
      mutations.deleteFrame(frameId);
    },
    [mutations],
  );

  const lineSnapTarget = useMemo(() => {
    if (activeTool !== "line" || !stageMousePos) return null;
    const snap = findSnapTarget(stageMousePos, filteredObjects);
    if (!snap) return null;
    const shape = filteredObjects.get(snap.objectId);
    if (!shape) return snap;
    const otherEnd = lineDrawing.drawingState.isDrawing
      ? lineDrawing.drawingState.points[0]
      : stageMousePos;
    const edge = computeEdgePoint(shape, otherEnd);
    return { ...snap, x: edge.x, y: edge.y };
  }, [activeTool, stageMousePos, filteredObjects, lineDrawing.drawingState]);

  const currentUserColor = self?.color || "#3b82f6";
  const isCreationTool = CREATION_TOOLS.includes(activeTool);
  const isLineTool = activeTool === "line";
  const isDrawTool = activeTool === "draw";
  const canvasMode: "hand" | "select" = activeTool === "hand" ? "hand" : "select";
  const editingObject = editingId ? objects.get(editingId) : undefined;
  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : null;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50"
      onMouseMove={isCreationTool || isLineTool || isDrawTool ? handleMouseMove : undefined}
      onMouseLeave={isCreationTool || isLineTool || isDrawTool ? handleMouseLeave : undefined}
      style={{ cursor: isCreationTool || isLineTool || isDrawTool ? "crosshair" : undefined, overscrollBehavior: "none" }}
    >
      {/* Presence + connection status */}
      <div className="absolute right-4 top-4 z-40 flex items-center gap-3">
        <ConnectionBadge />
        {syncStatus === "synchronizing" && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Syncing...</span>
        )}
        {followingUserId && (() => {
          const followedUser = [...(self ? [self] : []), ...others].find(u => u.userId === followingUserId);
          return followedUser ? (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 shadow-sm">
              Following {followedUser.displayName.split(" ")[0]}
              <button
                className="ml-0.5 rounded-full hover:text-blue-900"
                onClick={() => stopFollowing()}
                aria-label="Stop following"
              >
                ✕
              </button>
            </span>
          ) : null;
        })()}
        <OnlineUsers followingUserId={followingUserId} onFollow={(id) => id ? setFollowingUserId(id) : stopFollowing()} />
      </div>

      {/* Canvas */}
      <SvgCanvas
        ref={canvasRef}
        boardId={roomId}
        mode={canvasMode}
        isCreationMode={isCreationTool || isLineTool || isDrawTool}
        onStageMouseMove={handleStageMouseMove}
        onStageMouseLeave={handleStageMouseLeave}
        onCanvasPointerDown={isDrawTool ? (x, y) => freehandDrawing.startDrawing({ x, y }) : undefined}
        onCanvasPointerUp={isDrawTool ? () => {
          if (freehandDrawing.state.isDrawing) {
            const boardUUID = roomId === "default" ? "00000000-0000-0000-0000-000000000000" : roomId;
            const obj = freehandDrawing.finalize(boardUUID, userId || null, displayName || undefined, objects.size);
            if (obj) {
              obj.frame_id = activeFrame?.id;
              mutations.createObject(obj);
            }
          }
        } : undefined}
        onClickEmpty={() => {
          (document.activeElement as HTMLElement)?.blur?.();
          setEditingId(null);
          setSelected(null);
        }}
        onCanvasClick={handleCanvasClick}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        onSelectionRect={handleSelectionRect}
        onSelectionComplete={handleSelectionComplete}
      >
        <CanvasObjects
          objects={filteredObjects}
          selectedIds={selectedIds}
          onSelect={(id, shiftKey) => {
            if (!id) { setSelected(null); return; }
            if (shiftKey) {
              const next = new Set(selectedIds);
              next.has(id) ? next.delete(id) : next.add(id);
              setSelectedIds(next);
            } else {
              setSelected(id);
            }
            // Bring to front of its render tier
            const obj = filteredObjects.get(id);
            if (obj) {
              const tierMax = maxZInTier(filteredObjects.values(), obj.type);
              if (obj.z_index < tierMax) {
                mutations.updateObject({ ...obj, z_index: tierMax + 1, updated_at: new Date().toISOString() });
              }
            }
          }}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDoubleClick={handleObjectClick}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          onRotate={handleRotate}
          onRotateEnd={handleRotateEnd}
          onLineUpdate={handleLineUpdate}
          onLineUpdateEnd={handleLineUpdateEnd}
          interactive={activeTool === "select"}
          editingId={editingId}
        />
        {isLineTool && (
          <SvgLineDrawingLayer
            points={lineDrawing.drawingState.points}
            cursorPos={lineDrawing.drawingState.cursorPos}
            snapTarget={lineSnapTarget}
          />
        )}
        {isDrawTool && freehandDrawing.state.isDrawing && (
          <SvgDrawingPreviewLayer points={freehandDrawing.state.points} />
        )}
      </SvgCanvas>

      {/* Selection rect overlay */}
      {selectionRect && <SelectionRectOverlay rect={selectionRect} />}

      {/* Inline text editor + formatting toolbar */}
      {editingObject && (
        <>
          <PositionedFormattingToolbar object={editingObject} onFormatChange={handleFormatChange} />
          <InlineTextEditor
            object={editingObject}
            onSave={handleInlineSave}
            onClose={() => setEditingId(null)}
          />
        </>
      )}

      {/* Line formatting toolbar */}
      {!editingId && selectedId && (() => {
        const selObj = objects.get(selectedId);
        if (!selObj || (selObj.type !== "line" && selObj.type !== "drawing")) return null;
        return (
          <PositionedLineFormattingToolbar
            object={selObj}
            onUpdate={(updates) => handleLineUpdateEnd(selectedId, updates)}
          />
        );
      })()}

      {/* Cursor overlay */}
      <CursorsOverlay
        mousePosition={stageMousePos}
        currentUserColor={currentUserColor}
        activeFrameId={activeFrameId}
      />

      {/* Frame switcher */}
      <FrameSwitcher
        frames={frames}
        activeFrameIndex={activeFrameIndex}
        onSwitch={(index) => { canvasRef.current?.navigateToFrame(index); shortcutHint.trigger(); }}
        onCreate={handleNewFrame}
        onDelete={handleDeleteFrame}
        onRename={(frameId, label) => mutations.renameFrame(frameId, label)}
      />

      {/* Sidebar */}
      <Sidebar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        hasSelection={selectedIds.size > 0}
        selectedColor={firstSelectedId ? objects.get(firstSelectedId)?.color : undefined}
        onColorChange={handleColorChange}
        onDelete={handleDelete}
        currentBoardId={roomId}
        onAIToggle={() => setAiOpen((v) => !v)}
        aiOpen={aiOpen}
        selectedStampType={selectedStampType}
        onStampTypeChange={setSelectedStampType}
      />

      {/* AI Command Bar */}
      <AICommandBar
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        boardId={roomId}
        userId={userId || ""}
        displayName={displayName || ""}
        selectedIds={selectedIds}
        activeFrameId={activeFrameId}
        onFrameCreated={(index) => canvasRef.current?.navigateToFrame(index)}
        onObjectsAffected={(bounds) => {
          setSelectedIds(new Set());
          canvasRef.current?.panToObjects(bounds);
        }}
      />

      {/* Shortcut hint toast */}
      <ShortcutHint visible={shortcutHint.visible} />

      {/* Zoom controls */}
      <ZoomControls
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.resetZoom()}
      />

      {/* Ghost preview */}
      {(isCreationTool) && (
        <GhostPreview activeTool={activeTool} mousePos={mousePos} selectedStampType={selectedStampType} />
      )}

      {/* Draw tool cursor indicator */}
      {isDrawTool && mousePos && !freehandDrawing.state.isDrawing && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: mousePos.x - 10,
            top: mousePos.y - 10,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "2px solid #374151",
            opacity: 0.7,
          }}
        />
      )}

      {/* Line tool cursor indicator */}
      {isLineTool && mousePos && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: mousePos.x - 10,
            top: mousePos.y - 10,
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "2px solid #3b82f6",
            opacity: 0.7,
          }}
        />
      )}
    </div>
  );
}

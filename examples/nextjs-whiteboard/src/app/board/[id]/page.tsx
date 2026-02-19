"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { useBoardStore } from "@/lib/store/board-store";
import { usePresenceStore } from "@/lib/store/presence-store";
import { CursorsOverlay } from "@/components/presence/cursors-overlay";
import { OnlineUsers } from "@/components/presence/online-users";
import { NameDialog } from "@/components/auth/name-dialog";
import { Sidebar } from "@/components/canvas/sidebar";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { GhostPreview } from "@/components/canvas/ghost-preview";
import { InlineTextEditor } from "@/components/canvas/inline-text-editor";
import { FormattingToolbar } from "@/components/canvas/formatting-toolbar";
import { LineFormattingToolbar } from "@/components/canvas/line-formatting-toolbar";
import { SvgCanvas, type BoardCanvasHandle } from "@/components/canvas/svg-canvas";
import { CanvasObjects } from "@/components/canvas/canvas-objects";
import { SvgLineDrawingLayer } from "@/components/canvas/svg-line-drawing-layer";
import { useViewportStore } from "@/lib/store/viewport-store";
import { computeLineBounds } from "@/lib/geometry/edge-intersection";
import { getRotatedAABB } from "@/lib/geometry/rotation";
import { findSnapTarget } from "@/lib/geometry/snap";
import type { BoardObject, ToolMode, Frame } from "@/types/board";
import { useFrameStore } from "@/lib/store/frame-store";
import { useLineDrawing } from "@/hooks/use-line-drawing";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { AICommandBar } from "@/components/ai/ai-command-bar";
import { BoardRoomProvider } from "@/lib/sync/openblocks-provider";
import { useOpenBlocksSync } from "@/lib/sync/use-openblocks-sync";
import { useBoardMutations } from "@/lib/sync/use-board-mutations";

const CREATION_TOOLS: ToolMode[] = ["sticky", "rectangle", "text", "circle", "diamond", "pill"];
const EDITABLE_TYPES: BoardObject["type"][] = ["sticky", "text"];

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
    <BoardRoomProvider
      roomId={roomId}
      userId={userId || ""}
      displayName={displayName || ""}
    >
      <BoardPageInner roomId={roomId} userId={userId || ""} displayName={displayName || ""} />
    </BoardRoomProvider>
  );
}

function BoardPageInner({ roomId, userId, displayName }: { roomId: string; userId: string; displayName: string }) {
  const { objects, selectedIds, setSelected, setSelectedIds, connectionIndex } = useBoardStore();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const viewportScale = useViewportStore((s) => s.scale);
  const viewportPos = useViewportStore((s) => s.pos);
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
  const resizeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const multiDragStartRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const clipboardRef = useRef<BoardObject[]>([]);
  const lineDrawing = useLineDrawing();
  const dragBeforeRef = useRef<BoardObject[] | null>(null);
  const resizeBeforeRef = useRef<BoardObject | null>(null);
  const rotateBeforeRef = useRef<BoardObject | null>(null);
  const lineEditBeforeRef = useRef<BoardObject | null>(null);

  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

  useEffect(() => {
    localStorage.setItem(`ai-open:${roomId}`, String(aiOpen));
  }, [aiOpen, roomId]);

  const { isConnected, room, root } = useOpenBlocksSync();
  const mutations = useBoardMutations(room, root);
  const { recordAction, undo, redo } = useUndoRedo(mutations);

  const handleStageMouseMove = useCallback(
    (relativePointerPos: { x: number; y: number } | null) => {
      if (!relativePointerPos) return;
      setStageMousePos(relativePointerPos);
      lineDrawing.setCursorPos(relativePointerPos);
      mutations.updateCursor(relativePointerPos.x, relativePointerPos.y);
    },
    [mutations, lineDrawing.setCursorPos],
  );

  const handleStageMouseLeave = useCallback(() => {
    setStageMousePos(null);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

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
      };
      mutations.createObject(obj);
      recordAction({ type: "create", objects: [obj] });
    },
    [roomId, objects.size, userId, displayName, mutations, recordAction],
  );

  const finalizeLineDrawing = useCallback(() => {
    const boardUUID = roomId === "default" ? "00000000-0000-0000-0000-000000000000" : roomId;
    const obj = lineDrawing.finalize(boardUUID, userId || null, displayName || undefined, objects.size);
    if (obj) {
      mutations.createObject(obj);
      recordAction({ type: "create", objects: [obj] });
      setActiveTool("select");
    }
  }, [lineDrawing, roomId, userId, displayName, objects.size, mutations, recordAction]);

  const handleCanvasClick = useCallback(
    (canvasX: number, canvasY: number) => {
      (document.activeElement as HTMLElement)?.blur?.();
      if (activeTool === "line") {
        let pos = { x: canvasX, y: canvasY };
        const snap = findSnapTarget(pos, objects);
        if (snap) pos = { x: snap.x, y: snap.y };
        if (!lineDrawing.drawingState.isDrawing) {
          lineDrawing.startPoint(pos, snap?.objectId);
        } else {
          lineDrawing.addPoint(pos, snap?.objectId);
        }
        return;
      }
      if (CREATION_TOOLS.includes(activeTool)) {
        createObjectAt(activeTool as BoardObject["type"], canvasX, canvasY);
        setActiveTool("select");
      } else {
        setEditingId(null);
        setSelected(null);
      }
    },
    [activeTool, createObjectAt, setSelected, lineDrawing],
  );

  const handleCanvasDoubleClick = useCallback(
    (_canvasX: number, _canvasY: number) => {
      if (activeTool === "line" && lineDrawing.drawingState.isDrawing) {
        finalizeLineDrawing();
      }
    },
    [activeTool, lineDrawing.drawingState.isDrawing, finalizeLineDrawing],
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
          const starts = new Map<string, { x: number; y: number }>();
          const snapshots: BoardObject[] = [];
          for (const id of selectedIds) {
            const o = objects.get(id);
            if (o) { starts.set(id, { x: o.x, y: o.y }); snapshots.push({ ...o }); }
          }
          multiDragStartRef.current = starts;
          dragBeforeRef.current = snapshots;
        }
        const startPos = multiDragStartRef.current.get(objectId);
        if (!startPos) return;
        const dx = x - startPos.x;
        const dy = y - startPos.y;
        const now = new Date().toISOString();
        for (const id of selectedIds) {
          const o = objects.get(id);
          const sp = multiDragStartRef.current.get(id);
          if (!o || !sp) continue;
          mutations.updateObject({ ...o, x: sp.x + dx, y: sp.y + dy, updated_at: now });
        }
        return;
      }

      if (!dragBeforeRef.current) {
        dragBeforeRef.current = [{ ...obj }];
      }
      mutations.updateObject({ ...obj, x, y, updated_at: new Date().toISOString() });
    },
    [objects, selectedIds, mutations],
  );

  const handleDragEnd = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;

      if (selectedIds.has(objectId) && selectedIds.size > 1 && multiDragStartRef.current) {
        const startPos = multiDragStartRef.current.get(objectId);
        if (startPos) {
          const dx = x - startPos.x;
          const dy = y - startPos.y;
          const now = new Date().toISOString();
          const afterObjs: BoardObject[] = [];
          for (const id of selectedIds) {
            const o = objects.get(id);
            const sp = multiDragStartRef.current.get(id);
            if (!o || !sp) continue;
            const updated = { ...o, x: sp.x + dx, y: sp.y + dy, updated_at: now };
            mutations.updateObject(updated);
            afterObjs.push(updated);
          }
          if (dragBeforeRef.current) {
            recordAction({ type: "update", before: dragBeforeRef.current, after: afterObjs });
          }
        }
        multiDragStartRef.current = null;
        dragBeforeRef.current = null;
        return;
      }

      const updated = { ...obj, x, y, updated_at: new Date().toISOString() };
      mutations.updateObject(updated);
      if (dragBeforeRef.current) {
        recordAction({ type: "update", before: dragBeforeRef.current, after: [updated] });
      }
      multiDragStartRef.current = null;
      dragBeforeRef.current = null;
    },
    [objects, selectedIds, mutations, recordAction],
  );

  const handleResize = useCallback(
    (objectId: string, updates: { x: number; y: number; width: number; height: number }) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      if (!resizeOriginRef.current) {
        resizeOriginRef.current = { x: obj.x, y: obj.y };
        resizeBeforeRef.current = { ...obj };
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
      if (resizeBeforeRef.current) {
        recordAction({ type: "update", before: [resizeBeforeRef.current], after: [updated] });
      }
      resizeOriginRef.current = null;
      resizeBeforeRef.current = null;
    },
    [objects, mutations, recordAction],
  );

  const handleRotate = useCallback(
    (objectId: string, rotation: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      if (!rotateBeforeRef.current) rotateBeforeRef.current = { ...obj };
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
      if (rotateBeforeRef.current) {
        recordAction({ type: "update", before: [rotateBeforeRef.current], after: [updated] });
      }
      rotateBeforeRef.current = null;
    },
    [objects, mutations, recordAction],
  );

  const handleLineUpdate = useCallback(
    (lineId: string, updates: Partial<BoardObject>) => {
      const obj = objects.get(lineId);
      if (!obj) return;
      if (!lineEditBeforeRef.current) lineEditBeforeRef.current = { ...obj };
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
      if (lineEditBeforeRef.current) {
        recordAction({ type: "update", before: [lineEditBeforeRef.current], after: [updated] });
      }
      lineEditBeforeRef.current = null;
    },
    [objects, mutations, recordAction],
  );

  const handleInlineSave = useCallback(
    (text: string) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      const before = { ...obj };
      const updated = { ...obj, text, updated_at: new Date().toISOString() };
      mutations.updateObject(updated);
      recordAction({ type: "update", before: [before], after: [updated] });
    },
    [editingId, objects, mutations, recordAction],
  );

  const handleFormatChange = useCallback(
    (updates: Partial<BoardObject>) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      const before = { ...obj };
      const updated = { ...obj, ...updates, updated_at: new Date().toISOString() };
      mutations.updateObject(updated);
      recordAction({ type: "update", before: [before], after: [updated] });
    },
    [editingId, objects, mutations, recordAction],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedIds.size === 0) return;
      const now = new Date().toISOString();
      const beforeObjs: BoardObject[] = [];
      const afterObjs: BoardObject[] = [];
      for (const id of selectedIds) {
        const obj = objects.get(id);
        if (!obj) continue;
        beforeObjs.push({ ...obj });
        const updated = obj.type === "line"
          ? { ...obj, stroke_color: color, updated_at: now }
          : { ...obj, color, updated_at: now };
        mutations.updateObject(updated);
        afterObjs.push(updated);
      }
      if (beforeObjs.length > 0) {
        recordAction({ type: "update", before: beforeObjs, after: afterObjs });
      }
    },
    [selectedIds, objects, mutations, recordAction],
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
    const deletedObjs: BoardObject[] = [];
    for (const id of toDelete) {
      const obj = objects.get(id);
      if (obj) deletedObjs.push({ ...obj });
    }
    for (const id of toDelete) {
      mutations.deleteObject(id);
    }
    if (deletedObjs.length > 0) {
      recordAction({ type: "delete", objects: deletedObjs });
    }
    setSelected(null);
    setEditingId(null);
  }, [selectedIds, connectionIndex, objects, mutations, setSelected, recordAction]);

  const duplicateObjects = useCallback((objs: BoardObject[], offset = 20) => {
    const now = new Date().toISOString();
    const maxZ = objects.size > 0
      ? Math.max(...Array.from(objects.values()).map(o => o.z_index))
      : -1;
    const newObjs: BoardObject[] = [];
    const newIds = new Set<string>();
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      const newObj: BoardObject = {
        ...obj,
        id: crypto.randomUUID(),
        x: obj.x + offset, y: obj.y + offset,
        z_index: maxZ + 1 + i,
        created_by: userId || null,
        created_by_name: displayName || undefined,
        updated_at: now,
      };
      mutations.createObject(newObj);
      newObjs.push(newObj);
      newIds.add(newObj.id);
    }
    if (newObjs.length > 0) {
      recordAction({ type: "create", objects: newObjs });
    }
    setSelectedIds(newIds);
    return newObjs;
  }, [objects, userId, displayName, mutations, setSelectedIds, recordAction]);

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
      };
      if (!editingId && !(e.metaKey || e.ctrlKey) && toolKeys[e.key]) { setActiveTool(toolKeys[e.key]); return; }
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
        if (lineDrawing.drawingState.isDrawing) { lineDrawing.cancel(); return; }
        if (editingId) { setEditingId(null); }
        else if (activeTool === "line" || CREATION_TOOLS.includes(activeTool)) { setActiveTool("select"); }
        else { setSelected(null); }
      }
      if (e.key === "/" && !editingId) { e.preventDefault(); setAiOpen(true); return; }
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
  }, [handleDelete, duplicateObjects, editingId, selectedId, selectedIds, objects, setSelected, activeTool, lineDrawing, finalizeLineDrawing, undo, redo]);

  const handleSelectionRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number } | null) => { setSelectionRect(rect); },
    [],
  );

  const handleSelectionComplete = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      setSelectionRect(null);
      const ids = new Set<string>();
      const rx = rect.x, ry = rect.y, rr = rect.x + rect.width, rb = rect.y + rect.height;
      for (const obj of objects.values()) {
        let bounds: { x: number; y: number; width: number; height: number };
        if (obj.type === "line" && obj.points && obj.points.length >= 2) {
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
    [objects, setSelected, setSelectedIds],
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
    return findSnapTarget(stageMousePos, objects);
  }, [activeTool, stageMousePos, objects]);

  const currentUserColor = onlineUsers.find((u) => u.userId === userId)?.color || "#3b82f6";
  const isCreationTool = CREATION_TOOLS.includes(activeTool);
  const isLineTool = activeTool === "line";
  const canvasMode: "hand" | "select" = activeTool === "hand" ? "hand" : "select";
  const editingObject = editingId ? objects.get(editingId) : undefined;
  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : null;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50"
      onMouseMove={isCreationTool || isLineTool ? handleMouseMove : undefined}
      onMouseLeave={isCreationTool || isLineTool ? handleMouseLeave : undefined}
      style={{ cursor: isCreationTool || isLineTool ? "crosshair" : undefined }}
    >
      {/* Presence + connection status */}
      <div className="absolute right-4 top-4 z-40 flex items-center gap-3">
        {!isConnected && (
          <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 shadow-sm">
            Reconnecting...
          </span>
        )}
        <OnlineUsers />
      </div>

      {/* Canvas */}
      <SvgCanvas
        ref={canvasRef}
        boardId={roomId}
        mode={canvasMode}
        onStageMouseMove={handleStageMouseMove}
        onStageMouseLeave={handleStageMouseLeave}
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
          objects={objects}
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
          scale={viewportScale}
        />
        {isLineTool && (
          <SvgLineDrawingLayer
            points={lineDrawing.drawingState.points}
            cursorPos={lineDrawing.drawingState.cursorPos}
            snapTarget={lineSnapTarget}
          />
        )}
      </SvgCanvas>

      {/* Selection rect overlay */}
      {selectionRect && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: selectionRect.x * viewportScale + viewportPos.x,
            top: selectionRect.y * viewportScale + viewportPos.y,
            width: selectionRect.width * viewportScale,
            height: selectionRect.height * viewportScale,
            border: "1.5px solid #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            borderRadius: 2,
          }}
        />
      )}

      {/* Inline text editor + formatting toolbar */}
      {editingObject && (
        <>
          <FormattingToolbar
            object={editingObject}
            onFormatChange={handleFormatChange}
            screenX={getRotatedAABB(editingObject).x * viewportScale + viewportPos.x}
            screenY={getRotatedAABB(editingObject).y * viewportScale + viewportPos.y}
            screenW={getRotatedAABB(editingObject).width * viewportScale}
          />
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
        if (!selObj || selObj.type !== "line") return null;
        const bounds = selObj.points && selObj.points.length >= 2
          ? computeLineBounds(selObj.points)
          : { x: selObj.x, y: selObj.y, width: selObj.width, height: selObj.height };
        return (
          <LineFormattingToolbar
            object={selObj}
            onUpdate={(updates) => handleLineUpdateEnd(selectedId, updates)}
            screenX={bounds.x * viewportScale + viewportPos.x}
            screenY={bounds.y * viewportScale + viewportPos.y}
            screenW={bounds.width * viewportScale}
          />
        );
      })()}

      {/* Cursor overlay */}
      <CursorsOverlay
        currentUserId={userId || ""}
        mousePosition={stageMousePos}
        currentUserColor={currentUserColor}
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
        onNewFrame={handleNewFrame}
        frames={frames}
        onDeleteFrame={handleDeleteFrame}
      />

      {/* AI Command Bar */}
      <AICommandBar
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        boardId={roomId}
        userId={userId || ""}
        displayName={displayName || ""}
        selectedIds={selectedIds}
      />

      {/* Zoom controls */}
      <ZoomControls
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.resetZoom()}
      />

      {/* Ghost preview */}
      {isCreationTool && (
        <GhostPreview activeTool={activeTool} mousePos={mousePos} />
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

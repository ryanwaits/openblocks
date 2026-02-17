"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParty } from "@/lib/sync/use-party";
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
import { useViewportStore } from "@/lib/store/viewport-store";
import { broadcastObjectCreate, broadcastObjectUpdate, broadcastObjectDelete } from "@/lib/sync/broadcast";
import type { BoardObject, ToolMode } from "@/types/board";
import type { BoardCanvasHandle } from "@/components/canvas/board-canvas";

const BoardCanvas = dynamic(
  () => import("@/components/canvas/board-canvas").then((m) => ({ default: m.BoardCanvas })),
  { ssr: false, loading: () => <div className="flex h-full w-full items-center justify-center text-gray-400">Loading canvas...</div> }
);

const CanvasObjects = dynamic(
  () => import("@/components/canvas/canvas-objects").then((m) => ({ default: m.CanvasObjects })),
  { ssr: false }
);

const CREATION_TOOLS: ToolMode[] = ["sticky", "rectangle", "text"];
const EDITABLE_TYPES: BoardObject["type"][] = ["sticky", "text"];

export default function BoardPage() {
  const params = useParams();
  const roomId = params.id as string;

  const { userId, displayName, isAuthenticated, isLoading, restoreSession } = useAuthStore();
  const { objects, selectedIds, setSelected, setSelectedIds, updateObject } = useBoardStore();
  const onlineUsers = usePresenceStore((s) => s.onlineUsers);
  const viewportScale = useViewportStore((s) => s.scale);
  const viewportPos = useViewportStore((s) => s.pos);
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stageMousePos, setStageMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const lastCursorSend = useRef(0);
  const canvasRef = useRef<BoardCanvasHandle>(null);
  const resizeOriginRef = useRef<{ x: number; y: number } | null>(null);
  const multiDragStartRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  // Derive single selectedId for editing/formatting (first selected if exactly 1)
  const selectedId = selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const { sendMessage, isConnected } = useParty({
    roomId,
    userId: userId || "",
    displayName: displayName || "",
  });

  const handleStageMouseMove = useCallback(
    (relativePointerPos: { x: number; y: number } | null) => {
      if (!relativePointerPos) return;
      setStageMousePos(relativePointerPos);
      const now = Date.now();
      if (now - lastCursorSend.current < 16) return;
      lastCursorSend.current = now;

      sendMessage({
        type: "cursor:update",
        x: relativePointerPos.x,
        y: relativePointerPos.y,
      });
    },
    [sendMessage]
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
        created_by: userId || "",
        updated_at: new Date().toISOString(),
      };
      broadcastObjectCreate(sendMessage, obj);
    },
    [roomId, objects.size, userId, sendMessage]
  );

  const handleCanvasClick = useCallback(
    (canvasX: number, canvasY: number) => {
      if (CREATION_TOOLS.includes(activeTool)) {
        createObjectAt(activeTool as BoardObject["type"], canvasX, canvasY);
        setActiveTool("select");
      } else {
        // Click on empty canvas — close editor + deselect
        setEditingId(null);
        setSelected(null);
      }
    },
    [activeTool, createObjectAt, setSelected]
  );

  const handleObjectClick = useCallback(
    (id: string) => {
      if (activeTool !== "select") return;
      const obj = objects.get(id);
      if (obj && EDITABLE_TYPES.includes(obj.type)) {
        setEditingId(id);
      }
    },
    [activeTool, objects]
  );

  const handleDragMove = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;

      // Multi-drag: move all selected objects by the same delta
      if (selectedIds.has(objectId) && selectedIds.size > 1) {
        if (!multiDragStartRef.current) {
          // Capture start positions for all selected objects
          const starts = new Map<string, { x: number; y: number }>();
          for (const id of selectedIds) {
            const o = objects.get(id);
            if (o) starts.set(id, { x: o.x, y: o.y });
          }
          multiDragStartRef.current = starts;
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
          const updated = { ...o, x: sp.x + dx, y: sp.y + dy, updated_at: now };
          updateObject(updated);
          broadcastObjectUpdate(sendMessage, updated, true);
        }
        return;
      }

      const updated = { ...obj, x, y, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, true);
    },
    [objects, selectedIds, sendMessage, updateObject]
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
          for (const id of selectedIds) {
            const o = objects.get(id);
            const sp = multiDragStartRef.current.get(id);
            if (!o || !sp) continue;
            const updated = { ...o, x: sp.x + dx, y: sp.y + dy, updated_at: now };
            updateObject(updated);
            broadcastObjectUpdate(sendMessage, updated, false);
          }
        }
        multiDragStartRef.current = null;
        return;
      }

      const updated = { ...obj, x, y, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
      multiDragStartRef.current = null;
    },
    [objects, selectedIds, sendMessage, updateObject]
  );

  const handleResize = useCallback(
    (objectId: string, updates: { x: number; y: number; width: number; height: number }) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      if (!resizeOriginRef.current) {
        resizeOriginRef.current = { x: obj.x, y: obj.y };
      }
      const origin = resizeOriginRef.current;
      const updated = {
        ...obj,
        x: origin.x + updates.x,
        y: origin.y + updates.y,
        width: updates.width,
        height: updates.height,
        updated_at: new Date().toISOString(),
      };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, true);
    },
    [objects, sendMessage, updateObject]
  );

  const handleResizeEnd = useCallback(
    (objectId: string, updates: { x: number; y: number; width: number; height: number }) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      const origin = resizeOriginRef.current || { x: obj.x, y: obj.y };
      const updated = {
        ...obj,
        x: origin.x + updates.x,
        y: origin.y + updates.y,
        width: updates.width,
        height: updates.height,
        updated_at: new Date().toISOString(),
      };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
      resizeOriginRef.current = null;
    },
    [objects, sendMessage, updateObject]
  );

  const handleInlineSave = useCallback(
    (text: string) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      const updated = { ...obj, text, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
    },
    [editingId, objects, sendMessage, updateObject]
  );

  const handleFormatChange = useCallback(
    (updates: Partial<BoardObject>) => {
      if (!editingId) return;
      const obj = objects.get(editingId);
      if (!obj) return;
      const updated = { ...obj, ...updates, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
    },
    [editingId, objects, sendMessage, updateObject]
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (selectedIds.size === 0) return;
      const now = new Date().toISOString();
      for (const id of selectedIds) {
        const obj = objects.get(id);
        if (!obj) continue;
        const updated = { ...obj, color, updated_at: now };
        updateObject(updated);
        broadcastObjectUpdate(sendMessage, updated, false);
      }
    },
    [selectedIds, objects, sendMessage, updateObject]
  );

  const handleDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      broadcastObjectDelete(sendMessage, id);
    }
    setSelected(null);
    setEditingId(null);
  }, [selectedIds, sendMessage, setSelected]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when in input/textarea
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingId) return;
        handleDelete();
      }

      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
        } else {
          setSelected(null);
        }
      }

      if (e.key === "Enter" && !editingId && selectedId) {
        const obj = objects.get(selectedId);
        if (obj && EDITABLE_TYPES.includes(obj.type)) {
          setEditingId(selectedId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDelete, editingId, selectedId, selectedIds, objects, setSelected]);

  const handleSelectionRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number } | null) => {
      setSelectionRect(rect);
    },
    []
  );

  const handleSelectionComplete = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      setSelectionRect(null);
      const ids = new Set<string>();
      const rx = rect.x;
      const ry = rect.y;
      const rr = rect.x + rect.width;
      const rb = rect.y + rect.height;
      for (const obj of objects.values()) {
        const ox = obj.x;
        const oy = obj.y;
        const or = obj.x + obj.width;
        const ob = obj.y + obj.height;
        if (ox < rr && or > rx && oy < rb && ob > ry) {
          ids.add(obj.id);
        }
      }
      if (ids.size > 0) {
        setSelectedIds(ids);
      } else {
        setSelected(null);
      }
    },
    [objects, setSelected, setSelectedIds]
  );

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

  const currentUserColor = onlineUsers.find((u) => u.userId === userId)?.color || "#3b82f6";
  const isCreationTool = CREATION_TOOLS.includes(activeTool);
  const canvasMode: "hand" | "select" = activeTool === "hand" ? "hand" : "select";
  const editingObject = editingId ? objects.get(editingId) : undefined;
  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : null;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50"
      onMouseMove={isCreationTool ? handleMouseMove : undefined}
      onMouseLeave={isCreationTool ? handleMouseLeave : undefined}
      style={{ cursor: isCreationTool ? "crosshair" : undefined }}
    >
      {/* Top bar */}
      <div className="absolute left-4 right-4 top-4 z-40 flex items-center justify-between rounded-xl border border-gray-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold text-gray-700">Whiteboard</h1>
          {!isConnected && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              Reconnecting...
            </span>
          )}
        </div>
        <OnlineUsers />
      </div>

      {/* Canvas */}
      <BoardCanvas
        ref={canvasRef}
        boardId={roomId}
        mode={canvasMode}
        onStageMouseMove={handleStageMouseMove}
        onStageMouseLeave={handleStageMouseLeave}
        onClickEmpty={() => {
          setEditingId(null);
          setSelected(null);
        }}
        onCanvasClick={handleCanvasClick}
        onSelectionRect={handleSelectionRect}
        onSelectionComplete={handleSelectionComplete}
      >
        <CanvasObjects
          objects={objects}
          selectedIds={selectedIds}
          onSelect={setSelected}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDoubleClick={handleObjectClick}
          onResize={handleResize}
          onResizeEnd={handleResizeEnd}
          interactive={activeTool !== "hand"}
          editingId={editingId}
          scale={viewportScale}
        />
      </BoardCanvas>

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
            screenX={editingObject.x * viewportScale + viewportPos.x}
            screenY={editingObject.y * viewportScale + viewportPos.y}
            screenW={editingObject.width * viewportScale}
          />
          <InlineTextEditor
            object={editingObject}
            onSave={handleInlineSave}
            onClose={() => setEditingId(null)}
          />
        </>
      )}

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
    </div>
  );
}

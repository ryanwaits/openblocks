"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParty } from "@/lib/sync/use-party";
import { useAuthStore } from "@/lib/store/auth-store";
import { useBoardStore } from "@/lib/store/board-store";
import { CursorsOverlay } from "@/components/presence/cursors-overlay";
import { OnlineUsers } from "@/components/presence/online-users";
import { NameDialog } from "@/components/auth/name-dialog";
import { Sidebar } from "@/components/canvas/sidebar";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { GhostPreview } from "@/components/canvas/ghost-preview";
import { InlineTextEditor } from "@/components/canvas/inline-text-editor";
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

const CREATION_TOOLS: ToolMode[] = ["sticky", "rectangle", "block", "text"];
const EDITABLE_TYPES: BoardObject["type"][] = ["sticky", "block", "text"];

export default function BoardPage() {
  const params = useParams();
  const roomId = params.id as string;

  const { userId, displayName, isAuthenticated, isLoading, restoreSession } = useAuthStore();
  const { objects, selectedId, setSelected, updateObject } = useBoardStore();
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastCursorSend = useRef(0);
  const canvasRef = useRef<BoardCanvasHandle>(null);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const { sendMessage, isConnected } = useParty({
    roomId,
    userId: userId || "",
    displayName: displayName || "",
  });

  const handleStageMouseMove = useCallback(
    (_pos: { x: number; y: number }, _scale: number, relativePointerPos: { x: number; y: number } | null) => {
      if (!relativePointerPos) return;
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

  const handleStageUpdate = useCallback((pos: { x: number; y: number }, scale: number) => {
    setStagePos(pos);
    setStageScale(scale);
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
        block: { width: 400, height: 300, color: "#ffffff" },
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
    (obj: BoardObject) => {
      if (activeTool !== "select") return;
      if (EDITABLE_TYPES.includes(obj.type)) {
        setEditingId(obj.id);
      }
    },
    [activeTool]
  );

  const handleDragMove = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      const updated = { ...obj, x, y, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, true);
    },
    [objects, sendMessage, updateObject]
  );

  const handleDragEnd = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objects.get(objectId);
      if (!obj) return;
      const updated = { ...obj, x, y, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
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

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedId) return;
      const obj = objects.get(selectedId);
      if (!obj) return;
      const updated = { ...obj, color, updated_at: new Date().toISOString() };
      updateObject(updated);
      broadcastObjectUpdate(sendMessage, updated, false);
    },
    [selectedId, objects, sendMessage, updateObject]
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    broadcastObjectDelete(sendMessage, selectedId);
    setSelected(null);
    setEditingId(null);
  }, [selectedId, sendMessage, setSelected]);

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
  }, [handleDelete, editingId, selectedId, objects, setSelected]);

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

  const isCreationTool = CREATION_TOOLS.includes(activeTool);
  const canvasMode: "hand" | "select" = activeTool === "hand" ? "hand" : "select";
  const editingObject = editingId ? objects.get(editingId) : undefined;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-gray-50"
      onMouseMove={isCreationTool ? handleMouseMove : undefined}
      onMouseLeave={isCreationTool ? handleMouseLeave : undefined}
      style={{ cursor: isCreationTool ? "crosshair" : undefined }}
    >
      {/* Top bar */}
      <div className="absolute left-20 right-4 top-4 z-40 flex items-center justify-between rounded-xl border border-gray-200 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm">
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
        mode={canvasMode}
        onStageMouseMove={handleStageMouseMove}
        onStageUpdate={handleStageUpdate}
        onClickEmpty={() => {
          setEditingId(null);
          setSelected(null);
        }}
        onCanvasClick={handleCanvasClick}
      >
        <CanvasObjects
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelected}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDoubleClick={handleObjectClick}
          interactive={activeTool !== "hand"}
          editingId={editingId}
        />
      </BoardCanvas>

      {/* Inline text editor */}
      {editingObject && (
        <InlineTextEditor
          object={editingObject}
          stageScale={stageScale}
          stagePos={stagePos}
          onSave={handleInlineSave}
          onClose={() => setEditingId(null)}
        />
      )}

      {/* Cursor overlay */}
      <CursorsOverlay
        stageScale={stageScale}
        stagePos={stagePos}
        currentUserId={userId || ""}
      />

      {/* Sidebar */}
      <Sidebar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        hasSelection={!!selectedId}
        selectedColor={selectedId ? objects.get(selectedId)?.color : undefined}
        onColorChange={handleColorChange}
        onDelete={handleDelete}
      />

      {/* Zoom controls */}
      <ZoomControls
        scale={stageScale}
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

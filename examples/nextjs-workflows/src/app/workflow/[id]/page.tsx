"use client";

import { useParams } from "next/navigation";
import { useRef, useCallback, useEffect, useState } from "react";
import {
  LivelyProvider, RoomProvider,
  useSyncStatus, useErrorListener, useLostConnectionListener,
  useOthersListener, useHistory,
} from "@waits/lively-react";
import { ConnectionBadge } from "@waits/lively-ui";
import { WorkflowCanvas, type CanvasHandle } from "@/components/canvas/workflow-canvas";
import { NodeLayer } from "@/components/canvas/node-layer";
import { EdgeLayer } from "@/components/canvas/edge-layer";
import { ConnectionDraftLayer } from "@/components/canvas/connection-draft-layer";
import { NodePalette } from "@/components/sidebar/node-palette";
import { NodeConfigPanel } from "@/components/sidebar/node-config-panel";
import { WorkflowTopbar } from "@/components/topbar/workflow-topbar";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { CursorsOverlay } from "@/components/presence/cursors-overlay";
import { useNodeDrag } from "@/hooks/use-node-drag";
import { useConnectionDraw } from "@/hooks/use-connection-draw";
import { useWorkflowStore } from "@/lib/store/workflow-store";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { screenToCanvas } from "@/lib/canvas-utils";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { client, buildInitialStorage } from "@/lib/sync/client";
import { useLivelySync } from "@/lib/sync/use-lively-sync";
import { useWorkflowMutations } from "@/lib/sync/use-workflow-mutations";
import type { WorkflowNode, WorkflowNodeType } from "@/types/workflow";

export default function WorkflowPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const { userId, displayName, restore } = useAuthStore();

  useEffect(() => { restore(); }, [restore]);

  if (!userId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId={workflowId}
        userId={userId}
        displayName={displayName}
        initialStorage={buildInitialStorage()}
      >
        <WorkflowPageInner workflowId={workflowId} />
      </RoomProvider>
    </LivelyProvider>
  );
}

function WorkflowPageInner({ workflowId }: { workflowId: string }) {
  const canvasRef = useRef<CanvasHandle>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  // --- Lively sync ---
  useLivelySync();
  const mutations = useWorkflowMutations();
  const syncStatus = useSyncStatus();
  const { undo, redo } = useHistory();
  useErrorListener((err) => console.error("[Lively]", err.message));
  useLostConnectionListener(() => console.warn("[Lively] Connection lost, reconnecting..."));

  // Re-broadcast cursor when a new user joins so they see us immediately
  useOthersListener((event) => {
    if (event.type === "enter") {
      const { pos: vpPos, scale } = useViewportStore.getState();
      const cursorPos = lastCursorRef.current ?? {
        x: (window.innerWidth / 2 - vpPos.x) / scale,
        y: (window.innerHeight / 2 - vpPos.y) / scale,
      };
      mutations.updateCursor(cursorPos.x, cursorPos.y);
    }
  });

  // Re-broadcast cursor on viewport changes (pan/zoom without mouse movement)
  useEffect(() => {
    return useViewportStore.subscribe(() => {
      const { pos: vpPos, scale } = useViewportStore.getState();
      const cursorPos = lastCursorRef.current ?? {
        x: (window.innerWidth / 2 - vpPos.x) / scale,
        y: (window.innerHeight / 2 - vpPos.y) / scale,
      };
      mutations.updateCursor(cursorPos.x, cursorPos.y);
    });
  }, [mutations]);

  // --- SVG ref: one-shot acquisition after canvas mounts ---
  useEffect(() => {
    // Check once synchronously, then poll briefly until available
    const el = canvasRef.current?.getSvgElement();
    if (el) { svgRef.current = el; return; }
    const interval = setInterval(() => {
      const el = canvasRef.current?.getSvgElement();
      if (el) {
        svgRef.current = el;
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // --- Hooks that mutate via Lively ---
  useNodeDrag(svgRef, mutations);
  const { handlePortPointerDown } = useConnectionDraw(svgRef, mutations);

  const handleCanvasClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  // Drop from palette → create node via Lively mutation
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain") as WorkflowNodeType;
    if (!type || !NODE_DEFINITIONS[type]) return;

    const svg = svgRef.current;
    if (!svg) return;
    const { pos, scale } = useViewportStore.getState();
    const rect = svg.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
    const def = NODE_DEFINITIONS[type];

    mutations.addNode({
      id: crypto.randomUUID(),
      type,
      label: def.label,
      position: { x: canvasPos.x - 140, y: canvasPos.y - 40 },
      config: { ...def.defaultConfig } as WorkflowNode["config"],
    });
  }, [mutations]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Undo/redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedNodeId, selectedEdgeId } = useWorkflowStore.getState();
        if (selectedNodeId) {
          mutations.deleteNode(selectedNodeId);
          useWorkflowStore.getState().selectNode(null);
        } else if (selectedEdgeId) {
          mutations.deleteEdge(selectedEdgeId);
          useWorkflowStore.getState().selectEdge(null);
        }
      }

      if (e.key === "Escape") {
        useWorkflowStore.getState().selectNode(null);
        useWorkflowStore.getState().selectEdge(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mutations, undo, redo]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-white">
      {/* Left sidebar: Node palette */}
      <NodePalette />

      {/* Canvas area */}
      <div
        className="relative flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPointerMove={(e) => {
          const svg = svgRef.current;
          if (!svg) return;
          const { pos, scale } = useViewportStore.getState();
          const rect = svg.getBoundingClientRect();
          const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
          lastCursorRef.current = canvasPos;
          mutations.updateCursor(canvasPos.x, canvasPos.y);
        }}
      >
        <WorkflowTopbar
          workflowName={workflowName}
          onNameChange={(name) => {
            setWorkflowName(name);
            mutations.updateMeta({ name });
          }}
        />

        {/* Connection status */}
        <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
          <ConnectionBadge />
          {syncStatus === "synchronizing" && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Syncing...</span>
          )}
        </div>

        <WorkflowCanvas ref={canvasRef} workflowId={workflowId} onCanvasClick={handleCanvasClick}>
          <EdgeLayer />
          <ConnectionDraftLayer />
          <NodeLayer onPortPointerDown={handlePortPointerDown} />
        </WorkflowCanvas>

        <CursorsOverlay />

        <ZoomControls
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onReset={() => canvasRef.current?.resetZoom()}
        />
      </div>

      {/* Right sidebar: Config panel */}
      {selectedNodeId && <NodeConfigPanel mutations={mutations} />}
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
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
import { WorkflowOverlaysLayer } from "@/components/canvas/workflow-overlays-layer";
import { PlacementGhost } from "@/components/canvas/placement-ghost";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { NodeConfigPanel } from "@/components/sidebar/node-config-panel";
import { BoardTopbar } from "@/components/topbar/board-topbar";
import { NodePaletteSidebar } from "@/components/sidebar/node-palette-sidebar";
import { ZoomControls } from "@/components/canvas/zoom-controls";
import { CursorsOverlay } from "@/components/presence/cursors-overlay";
import { useNodeDrag } from "@/hooks/use-node-drag";
import { useConnectionDraw } from "@/hooks/use-connection-draw";
import { useMarqueeSelect } from "@/hooks/use-marquee-select";
import { useWorkflowDetection } from "@/hooks/use-workflow-detection";
import { useStreamPolling } from "@/hooks/use-stream-polling";
import { StreamErrorBanner } from "@/components/topbar/stream-error-banner";
import { StreamMetrics } from "@/components/topbar/stream-metrics";
import { DeliveryLogPanel } from "@/components/panels/delivery-log-panel";
import { useBoardStore } from "@/lib/store/board-store";
import { useViewportStore } from "@/lib/store/viewport-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { screenToCanvas } from "@/lib/canvas-utils";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { client, buildInitialStorage, buildInitialStorageFromSnapshot } from "@/lib/sync/client";
import { useLivelySync } from "@/lib/sync/use-lively-sync";
import { useWorkflowMutations } from "@/lib/sync/use-workflow-mutations";
import { DEFAULT_BOARD } from "@/lib/workflow/templates";
import { loadSnapshot } from "@/lib/persistence/indexeddb";
import { usePersistStorage } from "@/lib/persistence/use-persist-storage";
import { getWorkflowBBox } from "@/lib/workflow/bounding-box";
import { UNASSIGNED_WORKFLOW_ID } from "@/types/workflow";
import type { WorkflowNode, WorkflowNodeType } from "@/types/workflow";

export default function WorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params.id as string;
  const { userId, displayName, restore } = useAuthStore();
  const [resolvedStorage, setResolvedStorage] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { restore(); }, [restore]);

  // Redirect to dashboard if no identity (user hasn't joined yet)
  useEffect(() => {
    if (!userId) {
      const stored = sessionStorage.getItem("wf-userId");
      if (!stored) router.replace("/");
    }
  }, [userId, router]);

  // Async-load cached snapshot from IndexedDB before mounting RoomProvider
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await loadSnapshot(boardId);
        if (!cancelled && cached) {
          setResolvedStorage(buildInitialStorageFromSnapshot(cached));
          return;
        }
      } catch {
        // Fall through to default
      }
      if (!cancelled) {
        setResolvedStorage(buildInitialStorage(DEFAULT_BOARD, boardId));
      }
    })();
    return () => { cancelled = true; };
  }, [boardId]);

  if (!userId || !resolvedStorage) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <LivelyProvider client={client}>
      <RoomProvider
        roomId={boardId}
        userId={userId}
        displayName={displayName}
        initialStorage={resolvedStorage}
        location="workflow"
      >
        <WorkflowPageInner boardId={boardId} />
      </RoomProvider>
    </LivelyProvider>
  );
}

function WorkflowPageInner({ boardId }: { boardId: string }) {
  const canvasRef = useRef<CanvasHandle>(null);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  const selectNode = useBoardStore((s) => s.selectNode);
  const selectEdge = useBoardStore((s) => s.selectEdge);
  const openConfig = useBoardStore((s) => s.openConfig);
  const configNodeId = useBoardStore((s) => s.configNodeId);
  const [deliveryLogOpen, setDeliveryLogOpen] = useState(false);

  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  // --- Lively sync ---
  useLivelySync();
  usePersistStorage(boardId);
  const mutations = useWorkflowMutations();

  // --- Auto-detect workflows from connected chains ---
  useWorkflowDetection(mutations, boardId);
  useStreamPolling(mutations);

  // --- Pan to workflow ---
  const panToWorkflow = useCallback((wfId: string) => {
    const state = useBoardStore.getState();
    const nodes = state.getWorkflowNodes(wfId);
    console.log("[panToWorkflow]", { wfId, nodeCount: nodes.length, nodeIds: nodes.map(n => n.id) });
    if (nodes.length === 0) {
      console.warn("[panToWorkflow] no nodes assigned to workflow", wfId);
      return;
    }
    const bbox = getWorkflowBBox(nodes);
    console.log("[panToWorkflow] bbox", bbox);
    canvasRef.current?.panToWorkflow(bbox);
    state.selectWorkflow(wfId);
  }, []);

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

  // --- SVG element: state-based so hooks re-run when available ---
  useEffect(() => {
    const el = canvasRef.current?.getSvgElement();
    if (el) { setSvgElement(el); return; }
    const interval = setInterval(() => {
      const el = canvasRef.current?.getSvgElement();
      if (el) {
        setSvgElement(el);
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // --- Hooks that mutate via Lively ---
  useNodeDrag(svgElement, mutations);
  const { handlePortPointerDown } = useConnectionDraw(svgElement, mutations);
  const { didJustMarquee } = useMarqueeSelect(svgElement);

  const handleCanvasClick = useCallback((canvasX: number, canvasY: number) => {
    // Skip clearing if a marquee selection just finished
    if (didJustMarquee()) return;

    const pm = useCanvasInteractionStore.getState().placementMode;
    if (pm) {
      // Create node at click position
      const def = NODE_DEFINITIONS[pm.nodeType];
      const config = { ...def.defaultConfig } as WorkflowNode["config"];
      mutations.addNode({
        id: crypto.randomUUID(),
        type: pm.nodeType,
        label: def.label,
        position: { x: canvasX - 140, y: canvasY - 40 },
        config,
        workflowId: pm.workflowId ?? UNASSIGNED_WORKFLOW_ID,
      });
      useCanvasInteractionStore.getState().clearPlacementMode();
      return;
    }
    selectNode(null);
    selectEdge(null);
    openConfig(null);
    useBoardStore.getState().clearSelection();
  }, [selectNode, selectEdge, openConfig, mutations, boardId, didJustMarquee]);

  // Drop from palette → create node via Lively mutation
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("text/plain") as WorkflowNodeType;
    if (!type || !NODE_DEFINITIONS[type]) return;

    const svg = svgElement;
    if (!svg) return;
    const { pos, scale } = useViewportStore.getState();
    const rect = svg.getBoundingClientRect();
    const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
    const def = NODE_DEFINITIONS[type];

    const config = { ...def.defaultConfig } as WorkflowNode["config"];

    mutations.addNode({
      id: crypto.randomUUID(),
      type,
      label: def.label,
      position: { x: canvasPos.x - 140, y: canvasPos.y - 40 },
      config,
      workflowId: UNASSIGNED_WORKFLOW_ID,
    });
  }, [mutations, svgElement]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Zoom: Cmd/Ctrl + / - / 0
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); canvasRef.current?.zoomIn(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); canvasRef.current?.zoomOut(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") { e.preventDefault(); canvasRef.current?.resetZoom(); return; }

      // Undo/redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); return; }

      // Cycle workflows with [ and ]
      if (e.key === "[" || e.key === "]") {
        const ids = Array.from(useBoardStore.getState().workflows.keys());
        if (ids.length === 0) return;
        const currentId = useBoardStore.getState().selectedWorkflowId;
        const currentIdx = currentId ? ids.indexOf(currentId) : -1;
        const delta = e.key === "]" ? 1 : -1;
        const nextIdx = currentIdx === -1
          ? (delta === 1 ? 0 : ids.length - 1)
          : (currentIdx + delta + ids.length) % ids.length;
        panToWorkflow(ids[nextIdx]);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedNodeIds, selectedNodeId, selectedEdgeId } = useBoardStore.getState();
        if (selectedNodeIds.size > 0) {
          for (const id of selectedNodeIds) {
            mutations.deleteNode(id);
          }
          useBoardStore.getState().clearSelection();
        } else if (selectedNodeId) {
          mutations.deleteNode(selectedNodeId);
          useBoardStore.getState().selectNode(null);
        } else if (selectedEdgeId) {
          mutations.deleteEdge(selectedEdgeId);
          useBoardStore.getState().selectEdge(null);
        }
      }

      if (e.key === "Escape") {
        if (useCanvasInteractionStore.getState().placementMode) {
          useCanvasInteractionStore.getState().clearPlacementMode();
          return;
        }
        useBoardStore.getState().selectNode(null);
        useBoardStore.getState().selectEdge(null);
        useBoardStore.getState().openConfig(null);
        useBoardStore.getState().clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mutations, undo, redo, panToWorkflow]);

  return (
    <div className="relative flex h-screen w-screen select-none overflow-hidden bg-white">
      {/* Left sidebar: Node palette */}
      <NodePaletteSidebar />

      {/* Canvas area */}
      <div
        className="relative flex-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPointerMove={(e) => {
          const svg = svgElement;
          if (!svg) return;
          const { pos, scale } = useViewportStore.getState();
          const rect = svg.getBoundingClientRect();
          const canvasPos = screenToCanvas(e.clientX, e.clientY, rect, pos, scale);
          lastCursorRef.current = canvasPos;
          mutations.updateCursor(canvasPos.x, canvasPos.y);
        }}
      >
        <BoardTopbar mutations={mutations} onPanToWorkflow={panToWorkflow} />

        <StreamErrorBanner mutations={mutations} />

        {/* Connection status */}
        <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
          <ConnectionBadge />
          {syncStatus === "synchronizing" && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Syncing...</span>
          )}
        </div>

        <WorkflowCanvas ref={canvasRef} workflowId={boardId} onCanvasClick={handleCanvasClick}>
          <WorkflowOverlaysLayer mutations={mutations} boardId={boardId} />
          <EdgeLayer />
          <ConnectionDraftLayer />
          <NodeLayer onPortPointerDown={handlePortPointerDown} />
          <PlacementGhost svgElement={svgElement} />
        </WorkflowCanvas>

        <CursorsOverlay />

        <ZoomControls
          onZoomIn={() => canvasRef.current?.zoomIn()}
          onZoomOut={() => canvasRef.current?.zoomOut()}
          onReset={() => canvasRef.current?.resetZoom()}
        />

        <div className="absolute bottom-4 right-4 z-30">
          <StreamMetrics onBadgeClick={(wfId) => {
            useBoardStore.getState().selectWorkflow(wfId);
            setDeliveryLogOpen(true);
          }} />
        </div>
      </div>

      {/* Right sidebar: Config panel or Delivery log */}
      {deliveryLogOpen ? (
        <DeliveryLogPanel onClose={() => setDeliveryLogOpen(false)} />
      ) : configNodeId ? (
        <NodeConfigPanel mutations={mutations} workflowId={boardId} />
      ) : null}
    </div>
  );
}

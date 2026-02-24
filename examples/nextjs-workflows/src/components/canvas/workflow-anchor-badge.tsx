"use client";

import { useState, useRef, useEffect } from "react";
import { Circle, Rocket, Pause, Play, RefreshCw, MoreHorizontal, Trash2, Pencil, Loader2, Zap, Rewind } from "lucide-react";
import { useBoardStore } from "@/lib/store/board-store";
import { useStreamDeploy } from "@/hooks/use-stream-deploy";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";
import type { StreamStatus } from "@/types/workflow";
import type { BBox } from "@/lib/workflow/bounding-box";

// Match mock-d: badge sits inside region with breathing room
// Region PADDING=40 is applied by region-tint. Badge is at minY - pad - badgeH + 2.
const REGION_PAD = 40;
const BADGE_SPACE = 56; // vertical space reserved for badge area

const STATUS_CONFIG: Record<StreamStatus, { fill: string; label: string }> = {
  draft: { fill: "#9ca3af", label: "Draft" },
  deploying: { fill: "#ca8a04", label: "Deploying" },
  active: { fill: "#16a34a", label: "Active" },
  paused: { fill: "#d97706", label: "Paused" },
  failed: { fill: "#dc2626", label: "Failed" },
};

interface WorkflowAnchorBadgeProps {
  wfId: string;
  bbox: BBox;
  triggerX: number;
  mutations: WorkflowMutationsApi;
  boardId: string;
}

export function WorkflowAnchorBadge({ wfId, bbox, triggerX, mutations, boardId }: WorkflowAnchorBadgeProps) {
  const wf = useBoardStore((s) => s.workflows.get(wfId));
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const { deploy, enable, disable, remove, trigger, replay, deploying } = useStreamDeploy(mutations, wfId);
  const [triggerPanel, setTriggerPanel] = useState<"trigger" | "replay" | null>(null);
  const [blockHeight, setBlockHeight] = useState("");
  const [fromBlock, setFromBlock] = useState("");
  const [toBlock, setToBlock] = useState("");
  const [triggerBusy, setTriggerBusy] = useState(false);
  const [triggerFeedback, setTriggerFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTriggerPanel(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!wf) return null;

  const status = wf.stream.status;
  const cfg = STATUS_CONFIG[status];
  const badgeX = triggerX;
  const badgeY = bbox.y - REGION_PAD - BADGE_SPACE + 2;

  const handleTrigger = async () => {
    const height = parseInt(blockHeight);
    if (!height) return;
    setTriggerBusy(true);
    setTriggerFeedback(null);
    try {
      await trigger(height);
      setTriggerFeedback("Triggered");
      setBlockHeight("");
      setTimeout(() => setTriggerFeedback(null), 1500);
    } catch (err) {
      setTriggerFeedback(err instanceof Error ? err.message : "Failed");
    } finally {
      setTriggerBusy(false);
    }
  };

  const handleReplay = async () => {
    const from = parseInt(fromBlock);
    const to = parseInt(toBlock);
    if (!from || !to || to < from) return;
    setTriggerBusy(true);
    setTriggerFeedback(null);
    try {
      await replay(from, to);
      setTriggerFeedback(`Replaying ${to - from + 1} blocks`);
      setFromBlock("");
      setToBlock("");
      setTimeout(() => setTriggerFeedback(null), 2000);
    } catch (err) {
      setTriggerFeedback(err instanceof Error ? err.message : "Failed");
    } finally {
      setTriggerBusy(false);
    }
  };

  const handleDelete = () => {
    if (status === "draft") {
      // Draft: just unlink — remove workflow record, keep nodes
      mutations.unlinkWorkflow(wfId);
    } else {
      // Non-draft: full cascade delete (tear down stream + remove nodes/edges)
      mutations.deleteWorkflow(wfId);
    }
    setMenuOpen(false);
  };

  return (
    <foreignObject
      x={badgeX}
      y={badgeY}
      width={500}
      height={BADGE_SPACE}
      style={{ overflow: "visible" }}
    >
      <div className="flex items-center gap-1.5 rounded-lg border bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur" style={{ borderColor: "#e5e7eb", width: "fit-content" }}>
        {/* Name */}
        {renaming ? (
          <input
            autoFocus
            className="bg-transparent text-xs font-medium text-gray-900 outline-none w-28"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              if (draftName.trim()) mutations.updateWorkflow(wfId, { name: draftName.trim() });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span
            className="text-xs font-medium text-gray-900 truncate max-w-[120px] cursor-text"
            onDoubleClick={() => { setDraftName(wf.name); setRenaming(true); }}
          >{wf.name}</span>
        )}

        <div className="h-3 w-px bg-gray-200" />

        {/* Status pill */}
        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
          <Circle size={5} fill={cfg.fill} stroke="none" />
          {cfg.label}
        </span>

        {/* Stats */}
        {wf.stream.totalDeliveries > 0 && (
          <>
            <div className="h-3 w-px bg-gray-200" />
            <span className="text-[10px] text-gray-500">
              {wf.stream.totalDeliveries} delivered
            </span>
          </>
        )}

        <div className="h-3 w-px bg-gray-200" />

        {/* Action buttons */}
        {status === "draft" && (
          <button
            onClick={() => deploy()}
            disabled={deploying}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {deploying ? <Loader2 size={10} className="animate-spin" /> : <Rocket size={10} />}
            Deploy
          </button>
        )}
        {status === "active" && (
          <button
            onClick={() => disable()}
            className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200"
          >
            <Pause size={10} />
            Pause
          </button>
        )}
        {status === "paused" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => enable()}
              className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700"
            >
              <Play size={10} />
              Resume
            </button>
            <button
              onClick={() => deploy()}
              disabled={deploying}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {deploying ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Re-deploy
            </button>
          </div>
        )}
        {status === "failed" && (
          <button
            onClick={() => deploy()}
            disabled={deploying}
            className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deploying ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            Retry
          </button>
        )}
        {status === "deploying" && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Loader2 size={10} className="animate-spin" />
            Deploying...
          </span>
        )}

        {/* Overflow menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <MoreHorizontal size={12} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 rounded-lg border bg-white py-1 shadow-lg" style={{ borderColor: "#e5e7eb", width: triggerPanel ? 220 : 144 }}>
              <button
                onClick={() => {
                  setDraftName(wf.name);
                  setRenaming(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={11} /> Rename
              </button>
              {status === "active" && (
                <>
                  <button
                    onClick={() => { deploy(); setMenuOpen(false); }}
                    disabled={deploying}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw size={11} /> Re-deploy
                  </button>
                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    onClick={() => setTriggerPanel(triggerPanel === "trigger" ? null : "trigger")}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${triggerPanel === "trigger" ? "text-blue-700 bg-blue-50" : "text-gray-700"}`}
                  >
                    <Zap size={11} /> Trigger Block
                  </button>
                  <button
                    onClick={() => setTriggerPanel(triggerPanel === "replay" ? null : "replay")}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${triggerPanel === "replay" ? "text-blue-700 bg-blue-50" : "text-gray-700"}`}
                  >
                    <Rewind size={11} /> Replay Range
                  </button>
                  {triggerPanel === "trigger" && (
                    <div className="border-t px-3 py-2" style={{ borderColor: "#e5e7eb" }}>
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          type="number"
                          value={blockHeight}
                          onChange={(e) => setBlockHeight(e.target.value)}
                          placeholder="Block height"
                          className="flex-1 rounded-md border bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-blue-500"
                          style={{ borderColor: "#e5e7eb" }}
                          onKeyDown={(e) => e.key === "Enter" && handleTrigger()}
                        />
                        <button
                          onClick={handleTrigger}
                          disabled={triggerBusy || !blockHeight}
                          className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Run
                        </button>
                      </div>
                      {triggerFeedback && (
                        <p className={`mt-1 text-[11px] ${triggerFeedback.startsWith("Failed") || triggerFeedback.startsWith("HTTP") ? "text-red-500" : "text-green-600"}`}>
                          {triggerFeedback}
                        </p>
                      )}
                    </div>
                  )}
                  {triggerPanel === "replay" && (
                    <div className="border-t px-3 py-2" style={{ borderColor: "#e5e7eb" }}>
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          type="number"
                          value={fromBlock}
                          onChange={(e) => setFromBlock(e.target.value)}
                          placeholder="From"
                          className="w-[70px] rounded-md border bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-blue-500"
                          style={{ borderColor: "#e5e7eb" }}
                        />
                        <input
                          type="number"
                          value={toBlock}
                          onChange={(e) => setToBlock(e.target.value)}
                          placeholder="To"
                          className="w-[70px] rounded-md border bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-blue-500"
                          style={{ borderColor: "#e5e7eb" }}
                          onKeyDown={(e) => e.key === "Enter" && handleReplay()}
                        />
                        <button
                          onClick={handleReplay}
                          disabled={triggerBusy || !fromBlock || !toBlock}
                          className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Run
                        </button>
                      </div>
                      {triggerFeedback && (
                        <p className={`mt-1 text-[11px] ${triggerFeedback.startsWith("Failed") || triggerFeedback.startsWith("HTTP") ? "text-red-500" : "text-green-600"}`}>
                          {triggerFeedback}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={11} /> {status === "draft" ? "Remove" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
}

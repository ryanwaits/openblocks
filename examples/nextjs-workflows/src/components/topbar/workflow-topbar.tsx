"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Circle, ChevronDown, Play, Pause, Trash2, Rocket, Loader2 } from "lucide-react";
import { useWorkflowStore, type StreamStatus } from "@/lib/store/workflow-store";

const STATUS_CONFIG: Record<StreamStatus, { color: string; fill: string; label: string }> = {
  draft: { color: "text-gray-500", fill: "#9ca3af", label: "Draft" },
  deploying: { color: "text-yellow-600", fill: "#ca8a04", label: "Deploying" },
  active: { color: "text-green-600", fill: "#16a34a", label: "Active" },
  paused: { color: "text-amber-600", fill: "#d97706", label: "Paused" },
  failed: { color: "text-red-600", fill: "#dc2626", label: "Failed" },
};

interface WorkflowTopbarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
  onDeploy: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onDelete: () => void;
  deploying: boolean;
}

export function WorkflowTopbar({
  workflowName, onNameChange,
  onDeploy, onEnable, onDisable, onDelete,
  deploying,
}: WorkflowTopbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workflowName);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const streamStatus = useWorkflowStore((s) => s.stream.status);
  const streamId = useWorkflowStore((s) => s.stream.streamId);
  const statusCfg = STATUS_CONFIG[streamStatus];

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft.trim()) onNameChange(draft.trim());
  }, [draft, onNameChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === "Escape") {
        setDraft(workflowName);
        setEditing(false);
      }
    },
    [workflowName],
  );

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-white/90 px-3 py-2 shadow-sm backdrop-blur" style={{ borderColor: "#e5e7eb" }}>
      <Link href="/" className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
        <ChevronLeft size={16} />
      </Link>
      <div className="h-4 w-px bg-gray-200" />

      {/* Editable name */}
      {editing ? (
        <input
          autoFocus
          className="bg-transparent text-sm font-medium text-gray-900 outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <button
          className="text-sm font-medium text-gray-900 hover:text-gray-600"
          onClick={() => { setDraft(workflowName); setEditing(true); }}
        >
          {workflowName}
        </button>
      )}

      <div className="h-4 w-px bg-gray-200" />

      {/* Status badge */}
      <span className={`flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium ${statusCfg.color}`}>
        <Circle size={6} fill={statusCfg.fill} stroke="none" />
        {statusCfg.label}
      </span>

      <div className="h-4 w-px bg-gray-200" />

      {/* Deploy button */}
      <button
        onClick={onDeploy}
        disabled={deploying}
        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {deploying ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Rocket size={13} />
        )}
        {streamId ? "Re-deploy" : "Deploy"}
      </button>

      {/* Dropdown menu for lifecycle controls */}
      {streamId && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-white py-1 shadow-lg" style={{ borderColor: "#e5e7eb" }}>
              {streamStatus === "active" ? (
                <button
                  onClick={() => { onDisable(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Pause size={13} /> Pause Stream
                </button>
              ) : (streamStatus === "paused" || streamStatus === "failed") ? (
                <button
                  onClick={() => { onEnable(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Play size={13} /> Enable Stream
                </button>
              ) : null}
              <button
                onClick={() => { onDelete(); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} /> Delete Stream
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Circle } from "lucide-react";
import { useBoardStore } from "@/lib/store/board-store";
import type { WorkflowMutationsApi } from "@/lib/sync/mutations-context";
import type { StreamStatus } from "@/types/workflow";

const STATUS_CONFIG: Record<StreamStatus, { fill: string; label: string }> = {
  draft: { fill: "#9ca3af", label: "Draft" },
  deploying: { fill: "#ca8a04", label: "Deploying" },
  active: { fill: "#16a34a", label: "Active" },
  paused: { fill: "#d97706", label: "Paused" },
  failed: { fill: "#dc2626", label: "Failed" },
};

interface BoardTopbarProps {
  mutations: WorkflowMutationsApi;
  onPanToWorkflow?: (wfId: string) => void;
}

export function BoardTopbar({ mutations, onPanToWorkflow }: BoardTopbarProps) {
  const boardName = useBoardStore((s) => s.boardMeta.name);
  const workflowCount = useBoardStore((s) => s.workflows.size);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(boardName);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft.trim()) mutations.updateBoardMeta({ name: draft.trim() });
  }, [draft, mutations]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        (e.target as HTMLInputElement).blur();
      }
      if (e.key === "Escape") {
        setDraft(boardName);
        setEditing(false);
      }
    },
    [boardName],
  );

  return (
    <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-white/90 px-3 py-2 shadow-sm backdrop-blur" style={{ borderColor: "#e5e7eb" }}>
      <Link href="/" className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
        <ChevronLeft size={16} />
      </Link>
      <div className="h-4 w-px bg-gray-200" />

      {/* Editable board name */}
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
          onClick={() => { setDraft(boardName); setEditing(true); }}
        >
          {boardName}
        </button>
      )}

      {/* Desktop: workflow dropdown + dividers */}
      <div className="hidden lg:contents">
        <WorkflowSection onPanToWorkflow={onPanToWorkflow} />
      </div>

      {/* Mobile: workflow dropdown (hidden when empty) */}
      {workflowCount > 0 && <MobileDropdown onPanToWorkflow={onPanToWorkflow} />}
    </div>
  );
}

function WorkflowSection({ onPanToWorkflow }: { onPanToWorkflow?: (wfId: string) => void }) {
  const workflowCount = useBoardStore((s) => s.workflows.size);
  const [visible, setVisible] = useState(workflowCount > 0);
  const [mounted, setMounted] = useState(workflowCount > 0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (workflowCount > 0) {
      setMounted(true);
      setAnimating(true);
      requestAnimationFrame(() => setVisible(true));
      const timer = setTimeout(() => setAnimating(false), 200);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setAnimating(true);
      const timer = setTimeout(() => { setMounted(false); setAnimating(false); }, 200);
      return () => clearTimeout(timer);
    }
  }, [workflowCount]);

  if (!mounted) return null;

  return (
    <div
      className={`flex items-center gap-2 transition-all duration-200 ease-out ${animating ? "overflow-hidden" : ""}`}
      style={{
        maxWidth: visible ? 200 : 0,
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="h-4 w-px shrink-0 bg-gray-200" />
      <WorkflowDropdown onPanToWorkflow={onPanToWorkflow} />
      <div className="h-4 w-px shrink-0 bg-gray-200" />
    </div>
  );
}

function WorkflowDropdown({ onPanToWorkflow }: { onPanToWorkflow?: (wfId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const workflows = useBoardStore((s) => s.workflows);
  const selectedWorkflowId = useBoardStore((s) => s.selectedWorkflowId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const wfEntries = Array.from(workflows.entries());

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
      >
        {workflows.size} workflow{workflows.size !== 1 ? "s" : ""}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg" style={{ borderColor: "#e5e7eb" }}>
          {wfEntries.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400">No workflows</div>
          ) : (
            wfEntries.map(([id, wf]) => {
              const cfg = STATUS_CONFIG[wf.stream.status];
              const isSelected = id === selectedWorkflowId;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onPanToWorkflow?.(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${isSelected ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"}`}
                >
                  <Circle size={6} fill={cfg.fill} stroke="none" className="shrink-0" />
                  <span className="truncate">{wf.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MobileDropdown({ onPanToWorkflow }: { onPanToWorkflow?: (wfId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const workflows = useBoardStore((s) => s.workflows);
  const selectedWorkflowId = useBoardStore((s) => s.selectedWorkflowId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const wfEntries = Array.from(workflows.entries());

  return (
    <div className="relative lg:hidden" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg" style={{ borderColor: "#e5e7eb" }}>
          {wfEntries.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-gray-400">No workflows</div>
          ) : (
            wfEntries.map(([id, wf]) => {
              const cfg = STATUS_CONFIG[wf.stream.status];
              const isSelected = id === selectedWorkflowId;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onPanToWorkflow?.(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-50 ${isSelected ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"}`}
                >
                  <Circle size={6} fill={cfg.fill} stroke="none" className="shrink-0" />
                  <span className="truncate">{wf.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

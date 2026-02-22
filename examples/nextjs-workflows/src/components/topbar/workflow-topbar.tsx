"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, Circle } from "lucide-react";

interface WorkflowTopbarProps {
  workflowName: string;
  onNameChange: (name: string) => void;
}

export function WorkflowTopbar({ workflowName, onNameChange }: WorkflowTopbarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workflowName);

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

  return (
    <div className="absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-white/90 px-3 py-2 shadow-sm backdrop-blur" style={{ borderColor: "#e5e7eb" }}>
      <button className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
        <ChevronLeft size={16} />
      </button>
      <div className="h-4 w-px bg-gray-200" />
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
      <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
        <Circle size={6} fill="#9ca3af" stroke="none" />
        Draft
      </span>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Plus, Trash2, Pencil } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { Frame } from "@/types/board";

interface FrameSwitcherProps {
  frames: Frame[];
  activeFrameIndex: number;
  onSwitch: (frameIndex: number) => void;
  onCreate: () => void;
  onDelete: (frameId: string) => void;
  onRename: (frameId: string, newLabel: string) => void;
}

export function FrameSwitcher({
  frames,
  activeFrameIndex,
  onSwitch,
  onCreate,
  onDelete,
  onRename,
}: FrameSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeFrame = frames.find((f) => f.index === activeFrameIndex);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onRename]);

  return (
    <div className="absolute left-4 top-4 z-40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm border border-gray-200 transition-colors hover:bg-gray-50">
            {activeFrame?.label || "Frame"}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="w-56 p-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-0.5">
            {frames.map((frame) => (
              <div
                key={frame.id}
                className={`group flex items-center rounded-md px-2 py-1.5 text-sm transition-colors ${
                  frame.index === activeFrameIndex
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 cursor-pointer"
                }`}
                onClick={() => {
                  if (editingId === frame.id || confirmDeleteId === frame.id) return;
                  onSwitch(frame.index);
                  setOpen(false);
                }}
              >
                {confirmDeleteId === frame.id ? (
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs text-red-600">Delete frame?</span>
                    <div className="flex gap-1">
                      <button
                        className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      >
                        No
                      </button>
                      <button
                        className="rounded bg-red-500 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(frame.id);
                          setConfirmDeleteId(null);
                        }}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                ) : editingId === frame.id ? (
                  <input
                    ref={inputRef}
                    className="w-full rounded bg-white px-1 py-0.5 text-sm outline-none ring-1 ring-blue-300"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="flex-1 truncate">
                      {frame.label}
                    </span>
                    <div className="ml-1 flex gap-0.5 opacity-0 transition-all group-hover:opacity-100">
                      <button
                        className="rounded p-0.5 text-gray-400 hover:text-blue-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(frame.id);
                          setEditValue(frame.label);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {frames.length > 1 && (
                        <button
                          className="rounded p-0.5 text-gray-400 hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(frame.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Frame
            </button>
            {frames.length > 1 && (
              <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-gray-100 px-2 pt-1.5 pb-0.5 text-[11px] text-gray-400">
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 font-mono text-[10px] text-gray-400">[</span>
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 font-mono text-[10px] text-gray-400">]</span>
                <span>to navigate</span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

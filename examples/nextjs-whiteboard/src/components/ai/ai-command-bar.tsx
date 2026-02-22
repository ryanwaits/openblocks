"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  X,
  GripHorizontal,
  Check,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

type Status = "idle" | "loading" | "success" | "warning" | "error";

interface AICommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  userId: string;
  displayName: string;
  selectedIds?: Set<string>;
  activeFrameId?: string;
  onFrameCreated?: (frameIndex: number) => void;
  onObjectsAffected?: (bounds: { x: number; y: number; width: number; height: number }[]) => void;
}

export function AICommandBar({
  isOpen,
  onClose,
  boardId,
  userId,
  displayName,
  selectedIds,
  activeFrameId,
  onFrameCreated,
  onObjectsAffected,
}: AICommandBarProps) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const posStorageKey = `ai-cmd-pos:${boardId}`;
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = localStorage.getItem(posStorageKey);
        return stored
          ? (JSON.parse(stored) as { left: number; bottom: number })
          : null;
      } catch {
        return null;
      }
    }
  );
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, left: 0, bottom: 0 });

  // Persist position to localStorage
  useEffect(() => {
    if (!pos || isDragging) return;
    try {
      localStorage.setItem(posStorageKey, JSON.stringify(pos));
    } catch {
      // storage full or unavailable
    }
  }, [pos, isDragging, posStorageKey]);

  // Clamp position within viewport
  const clampPos = useCallback(
    (left: number, bottom: number) => ({
      left: Math.max(0, Math.min(left, window.innerWidth - 380)),
      bottom: Math.max(0, Math.min(bottom, window.innerHeight - 100)),
    }),
    []
  );

  // Initialize position centered, or clamp stored position
  useEffect(() => {
    if (!isOpen) return;
    if (!pos) {
      setPos(clampPos((window.innerWidth - 380) / 2, 80));
    } else {
      setPos(clampPos(pos.left, pos.bottom));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Focus input when opened or done loading
  useEffect(() => {
    if (isOpen && status !== "loading") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, status]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Re-clamp on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => (prev ? clampPos(prev.left, prev.bottom) : prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPos]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        left: pos?.left || 0,
        bottom: pos?.bottom || 80,
      };
    },
    [pos]
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPos(
        clampPos(
          dragStartRef.current.left + dx,
          dragStartRef.current.bottom - dy
        )
      );
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, clampPos]);

  // Flash status then auto-reset
  const flashStatus = useCallback((s: Status) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatus(s);
    statusTimeoutRef.current = setTimeout(() => {
      setStatus("idle");
      statusTimeoutRef.current = null;
    }, 2000);
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || status === "loading") return;

    // Clear previous flash
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatus("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          boardId,
          userId,
          displayName,
          selectedIds: selectedIds ? Array.from(selectedIds) : undefined,
          activeFrameId,
        }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        flashStatus("error");
      } else if (data.objectsCreated > 0 || data.objectsModified > 0) {
        flashStatus("success");
        setInput("");
        if (data.newFrameIndex != null && onFrameCreated) {
          onFrameCreated(data.newFrameIndex);
        } else if (data.affectedBounds?.length > 0 && onObjectsAffected) {
          onObjectsAffected(data.affectedBounds);
        }
      } else {
        flashStatus("warning");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        // User aborted — reset immediately, no flash
        setStatus("idle");
      } else {
        flashStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [
    input,
    status,
    boardId,
    userId,
    displayName,
    selectedIds,
    activeFrameId,
    onFrameCreated,
    onObjectsAffected,
    flashStatus,
  ]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!isOpen || !pos) return null;

  // Status-driven styles
  const borderClass: Record<Status, string> = {
    idle: "border-slate-200/80 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]",
    loading:
      "border-indigo-100 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] ring-2 ring-indigo-50",
    success:
      "border-green-400 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] ring-2 ring-green-100",
    warning:
      "border-yellow-400 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] ring-2 ring-yellow-100",
    error:
      "border-red-400 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] ring-2 ring-red-100",
  };

  const buttonClass: Record<Status, string> = {
    idle: input.trim()
      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 hover:bg-blue-600 active:scale-95"
      : "cursor-not-allowed bg-blue-200/80 text-white",
    loading:
      "bg-indigo-50 text-indigo-500 hover:scale-105 hover:bg-indigo-100 active:scale-95",
    success:
      "ring-2 ring-green-500 bg-green-50 text-green-600",
    warning:
      "ring-2 ring-yellow-500 bg-yellow-50 text-yellow-600",
    error:
      "ring-2 ring-red-500 bg-red-50 text-red-600",
  };

  // Icon to render inside button
  const renderIcon = () => {
    // During flash states, show status icon with same morph animation
    if (status === "success") {
      return (
        <div
          className="absolute transition-all duration-300"
          style={{ transform: "scale(1) rotate(0deg)", opacity: 1 }}
        >
          <Check className="h-4 w-4" />
        </div>
      );
    }
    if (status === "warning") {
      return (
        <div
          className="absolute transition-all duration-300"
          style={{ transform: "scale(1) rotate(0deg)", opacity: 1 }}
        >
          <AlertTriangle className="h-4 w-4" />
        </div>
      );
    }
    if (status === "error") {
      return (
        <div
          className="absolute transition-all duration-300"
          style={{ transform: "scale(1) rotate(0deg)", opacity: 1 }}
        >
          <AlertCircle className="h-4 w-4" />
        </div>
      );
    }

    // Default: Send / Stop morph
    const isLoading = status === "loading";
    return (
      <>
        <div
          className="absolute transition-all duration-300"
          style={{
            transform: isLoading
              ? "scale(0) rotate(90deg)"
              : "scale(1) rotate(0deg)",
            opacity: isLoading ? 0 : 1,
          }}
        >
          <Send className="ml-0.5 h-4 w-4" />
        </div>
        <div
          className={`absolute transition-all duration-300 ${isLoading ? "animate-pulse" : ""}`}
          style={{
            transform: !isLoading
              ? "scale(0) rotate(-90deg)"
              : "scale(1) rotate(0deg)",
            opacity: !isLoading ? 0 : 1,
          }}
        >
          <Square className="h-4 w-4 fill-current" />
        </div>
      </>
    );
  };

  const isFlash = status === "success" || status === "warning" || status === "error";

  return (
    <div
      className="fixed z-[60] flex w-[380px] flex-col"
      style={{
        left: pos.left,
        bottom: pos.bottom,
        transition: isDragging ? "none" : undefined,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Drag handle + close */}
      <div className="mb-0.5 flex items-center justify-center gap-1.5">
        <button
          onClick={onClose}
          className="rounded-full p-0.5 text-slate-300 transition-colors hover:bg-white/80 hover:text-slate-500"
        >
          <X className="h-3 w-3" />
        </button>
        <div
          className="flex cursor-grab items-center justify-center rounded-full px-2 py-0.5 transition-colors hover:bg-white/60 active:cursor-grabbing"
          onMouseDown={handleDragStart}
        >
          <GripHorizontal className="h-3.5 w-3.5 text-slate-300" />
        </div>
      </div>

      {/* Input bar */}
      <div
        className={`relative rounded-2xl border bg-white transition-all duration-300 ${borderClass[status]}`}
      >
        <div className="flex items-center gap-1.5 p-1.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status === "loading"}
              placeholder={
                status === "loading"
                  ? "AI is working..."
                  : "Ask AI to modify the board..."
              }
              className="h-9 w-full rounded-lg bg-slate-50 pl-3 pr-3 text-[13px] font-medium text-slate-700 placeholder-slate-400 transition-all duration-200 focus:bg-slate-100 focus:outline-none disabled:bg-white disabled:text-slate-400"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  status !== "loading" &&
                  input.trim()
                ) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {/* Shimmer overlay */}
            {status === "loading" && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg opacity-50">
                <div className="ai-loading-shimmer h-full w-full" />
              </div>
            )}
          </div>

          {/* Send / Stop / Status button */}
          <button
            onClick={
              status === "loading"
                ? handleStop
                : isFlash
                  ? undefined
                  : handleSubmit
            }
            disabled={(!input.trim() && status === "idle") || isFlash}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${buttonClass[status]}`}
            style={{
              transitionTimingFunction:
                "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {renderIcon()}
          </button>
        </div>
      </div>

    </div>
  );
}

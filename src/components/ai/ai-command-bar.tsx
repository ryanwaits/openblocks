"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Sparkles, X, GripHorizontal } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AICommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  userId: string;
  displayName: string;
  selectedIds?: Set<string>;
}

export function AICommandBar({
  isOpen,
  onClose,
  boardId,
  userId,
  displayName,
  selectedIds,
}: AICommandBarProps) {
  const storageKey = `ai-chat:${boardId}`;
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? (JSON.parse(stored) as Message[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const posStorageKey = `ai-cmd-pos:${boardId}`;
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(posStorageKey);
      return stored ? (JSON.parse(stored) as { left: number; bottom: number }) : null;
    } catch {
      return null;
    }
  });
  const [isDragging, setIsDragging] = useState(false);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // storage full or unavailable
    }
  }, [messages, storageKey]);

  // Persist position to localStorage
  useEffect(() => {
    if (!pos || isDragging) return;
    try {
      localStorage.setItem(posStorageKey, JSON.stringify(pos));
    } catch {
      // storage full or unavailable
    }
  }, [pos, isDragging, posStorageKey]);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, left: 0, bottom: 0 });

  // Initialize position centered above sidebar
  useEffect(() => {
    if (isOpen && !pos) {
      setPos({
        left: Math.max(0, (window.innerWidth - 380) / 2),
        bottom: 80,
      });
    }
  }, [isOpen, pos]);

  // Focus input when opened or done processing
  useEffect(() => {
    if (isOpen && !isLoading) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, isLoading]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

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
      setPos({
        left: dragStartRef.current.left + dx,
        bottom: dragStartRef.current.bottom - dy,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Submit
  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

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
          history: messages,
        }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "Done." },
        ]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Stopped." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Network error. Try again." },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading, boardId, userId, displayName, selectedIds]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!isOpen || !pos) return null;

  const hasMessages = messages.length > 0;

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

      {/* Messages area — grows upward */}
      <div
        className={`overflow-hidden transition-all duration-500 ${
          hasMessages
            ? "mb-2 max-h-[280px] opacity-100"
            : "mb-0 max-h-0 opacity-0"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="ai-messages-scroll flex max-h-[280px] flex-col gap-2 overflow-y-auto rounded-xl border border-slate-200/60 bg-white/70 p-2.5 backdrop-blur-sm">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
              style={{
                animation:
                  "ai-chat-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                animationDelay: `${i * 60}ms`,
                opacity: 0,
              }}
            >
              {/* Avatar */}
              {msg.role === "assistant" ? (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Sparkles className="h-3 w-3" />
                </div>
              ) : (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-500/50" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                    : "border border-slate-100 bg-white text-slate-700 shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div
              className="flex gap-2"
              style={{
                animation:
                  "ai-chat-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
                <div
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className={`relative rounded-2xl border bg-white transition-all duration-300 ${
          isLoading
            ? "border-indigo-100 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] ring-2 ring-indigo-50"
            : "border-slate-200/80 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)]"
        }`}
      >
        <div className="flex items-center gap-1.5 p-1.5">
          {/* Text input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder={
                isLoading ? "AI is working..." : "Ask AI to modify the board..."
              }
              className="h-9 w-full rounded-lg bg-slate-50 pl-3 pr-3 text-[13px] font-medium text-slate-700 placeholder-slate-400 transition-all duration-200 focus:bg-slate-100 focus:outline-none disabled:bg-white disabled:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && input.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {/* Shimmer overlay */}
            {isLoading && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg opacity-50">
                <div className="ai-loading-shimmer h-full w-full" />
              </div>
            )}
          </div>

          {/* Send / Stop button */}
          <button
            onClick={isLoading ? handleStop : handleSubmit}
            disabled={!input.trim() && !isLoading}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
              isLoading
                ? "bg-indigo-50 text-indigo-500 hover:scale-105 hover:bg-indigo-100 active:scale-95"
                : input.trim()
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 hover:scale-105 hover:bg-blue-600 active:scale-95"
                  : "cursor-not-allowed bg-blue-200/80 text-white"
            }`}
            style={{
              transitionTimingFunction:
                "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {/* Send icon */}
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
            {/* Stop icon */}
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
          </button>
        </div>
      </div>
    </div>
  );
}

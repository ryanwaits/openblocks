"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MousePointer2,
  Hand,
  StickyNote,
  Square,
  Type,
  Circle,
  Diamond,
  RectangleHorizontal,
  Minus,
  Trash2,
  Menu,
  Home,
  LogOut,
  Sparkles,
} from "lucide-react";
import { ColorPicker } from "./color-picker";
import { fetchBoards, type Board } from "@/lib/supabase/boards";
import { useAuthStore } from "@/lib/store/auth-store";
import type { ToolMode } from "@/types/board";

interface SidebarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  hasSelection: boolean;
  selectedColor?: string;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
  currentBoardId?: string;
  onAIToggle?: () => void;
  aiOpen?: boolean;
}

const tools: { mode: ToolMode; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { mode: "select", icon: MousePointer2, label: "Select", shortcut: "1" },
  { mode: "hand", icon: Hand, label: "Hand", shortcut: "2" },
];

const creationTools: { mode: ToolMode; icon: typeof StickyNote; label: string; shortcut: string }[] = [
  { mode: "sticky", icon: StickyNote, label: "Sticky Note", shortcut: "S" },
  { mode: "text", icon: Type, label: "Text", shortcut: "T" },
  { mode: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
  { mode: "circle", icon: Circle, label: "Circle", shortcut: "C" },
  { mode: "diamond", icon: Diamond, label: "Diamond", shortcut: "D" },
  { mode: "pill", icon: RectangleHorizontal, label: "Pill", shortcut: "P" },
  { mode: "line", icon: Minus, label: "Line", shortcut: "L" },
];

export function Sidebar({
  activeTool,
  onToolChange,
  hasSelection,
  selectedColor,
  onColorChange,
  onDelete,
  currentBoardId,
  onAIToggle,
  aiOpen,
}: SidebarProps) {
  const signOut = useAuthStore((s) => s.signOut);
  const [hoveredTool, setHoveredTool] = useState<ToolMode | null>(null);
  const [boardPanelOpen, setBoardPanelOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadBoards = useCallback(async () => {
    try {
      const data = await fetchBoards();
      setBoards(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    if (boardPanelOpen) loadBoards();
  }, [boardPanelOpen, loadBoards]);

  // Close panel on outside click
  useEffect(() => {
    if (!boardPanelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setBoardPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [boardPanelOpen]);

  const renderButton = (
    mode: ToolMode,
    Icon: typeof MousePointer2,
    label: string,
    shortcut?: string
  ) => {
    const isActive = activeTool === mode;
    return (
      <div key={mode} className="relative">
        <button
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          onClick={() => {
            if (isActive && creationTools.some((t) => t.mode === mode)) {
              onToolChange("select");
            } else {
              onToolChange(mode);
            }
          }}
          onMouseEnter={() => setHoveredTool(mode)}
          onMouseLeave={() => setHoveredTool(null)}
        >
          <Icon className="h-4 w-4" />
        </button>
        {hoveredTool === mode && (
          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
            {label}{shortcut && <span className="ml-1.5 text-gray-400">{shortcut}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#1e1e1e] p-2 shadow-xl">
      {/* Board switcher */}
      <div className="relative" ref={panelRef}>
        <button
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            boardPanelOpen
              ? "bg-blue-600 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          onClick={() => setBoardPanelOpen(!boardPanelOpen)}
        >
          <Menu className="h-4 w-4" />
        </button>

        {boardPanelOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl bg-white p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Boards</span>
              <Link
                href="/"
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <Home className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    board.id === currentBoardId
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  onClick={() => setBoardPanelOpen(false)}
                >
                  {board.name}
                </Link>
              ))}
              {boards.length === 0 && (
                <span className="px-3 py-2 text-sm text-gray-400">No boards yet</span>
              )}
            </div>
            <div className="my-2 h-px bg-gray-200" />
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              onClick={() => {
                setBoardPanelOpen(false);
                signOut();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </button>
          </div>
        )}
      </div>

      <div className="my-1 h-5 w-px bg-gray-700" />

      {tools.map((t) => renderButton(t.mode, t.icon, t.label, t.shortcut))}

      <div className="my-1 h-5 w-px bg-gray-700" />

      {creationTools.map((t) => renderButton(t.mode, t.icon, t.label, t.shortcut))}

      {onAIToggle && (
        <>
          <div className="my-1 h-5 w-px bg-gray-700" />
          <div className="relative">
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                aiOpen
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
              onClick={onAIToggle}
              onMouseEnter={() => setHoveredTool("select")}
              onMouseLeave={() => setHoveredTool(null)}
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {hasSelection && (
        <>
          <div className="my-1 h-5 w-px bg-gray-700" />
          {selectedColor && onColorChange && (
            <div className="flex items-center">
              <ColorPicker currentColor={selectedColor} onColorChange={onColorChange} />
            </div>
          )}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-gray-800 hover:text-red-300"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

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
  Pencil,
  Stamp,
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
  selectedStampType?: string;
  onStampTypeChange?: (type: string) => void;
}

function PenIcon({ isActive }: { isActive?: boolean }) {
  return (
    <svg width="36" height="40" viewBox="0 0 36 80" fill="none" className={`absolute bottom-[-2px] transition-transform duration-200 ${isActive ? "-translate-y-[3px]" : "group-hover/pen:-translate-y-[3px]"}`}>
      <defs>
        <linearGradient id="penBarrel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#bbb"/>
          <stop offset="0.15" stopColor="#d6d6d6"/>
          <stop offset="0.35" stopColor="#e8e8e8"/>
          <stop offset="0.5" stopColor="#f0f0f0"/>
          <stop offset="0.65" stopColor="#e8e8e8"/>
          <stop offset="0.85" stopColor="#d2d2d2"/>
          <stop offset="1" stopColor="#b5b5b5"/>
        </linearGradient>
        <linearGradient id="penCone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c0c0c0"/>
          <stop offset="0.35" stopColor="#ddd"/>
          <stop offset="0.5" stopColor="#e6e6e6"/>
          <stop offset="0.65" stopColor="#ddd"/>
          <stop offset="1" stopColor="#b8b8b8"/>
        </linearGradient>
      </defs>
      <rect x="7" y="38" width="22" height="42" rx="2" fill="url(#penBarrel)"/>
      <line x1="7" y1="55" x2="29" y2="55" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"/>
      <line x1="7" y1="62" x2="29" y2="62" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"/>
      <rect x="15.5" y="38" width="3" height="42" rx="1.5" fill="rgba(255,255,255,0.22)"/>
      <path d="M7 38 L11.5 18 L24.5 18 L29 38 Z" fill="url(#penCone)"/>
      <path d="M15 38 L16.5 19 L19 19 L17.5 38 Z" fill="rgba(255,255,255,0.18)"/>
      <line x1="7" y1="38" x2="29" y2="38" stroke="rgba(0,0,0,0.08)" strokeWidth="0.8"/>
      <path d="M11.5 18 L18 3 L24.5 18 Z" fill="#3a3a3a"/>
      <path d="M14 18 L18 5 L17 18 Z" fill="rgba(255,255,255,0.08)"/>
      <path d="M16 10 L18 3 L20 10 Z" fill="#2a2a2a"/>
    </svg>
  );
}

function StickyNoteIcon({ isActive }: { isActive?: boolean }) {
  return (
    <svg width="48" height="44" viewBox="0 0 52 46" fill="none" style={{ marginTop: -1 }}>
      <g className={`transition-transform duration-200 origin-center ${isActive ? "-translate-x-[3px] translate-y-[2px] -rotate-[2deg]" : "group-hover/sticky:-translate-x-[3px] group-hover/sticky:translate-y-[2px] group-hover/sticky:-rotate-[2deg]"}`}>
        <rect x="4" y="10" width="36" height="30" rx="2" fill="#ddc97a"/>
        <rect x="4" y="10" width="36" height="2" rx="1" fill="rgba(0,0,0,0.04)"/>
      </g>
      <g className={`transition-transform duration-200 origin-center ${isActive ? "-translate-x-[1px] translate-y-[1px] -rotate-[1deg]" : "group-hover/sticky:-translate-x-[1px] group-hover/sticky:translate-y-[1px] group-hover/sticky:-rotate-[1deg]"}`}>
        <rect x="7" y="8" width="36" height="30" rx="2" fill="#e8d68e"/>
        <rect x="7" y="8" width="36" height="2" rx="1" fill="rgba(0,0,0,0.03)"/>
      </g>
      <g>
        <rect x="10" y="6" width="36" height="30" rx="2" fill="#fef0c3"/>
        <path d="M38 6 L46 6 Q46 6 46 6 L46 14 Z" fill="#f5e29e"/>
        <path d="M38 6 L46 14" stroke="#e5ce6e" strokeWidth="0.5" fill="none" opacity="0.6"/>
        <path d="M38 6 L46 14 L44 14 L38 8 Z" fill="rgba(0,0,0,0.04)"/>
        <path d="M38 6 C39 9, 42 12, 46 14 L46 6 Z" fill="#faf5de"/>
        <rect x="10" y="33" width="36" height="3" rx="1.5" fill="rgba(0,0,0,0.02)"/>
      </g>
    </svg>
  );
}

const tools: { mode: ToolMode; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { mode: "select", icon: MousePointer2, label: "Select", shortcut: "1" },
  { mode: "hand", icon: Hand, label: "Hand", shortcut: "2" },
];

const creationTools: { mode: ToolMode; icon: typeof StickyNote | null; label: string; shortcut: string }[] = [
  { mode: "draw", icon: null, label: "Draw", shortcut: "B" },
  { mode: "sticky", icon: null, label: "Sticky Note", shortcut: "S" },
  { mode: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
  { mode: "line", icon: Minus, label: "Line", shortcut: "L" },
  { mode: "circle", icon: Circle, label: "Circle", shortcut: "C" },
  { mode: "diamond", icon: Diamond, label: "Diamond", shortcut: "D" },
  { mode: "pill", icon: RectangleHorizontal, label: "Pill", shortcut: "P" },
  // --- separator rendered between index 6 and 7 ---
  { mode: "text", icon: Type, label: "Text", shortcut: "T" },
  { mode: "stamp", icon: Stamp, label: "Stamp", shortcut: "E" },
];

const CREATION_SEPARATOR_INDEX = 7;

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
  selectedStampType,
  onStampTypeChange,
}: SidebarProps) {
  const signOut = useAuthStore((s) => s.signOut);
  const [hoveredTool, setHoveredTool] = useState<ToolMode | null>(null);
  const [aiHovered, setAiHovered] = useState(false);
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
    Icon: typeof MousePointer2 | null,
    label: string,
    shortcut?: string
  ) => {
    const isActive = activeTool === mode;
    const isCustomDraw = mode === "draw";
    const isCustomSticky = mode === "sticky";
    const isIllustrated = isCustomDraw || isCustomSticky;

    return (
      <div key={mode} className="relative">
        <button
          className={`group/pen group/sticky flex h-9 items-center justify-center rounded-lg transition-colors ${
            isCustomSticky ? "w-[50px]" : "w-9"
          } ${
            isCustomDraw ? "relative" : ""
          } ${
            isIllustrated
              ? "text-gray-700"
              : isActive
                ? "bg-[#7b61ff] text-white"
                : "text-gray-700 hover:bg-gray-100"
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
          {isCustomDraw ? (
            <PenIcon isActive={isActive} />
          ) : isCustomSticky ? (
            <StickyNoteIcon isActive={isActive} />
          ) : Icon ? (
            <Icon className="h-4 w-4" />
          ) : null}
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
    <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-black/5">
      {/* Board switcher */}
      <div className="relative" ref={panelRef}>
        <button
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            boardPanelOpen
              ? "bg-[#7b61ff] text-white"
              : "text-gray-700 hover:bg-gray-100"
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

      <div className="my-1 h-5 w-px bg-gray-200" />

      {tools.map((t) => renderButton(t.mode, t.icon, t.label, t.shortcut))}

      <div className="my-1 h-5 w-px bg-gray-200" />

      {creationTools.map((t, i) => (
        <div key={t.mode} className="flex items-center">
          {i === CREATION_SEPARATOR_INDEX && <div className="my-1 mr-1 h-5 w-px bg-gray-200" />}
          {renderButton(t.mode, t.icon, t.label, t.shortcut)}
        </div>
      ))}

      {/* Stamp picker popup */}
      {activeTool === "stamp" && onStampTypeChange && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 shadow-lg">
            {[
              { type: "thumbsup", label: "👍" },
              { type: "heart", label: "❤️" },
              { type: "fire", label: "🔥" },
              { type: "star", label: "⭐" },
              { type: "eyes", label: "👀" },
              { type: "laughing", label: "😂" },
              { type: "party", label: "🎉" },
              { type: "plusone", label: "+1" },
            ].map((e) => (
              <button
                key={e.type}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
                  selectedStampType === e.type
                    ? "bg-purple-100 ring-2 ring-[#7b61ff]"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => onStampTypeChange(e.type)}
                title={`${e.label} (Tab to cycle)`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {onAIToggle && (
        <>
          <div className="my-1 h-5 w-px bg-gray-200" />
          <div className="relative">
            <button
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                aiOpen
                  ? "bg-[#7b61ff] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              onClick={onAIToggle}
              onMouseEnter={() => setAiHovered(true)}
              onMouseLeave={() => setAiHovered(false)}
            >
              <Sparkles className="h-4 w-4" />
            </button>
            {aiHovered && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
                AI
              </div>
            )}
          </div>
        </>
      )}

      <div className={`flex overflow-hidden transition-all duration-200 ease-out ${hasSelection ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0"}`}>
        <div className="flex items-center gap-1">
          <div className="my-1 h-5 w-px shrink-0 bg-gray-200" />
          {selectedColor && onColorChange && (
            <div className="flex items-center">
              <ColorPicker currentColor={selectedColor} onColorChange={onColorChange} />
            </div>
          )}
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

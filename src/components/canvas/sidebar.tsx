"use client";

import { useState } from "react";
import {
  MousePointer2,
  Hand,
  StickyNote,
  Square,
  LayoutGrid,
  Type,
  Trash2,
} from "lucide-react";
import { ColorPicker } from "./color-picker";
import type { ToolMode } from "@/types/board";

interface SidebarProps {
  activeTool: ToolMode;
  onToolChange: (tool: ToolMode) => void;
  hasSelection: boolean;
  selectedColor?: string;
  onColorChange?: (color: string) => void;
  onDelete?: () => void;
}

const tools: { mode: ToolMode; icon: typeof MousePointer2; label: string }[] = [
  { mode: "select", icon: MousePointer2, label: "Select" },
  { mode: "hand", icon: Hand, label: "Hand" },
];

const creationTools: { mode: ToolMode; icon: typeof StickyNote; label: string }[] = [
  { mode: "sticky", icon: StickyNote, label: "Sticky Note" },
  { mode: "rectangle", icon: Square, label: "Rectangle" },
  { mode: "block", icon: LayoutGrid, label: "Block" },
  { mode: "text", icon: Type, label: "Text" },
];

export function Sidebar({
  activeTool,
  onToolChange,
  hasSelection,
  selectedColor,
  onColorChange,
  onDelete,
}: SidebarProps) {
  const [hoveredTool, setHoveredTool] = useState<ToolMode | null>(null);

  const renderButton = (
    mode: ToolMode,
    Icon: typeof MousePointer2,
    label: string
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
          onClick={() => onToolChange(mode)}
          onMouseEnter={() => setHoveredTool(mode)}
          onMouseLeave={() => setHoveredTool(null)}
        >
          <Icon className="h-4 w-4" />
        </button>
        {hoveredTool === mode && (
          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg">
            {label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute left-4 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1 rounded-2xl bg-[#1e1e1e] p-2 shadow-xl">
      {tools.map((t) => renderButton(t.mode, t.icon, t.label))}

      <div className="mx-1 my-1 h-px bg-gray-700" />

      {creationTools.map((t) => renderButton(t.mode, t.icon, t.label))}

      {hasSelection && (
        <>
          <div className="mx-1 my-1 h-px bg-gray-700" />
          {selectedColor && onColorChange && (
            <div className="flex justify-center">
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

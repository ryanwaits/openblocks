"use client";

import { useViewportStore } from "@/lib/store/viewport-store";
import { Minus, Plus, Maximize2 } from "lucide-react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  const scale = useViewportStore((s) => s.scale);
  const pct = Math.round(scale * 100);

  return (
    <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border bg-white/90 px-1.5 py-1 shadow-sm backdrop-blur" style={{ borderColor: "#e5e7eb" }}>
      <button onClick={onZoomOut} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100">
        <Minus size={14} />
      </button>
      <button onClick={onReset} className="min-w-[44px] text-center text-xs font-medium text-gray-600 transition-colors hover:text-gray-900">
        {pct}%
      </button>
      <button onClick={onZoomIn} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100">
        <Plus size={14} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-gray-200" />
      <button onClick={onReset} className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100">
        <Maximize2 size={13} />
      </button>
    </div>
  );
}

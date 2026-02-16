"use client";

import { Minus, Plus } from "lucide-react";

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 z-40 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        onClick={onZoomOut}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        className="min-w-[3rem] px-1 text-center text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
        onClick={onReset}
      >
        {Math.round(scale * 100)}%
      </button>
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        onClick={onZoomIn}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

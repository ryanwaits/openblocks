"use client";

import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import type { BoardObject } from "@/types/board";

interface FormattingToolbarProps {
  object: BoardObject;
  onFormatChange: (updates: Partial<BoardObject>) => void;
  screenX: number;
  screenY: number;
  screenW: number;
}

function applyAndRefocus(onFormatChange: (u: Partial<BoardObject>) => void, updates: Partial<BoardObject>) {
  onFormatChange(updates);
  // Refocus the textarea after format change — cancels the delayed blur
  requestAnimationFrame(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>(".absolute.z-50 textarea");
    textarea?.focus();
  });
}

export function FormattingToolbar({
  object,
  onFormatChange,
  screenX,
  screenY,
  screenW,
}: FormattingToolbarProps) {
  const isBold = object.font_weight === "bold";
  const isItalic = object.font_style === "italic";
  const isUnderline = object.text_decoration === "underline";
  const textAlign = object.text_align || "left";

  const toolbarWidth = 230;
  const left = screenX + screenW / 2 - toolbarWidth / 2;
  const top = screenY - 44;

  const btnClass = (active: boolean) =>
    `flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
      active ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
    }`;

  return (
    <div
      className="absolute z-[60] flex items-center gap-1 rounded-lg bg-[#1e1e1e] px-1.5 py-1 shadow-xl"
      style={{ left, top, width: toolbarWidth }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        className={btnClass(isBold)}
        onClick={() => applyAndRefocus(onFormatChange, { font_weight: isBold ? "normal" : "bold" })}
      >
        <span className="font-bold">B</span>
      </button>
      <button
        className={btnClass(isItalic)}
        onClick={() => applyAndRefocus(onFormatChange, { font_style: isItalic ? "normal" : "italic" })}
      >
        <span className="italic">I</span>
      </button>
      <button
        className={btnClass(isUnderline)}
        onClick={() => applyAndRefocus(onFormatChange, { text_decoration: isUnderline ? "none" : "underline" })}
      >
        <span className="underline">U</span>
      </button>

      <div className="mx-0.5 h-4 w-px bg-gray-700" />

      <button
        className={btnClass(textAlign === "left")}
        onClick={() => applyAndRefocus(onFormatChange, { text_align: "left" })}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        className={btnClass(textAlign === "center")}
        onClick={() => applyAndRefocus(onFormatChange, { text_align: "center" })}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button
        className={btnClass(textAlign === "right")}
        onClick={() => applyAndRefocus(onFormatChange, { text_align: "right" })}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

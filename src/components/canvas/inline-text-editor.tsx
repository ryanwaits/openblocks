"use client";

import { useRef, useEffect, useCallback } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import type { BoardObject } from "@/types/board";

interface InlineTextEditorProps {
  object: BoardObject;
  onSave: (text: string) => void;
  onClose: () => void;
}

export function InlineTextEditor({
  object,
  onSave,
  onClose,
}: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scale = useViewportStore((s) => s.scale);
  const pos = useViewportStore((s) => s.pos);

  // Position in screen space
  const screenX = object.x * scale + pos.x;
  const screenY = object.y * scale + pos.y;
  const screenW = object.width * scale;
  const screenH = object.height * scale;

  // Style based on object type
  const isSticky = object.type === "sticky";
  const isText = object.type === "text";

  const fontSize = isText ? 16 * scale : 14 * scale;
  const padding = isSticky ? 12 * scale : 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = textareaRef.current?.value ?? "";
    onSave(text);
    onClose();
  }, [onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBlur();
      }
      // Stop propagation to prevent board keyboard handlers
      e.stopPropagation();
    },
    [handleBlur]
  );

  return (
    <div
      className="absolute z-50"
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        borderRadius: isSticky ? 8 * scale : 4 * scale,
        overflow: "hidden",
        backgroundColor: isSticky ? object.color : "transparent",
      }}
    >
      <textarea
        ref={textareaRef}
        defaultValue={object.text}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full w-full resize-none border-none outline-none bg-transparent"
        style={{
          padding,
          fontSize: Math.max(10, fontSize),
          fontFamily: "Inter, sans-serif",
          lineHeight: 1.4,
          color: object.text_color || "#1f2937",
          fontWeight: object.font_weight || "normal",
          fontStyle: object.font_style || "normal",
          textDecoration: object.text_decoration === "underline" ? "underline" : "none",
          textAlign: object.text_align || "left",
        }}
      />
    </div>
  );
}

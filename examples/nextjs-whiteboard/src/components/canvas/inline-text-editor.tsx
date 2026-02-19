"use client";

import { useRef, useEffect, useCallback } from "react";
import { useViewportStore } from "@/lib/store/viewport-store";
import { getRotatedAABB } from "@/lib/geometry/rotation";
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
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scale = useViewportStore((s) => s.scale);
  const pos = useViewportStore((s) => s.pos);

  // Position in screen space — use AABB for rotated shapes
  const aabb = getRotatedAABB(object);
  const screenX = aabb.x * scale + pos.x;
  const screenY = aabb.y * scale + pos.y;
  const screenW = aabb.width * scale;
  const screenH = aabb.height * scale;

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

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const saveAndClose = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = textareaRef.current?.value ?? "";
    onSave(text);
    onClose();
  }, [onSave, onClose]);

  const handleBlur = useCallback(() => {
    // Delay close so toolbar button clicks can fire first and cancel via refocus
    blurTimeoutRef.current = setTimeout(() => {
      saveAndClose();
    }, 150);
  }, [saveAndClose]);

  // Cancel pending blur when textarea regains focus (e.g., after toolbar click)
  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = undefined;
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        saveAndClose();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        saveAndClose();
      }
      // Stop propagation to prevent board keyboard handlers
      e.stopPropagation();
    },
    [saveAndClose]
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
        onFocus={handleFocus}
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

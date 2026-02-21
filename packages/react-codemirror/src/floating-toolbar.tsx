"use client";

import React, { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";

export interface FloatingToolbarProps {
  viewRef: RefObject<EditorView | null>;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

const ACTIONS: { label: string; wrap: [string, string]; title: string }[] = [
  { label: "B", wrap: ["**", "**"], title: "Bold" },
  { label: "I", wrap: ["*", "*"], title: "Italic" },
  { label: "S", wrap: ["~~", "~~"], title: "Strikethrough" },
  { label: "</>", wrap: ["`", "`"], title: "Code" },
];

export function FloatingToolbar({ viewRef }: FloatingToolbarProps): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<ToolbarPosition>({ top: 0, left: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const checkSelection = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    if (from === to) {
      setVisible(false);
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) {
      setVisible(false);
      return;
    }

    const toolbarWidth = toolbarRef.current?.offsetWidth ?? 200;
    setPosition({
      top: rect.top + window.scrollY - 44,
      left: rect.left + window.scrollX + rect.width / 2 - toolbarWidth / 2,
    });
    setVisible(true);
  }, [viewRef]);

  useEffect(() => {
    document.addEventListener("selectionchange", checkSelection);
    return () => document.removeEventListener("selectionchange", checkSelection);
  }, [checkSelection]);

  const wrapSelection = useCallback(
    (before: string, after: string) => {
      const view = viewRef.current;
      if (!view) return;

      const { from, to } = view.state.selection.main;
      if (from === to) return;

      const doc = view.state.doc;

      // Check if selection is already wrapped with these markers
      const outerFrom = from - before.length;
      const outerTo = to + after.length;
      const hasOuter =
        outerFrom >= 0 &&
        outerTo <= doc.length &&
        doc.sliceString(outerFrom, from) === before &&
        doc.sliceString(to, outerTo) === after;

      if (hasOuter) {
        // Unwrap: remove surrounding markers, keep selection on inner text
        view.dispatch({
          changes: [
            { from: outerFrom, to: from, insert: "" },
            { from: to, to: outerTo, insert: "" },
          ],
          selection: { anchor: outerFrom, head: outerFrom + (to - from) },
        });
      } else {
        // Wrap
        view.dispatch({
          changes: [
            { from, insert: before },
            { from: to, insert: after },
          ],
          selection: { anchor: from + before.length, head: to + before.length },
        });
      }
      view.focus();
    },
    [viewRef]
  );

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[200] flex items-center gap-[1px] bg-white border border-[#E8E5E0] rounded-[10px] p-1 transition-opacity duration-150"
      style={{
        top: position.top,
        left: position.left,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {ACTIONS.map((action, i) => (
        <span key={action.title} className="contents">
          {i === 3 && (
            <div className="w-px h-5 bg-[#E8E5E0] mx-0.5" />
          )}
          <button
            title={action.title}
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#888580] text-[13px] font-semibold hover:bg-[#F7F6F4] hover:text-[#1A1A1A] transition-colors"
            style={
              action.label === "I"
                ? { fontFamily: "serif", fontStyle: "italic" }
                : action.label === "S"
                ? { textDecoration: "line-through" }
                : action.label === "</>"
                ? { fontFamily: "var(--ob-editor-font, monospace)", fontSize: "12px" }
                : undefined
            }
            onMouseDown={(e) => {
              e.preventDefault(); // keep editor focused
              wrapSelection(action.wrap[0], action.wrap[1]);
            }}
          >
            {action.label}
          </button>
        </span>
      ))}
    </div>
  );
}

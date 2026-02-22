"use client";

import React, { useEffect, useState, useCallback, type RefObject } from "react";
import { useOthers } from "@waits/lively-react";
import type { EditorView } from "@codemirror/view";

export interface StatusBarProps {
  viewRef: RefObject<EditorView | null>;
  /** Language label shown in the status bar. Defaults to "Markdown". */
  languageName?: string;
}

export function StatusBar({ viewRef, languageName = "Markdown" }: StatusBarProps): React.JSX.Element {
  const others = useOthers();
  const [line, setLine] = useState(1);
  const [col, setCol] = useState(1);

  const updateStats = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const state = view.state;
    const pos = state.selection.main.head;
    const lineObj = state.doc.lineAt(pos);
    setLine(lineObj.number);
    setCol(pos - lineObj.from + 1);
  }, [viewRef]);

  useEffect(() => {
    const interval = setInterval(updateStats, 200);
    updateStats();
    return () => clearInterval(interval);
  }, [updateStats]);

  const onlineCount = (others?.length ?? 0) + 1;

  return (
    <div className="h-8 bg-[#f0f0f0] border-t border-[#e5e5e5] flex items-center justify-between px-3 text-xs text-gray-500 select-none shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 cursor-default">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <circle cx="12" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M6 9v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9" />
          </svg>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {onlineCount} online
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="cursor-default">{line}:{col}</span>
        <span className="cursor-default">{languageName}</span>
      </div>
    </div>
  );
}

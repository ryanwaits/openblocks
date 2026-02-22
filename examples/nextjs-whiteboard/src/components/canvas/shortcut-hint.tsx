"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "frame-shortcut-hint-count";
const MAX_SHOWS = 3;
const DISPLAY_MS = 4000;

export function useShortcutHint() {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    if (typeof window === "undefined") return;
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
    if (count >= MAX_SHOWS) return;
    localStorage.setItem(STORAGE_KEY, String(count + 1));
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => clearTimeout(t);
  }, [visible]);

  return { visible, trigger };
}

export function ShortcutHint({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!visible) setMounted(false);
  };

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-20 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(-50%) translateY(${visible ? "0" : "6px"})`,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="flex items-center gap-2.5 rounded-full bg-[#1e1e1e] px-4 py-2 shadow-lg">
        <span className="text-[13px] text-gray-300">Navigate frames</span>
        <div className="flex items-center gap-1">
          <Kbd>[</Kbd>
          <Kbd>]</Kbd>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] border px-1.5 text-[11px] font-medium leading-none text-gray-200"
      style={{
        background: "linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)",
        borderColor: "#4a4a4a",
        boxShadow: "0 1px 0 0 #1a1a1a, inset 0 1px 0 0 rgba(255,255,255,0.06)",
      }}
    >
      {children}
    </span>
  );
}

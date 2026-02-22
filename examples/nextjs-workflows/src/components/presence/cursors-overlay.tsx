"use client";

import { useEffect, useRef } from "react";
import { useCursors, useSelf } from "@waits/lively-react";
import { useViewportStore } from "@/lib/store/viewport-store";
import type { CursorData } from "@waits/lively-types";

interface InterpolatedCursor {
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
}

export function CursorsOverlay() {
  const cursors = useCursors();
  const self = useSelf();
  const interpolatedRef = useRef<Map<string, InterpolatedCursor>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cursors.forEach((cursor, userId) => {
      const interp = interpolatedRef.current.get(userId);
      if (interp) {
        interp.targetX = cursor.x;
        interp.targetY = cursor.y;
      } else {
        interpolatedRef.current.set(userId, {
          targetX: cursor.x,
          targetY: cursor.y,
          currentX: cursor.x,
          currentY: cursor.y,
        });
      }
    });
    for (const key of interpolatedRef.current.keys()) {
      if (!cursors.has(key)) interpolatedRef.current.delete(key);
    }
  }, [cursors]);

  useEffect(() => {
    function animate() {
      const container = containerRef.current;
      if (!container) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }
      const { scale, pos } = useViewportStore.getState();
      interpolatedRef.current.forEach((interp, userId) => {
        const lerpFactor = 0.3;
        interp.currentX += (interp.targetX - interp.currentX) * lerpFactor;
        interp.currentY += (interp.targetY - interp.currentY) * lerpFactor;
        const screenX = interp.currentX * scale + pos.x;
        const screenY = interp.currentY * scale + pos.y;
        const el = container.querySelector(`[data-cursor-id="${userId}"]`) as HTMLElement;
        if (el) el.style.transform = `translate(${screenX}px, ${screenY}px)`;
      });
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const cursorEntries = Array.from(cursors.entries()).filter(
    ([userId]) => userId !== self?.userId,
  );

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 50 }}>
      {cursorEntries.map(([userId, cursor]) => (
        <CursorArrow key={userId} userId={userId} cursor={cursor} />
      ))}
    </div>
  );
}

function CursorArrow({ userId, cursor }: { userId: string; cursor: CursorData }) {
  return (
    <div data-cursor-id={userId} className="absolute left-0 top-0" style={{ willChange: "transform" }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
        <path d="M5 3l14 8-8 2-2 8z" fill={cursor.color} stroke="white" strokeWidth="1.5" />
      </svg>
      <span className="ml-4 -mt-1 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: cursor.color }}>
        {cursor.displayName}
      </span>
    </div>
  );
}

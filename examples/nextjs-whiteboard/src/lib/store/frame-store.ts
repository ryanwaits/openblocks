import { create } from "zustand";
import type { Frame } from "@/types/board";

function activeFrameKey(boardId: string) {
  return `activeFrame:${boardId}`;
}

interface FrameState {
  frames: Frame[];
  activeFrameIndex: number;
  addFrame: (frame: Frame) => void;
  deleteFrame: (frameId: string) => void;
  syncFrames: (frames: Frame[]) => void;
  setActiveFrame: (index: number, boardId?: string) => void;
  nextFrameIndex: () => number;
  restoreActiveFrame: (boardId: string) => number;
}

export const useFrameStore = create<FrameState>((set, get) => ({
  frames: [],
  activeFrameIndex: 0,

  addFrame: (frame) =>
    set((s) => {
      if (s.frames.some((f) => f.id === frame.id)) return s;
      return {
        frames: [...s.frames, frame].sort((a, b) => a.index - b.index),
      };
    }),

  deleteFrame: (frameId) =>
    set((s) => {
      const remaining = s.frames.filter((f) => f.id !== frameId);
      const activeFrameIndex =
        s.activeFrameIndex >= remaining.length ? 0 : s.activeFrameIndex;
      return { frames: remaining, activeFrameIndex };
    }),

  syncFrames: (frames) =>
    set({ frames: [...frames].sort((a, b) => a.index - b.index) }),

  setActiveFrame: (index, boardId?) => {
    set({ activeFrameIndex: index });
    if (boardId) {
      try {
        localStorage.setItem(activeFrameKey(boardId), String(index));
      } catch { /* quota exceeded */ }
    }
  },

  nextFrameIndex: () => {
    const { frames } = get();
    if (frames.length === 0) return 1;
    return Math.max(...frames.map((f) => f.index)) + 1;
  },

  restoreActiveFrame: (boardId) => {
    try {
      const raw = localStorage.getItem(activeFrameKey(boardId));
      if (raw !== null) {
        const index = parseInt(raw, 10);
        if (!isNaN(index)) {
          const { frames } = get();
          if (frames.some((f) => f.index === index)) {
            set({ activeFrameIndex: index });
            return index;
          }
        }
      }
    } catch { /* parse error */ }
    // Default to first frame
    const { frames } = get();
    const firstIndex = frames.length > 0 ? frames[0].index : 0;
    set({ activeFrameIndex: firstIndex });
    return firstIndex;
  },
}));

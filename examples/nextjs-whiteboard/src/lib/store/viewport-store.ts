import { create } from "zustand";

interface ViewportState {
  scale: number;
  pos: { x: number; y: number };
  setViewport: (pos: { x: number; y: number }, scale: number) => void;
  saveForBoard: (boardId: string) => void;
  restoreForBoard: (boardId: string, fallbackPos: { x: number; y: number }) => { pos: { x: number; y: number }; scale: number } | null;
}

function storageKey(boardId: string) {
  return `viewport:${boardId}`;
}

export const useViewportStore = create<ViewportState>((set, get) => ({
  scale: 1,
  pos: { x: 0, y: 0 },

  setViewport: (pos, scale) => set({ pos, scale }),

  saveForBoard: (boardId) => {
    const { pos, scale } = get();
    try {
      localStorage.setItem(storageKey(boardId), JSON.stringify({ pos, scale }));
    } catch {
      // quota exceeded or unavailable
    }
  },

  restoreForBoard: (boardId) => {
    try {
      const raw = localStorage.getItem(storageKey(boardId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.scale === "number" && parsed.pos) {
        return { pos: parsed.pos, scale: parsed.scale };
      }
    } catch {
      // parse error
    }
    return null;
  },
}));

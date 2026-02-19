import { create } from "zustand";
import type { CursorData, PresenceUser } from "@/types/board";

interface PresenceState {
  cursors: Map<string, CursorData>;
  onlineUsers: PresenceUser[];
  updateCursor: (cursor: CursorData) => void;
  updatePresence: (users: PresenceUser[]) => void;
  removeCursor: (userId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  cursors: new Map(),
  onlineUsers: [],

  updateCursor: (cursor) =>
    set((state) => {
      const next = new Map(state.cursors);
      next.set(cursor.userId, cursor);
      return { cursors: next };
    }),

  updatePresence: (users) =>
    set((state) => {
      // Remove cursors for users who disconnected
      const activeUserIds = new Set(users.map((u) => u.userId));
      const next = new Map(state.cursors);
      for (const key of next.keys()) {
        if (!activeUserIds.has(key)) {
          next.delete(key);
        }
      }
      return { onlineUsers: users, cursors: next };
    }),

  removeCursor: (userId) =>
    set((state) => {
      const next = new Map(state.cursors);
      next.delete(userId);
      return { cursors: next };
    }),
}));

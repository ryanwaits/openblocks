import { describe, expect, test, beforeEach } from "bun:test";
import { usePresenceStore } from "../presence-store";
import type { CursorData, PresenceUser } from "../../../../src/types/board";

function reset() {
  usePresenceStore.setState({ cursors: new Map(), onlineUsers: [] });
}

const cursor1: CursorData = {
  userId: "u1",
  displayName: "Alice",
  color: "#ef4444",
  x: 100,
  y: 200,
  lastUpdate: Date.now(),
};

const cursor2: CursorData = {
  userId: "u2",
  displayName: "Bob",
  color: "#3b82f6",
  x: 300,
  y: 400,
  lastUpdate: Date.now(),
};

describe("presence-store", () => {
  beforeEach(reset);

  describe("updateCursor", () => {
    test("adds cursor by userId", () => {
      usePresenceStore.getState().updateCursor(cursor1);
      const { cursors } = usePresenceStore.getState();
      expect(cursors.size).toBe(1);
      expect(cursors.get("u1")).toEqual(cursor1);
    });

    test("overwrites cursor for same userId", () => {
      usePresenceStore.getState().updateCursor(cursor1);
      const updated = { ...cursor1, x: 999 };
      usePresenceStore.getState().updateCursor(updated);

      expect(usePresenceStore.getState().cursors.get("u1")!.x).toBe(999);
      expect(usePresenceStore.getState().cursors.size).toBe(1);
    });
  });

  describe("removeCursor", () => {
    test("deletes cursor by userId", () => {
      usePresenceStore.getState().updateCursor(cursor1);
      usePresenceStore.getState().removeCursor("u1");
      expect(usePresenceStore.getState().cursors.has("u1")).toBe(false);
    });
  });

  describe("updatePresence", () => {
    test("sets onlineUsers", () => {
      const users: PresenceUser[] = [
        { userId: "u1", displayName: "Alice", color: "#ef4444", connectedAt: Date.now() },
      ];
      usePresenceStore.getState().updatePresence(users);
      expect(usePresenceStore.getState().onlineUsers).toEqual(users);
    });

    test("removes cursors for users no longer in list", () => {
      usePresenceStore.getState().updateCursor(cursor1);
      usePresenceStore.getState().updateCursor(cursor2);

      // Only u1 remains online
      usePresenceStore.getState().updatePresence([
        { userId: "u1", displayName: "Alice", color: "#ef4444", connectedAt: Date.now() },
      ]);

      const { cursors } = usePresenceStore.getState();
      expect(cursors.has("u1")).toBe(true);
      expect(cursors.has("u2")).toBe(false);
    });
  });
});

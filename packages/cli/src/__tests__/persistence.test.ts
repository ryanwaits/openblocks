import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RoomPersistence, sanitize } from "../persistence.js";
import type { SerializedCrdt } from "@waits/lively-types";

const makeRoot = (overrides?: Partial<SerializedCrdt>): SerializedCrdt => ({
  type: "LiveObject",
  data: { count: 0 },
  ...overrides,
});

describe("RoomPersistence", () => {
  let dataDir: string;
  let persistence: RoomPersistence;

  beforeEach(async () => {
    dataDir = path.join(os.tmpdir(), `lively-test-${crypto.randomUUID()}`);
    persistence = new RoomPersistence(dataDir);
    await persistence.ensureDir();
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("round-trips save and load", async () => {
    const root = makeRoot({ data: { title: "hello" } });
    await persistence.save("room-1", root);
    const loaded = await persistence.load("room-1");
    expect(loaded).toEqual(root);
  });

  it("returns null for nonexistent room", async () => {
    const result = await persistence.load("no-such-room");
    expect(result).toBeNull();
  });

  it("reset wipes all rooms", async () => {
    await persistence.save("a", makeRoot());
    await persistence.save("b", makeRoot());
    await persistence.reset();
    expect(await persistence.load("a")).toBeNull();
    expect(await persistence.load("b")).toBeNull();
  });

  it("list returns entries with sizes and timestamps", async () => {
    await persistence.save("room-x", makeRoot());
    await persistence.save("room-y", makeRoot({ data: { big: "data" } }));
    const rooms = await persistence.list();
    expect(rooms).toHaveLength(2);
    const ids = rooms.map((r) => r.roomId).sort();
    expect(ids).toEqual(["room-x", "room-y"]);
    for (const room of rooms) {
      expect(room.sizeBytes).toBeGreaterThan(0);
      expect(room.updatedAt).toBeGreaterThan(0);
    }
  });

  it("list returns empty for no rooms", async () => {
    const rooms = await persistence.list();
    expect(rooms).toEqual([]);
  });

  it("delete removes a single room", async () => {
    await persistence.save("keep", makeRoot());
    await persistence.save("remove", makeRoot());
    await persistence.delete("remove");
    expect(await persistence.load("keep")).not.toBeNull();
    expect(await persistence.load("remove")).toBeNull();
  });

  it("exists checks correctly", async () => {
    expect(await persistence.exists("nope")).toBe(false);
    await persistence.save("yes", makeRoot());
    expect(await persistence.exists("yes")).toBe(true);
  });

  it("overwrites on re-save", async () => {
    await persistence.save("room-1", makeRoot({ data: { v: 1 } }));
    await persistence.save("room-1", makeRoot({ data: { v: 2 } }));
    const loaded = await persistence.load("room-1");
    expect(loaded).toEqual(makeRoot({ data: { v: 2 } }));
  });
});

describe("sanitize", () => {
  it("passes through safe chars", () => {
    expect(sanitize("my-room_123")).toBe("my-room_123");
  });

  it("replaces unsafe chars", () => {
    expect(sanitize("room/with spaces!")).toBe("room_with_spaces_");
  });

  it("replaces dots and colons", () => {
    expect(sanitize("ns:room.v2")).toBe("ns_room_v2");
  });
});

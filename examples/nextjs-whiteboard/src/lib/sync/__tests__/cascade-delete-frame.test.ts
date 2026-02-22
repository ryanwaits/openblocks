import { describe, it, expect, beforeEach } from "bun:test";
import { LiveObject } from "@waits/lively-storage";
import { LiveMap } from "@waits/lively-storage";
import { StorageDocument } from "@waits/lively-storage";
import { cascadeDeleteFrame } from "../cascade-delete-frame";
import {
  frameOriginX,
  FRAME_ORIGIN_Y,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "../../geometry/frames";

// Frame 0 bounds: x [-2000, 2000], y [-1500, 1500]
// Frame 1 bounds: x [2200, 6200], y [-1500, 1500]
const F0_CENTER_X = frameOriginX(0) + BOARD_WIDTH / 2; // 0
const F1_CENTER_X = frameOriginX(1) + BOARD_WIDTH / 2; // 4200
const CENTER_Y = FRAME_ORIGIN_Y + BOARD_HEIGHT / 2; // 0

function makeShape(id: string, x: number, y: number, opts?: { type?: string; frame_id?: string }) {
  return new LiveObject({
    id,
    board_id: "board-1",
    type: opts?.type ?? "sticky",
    x,
    y,
    width: 200,
    height: 150,
    color: "#fff",
    text: "",
    z_index: 1,
    created_by: null,
    updated_at: new Date().toISOString(),
    frame_id: opts?.frame_id ?? undefined,
  });
}

function makeLine(
  id: string,
  points: Array<{ x: number; y: number }>,
  startObjectId?: string | null,
  endObjectId?: string | null,
  frame_id?: string,
) {
  return new LiveObject({
    id,
    board_id: "board-1",
    type: "line",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    color: "#000",
    text: "",
    z_index: 1,
    created_by: null,
    updated_at: new Date().toISOString(),
    points: JSON.stringify(points),
    start_object_id: startObjectId ?? null,
    end_object_id: endObjectId ?? null,
    frame_id: frame_id ?? undefined,
  });
}

function makeFrame(id: string, index: number, label: string) {
  return new LiveObject({ id, index, label });
}

describe("cascadeDeleteFrame", () => {
  let objects: LiveMap<LiveObject>;
  let frames: LiveMap<LiveObject>;
  let doc: StorageDocument;

  beforeEach(() => {
    objects = new LiveMap<LiveObject>();
    frames = new LiveMap<LiveObject>();
    const root = new LiveObject({ objects, frames });
    doc = new StorageDocument(root);
  });

  function roundTrip(): { objects: LiveMap<LiveObject>; frames: LiveMap<LiveObject>; doc: StorageDocument } {
    const serialized = doc.serialize();
    const newDoc = StorageDocument.deserialize(serialized);
    const newRoot = newDoc.getRoot();
    return {
      objects: newRoot.get("objects") as LiveMap<LiveObject>,
      frames: newRoot.get("frames") as LiveMap<LiveObject>,
      doc: newDoc,
    };
  }

  it("deletes shapes with matching frame_id", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    objects.set("s2", makeShape("s2", 200, 200, { frame_id: "frame-1" }));
    objects.set("s0", makeShape("s0", 100, 100, { frame_id: "frame-0" }));

    frames.set("frame-0", makeFrame("frame-0", 0, "Frame 1"));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(objects.has("s1")).toBe(false);
    expect(objects.has("s2")).toBe(false);
    expect(objects.has("s0")).toBe(true);
    expect(frames.has("frame-1")).toBe(false);
    expect(frames.has("frame-0")).toBe(true);
  });

  it("deletes lines with matching frame_id", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    objects.set("line-1", makeLine("line-1", [{ x: 100, y: 100 }, { x: 200, y: 200 }], "s1", null, "frame-1"));

    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(objects.has("s1")).toBe(false);
    expect(objects.has("line-1")).toBe(false);
  });

  it("falls back to bounds check for legacy objects without frame_id", () => {
    objects.set("s1", makeShape("s1", F1_CENTER_X - 100, CENTER_Y - 75));
    objects.set("s2", makeShape("s2", F1_CENTER_X + 100, CENTER_Y + 100));
    objects.set("s0", makeShape("s0", F0_CENTER_X - 100, CENTER_Y - 75));

    frames.set("frame-0", makeFrame("frame-0", 0, "Frame 1"));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(objects.has("s1")).toBe(false);
    expect(objects.has("s2")).toBe(false);
    expect(objects.has("s0")).toBe(true);
    expect(frames.has("frame-1")).toBe(false);
    expect(frames.has("frame-0")).toBe(true);
  });

  it("cascade-deletes lines connected to deleted shapes (legacy)", () => {
    objects.set("s1", makeShape("s1", F1_CENTER_X - 100, CENTER_Y - 75));
    objects.set("s2", makeShape("s2", F1_CENTER_X + 100, CENTER_Y + 100));
    objects.set(
      "line-1",
      makeLine("line-1", [{ x: F1_CENTER_X, y: CENTER_Y }, { x: F1_CENTER_X + 200, y: CENTER_Y + 100 }], "s1", "s2")
    );
    objects.set("s0", makeShape("s0", F0_CENTER_X, CENTER_Y));
    objects.set(
      "line-cross",
      makeLine("line-cross", [{ x: F0_CENTER_X + 100, y: CENTER_Y }, { x: F1_CENTER_X, y: CENTER_Y }], "s0", "s1")
    );

    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(objects.has("s1")).toBe(false);
    expect(objects.has("s2")).toBe(false);
    expect(objects.has("line-1")).toBe(false);
    expect(objects.has("line-cross")).toBe(false);
    expect(objects.has("s0")).toBe(true);
  });

  it("no-ops when frame ID does not exist", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "nonexistent");

    expect(objects.has("s1")).toBe(true);
    expect(frames.has("frame-1")).toBe(true);
  });

  it("works after serialize/deserialize round-trip", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    objects.set("s0", makeShape("s0", 100, 100, { frame_id: "frame-0" }));
    frames.set("frame-0", makeFrame("frame-0", 0, "Frame 1"));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    const rt = roundTrip();

    cascadeDeleteFrame(rt.objects, rt.frames, "frame-1");

    expect(rt.objects.has("s1")).toBe(false);
    expect(rt.objects.has("s0")).toBe(true);
    expect(rt.frames.has("frame-1")).toBe(false);
    expect(rt.frames.has("frame-0")).toBe(true);
  });

  it("deep subscription fires and re-read shows deleted objects gone", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    objects.set("s2", makeShape("s2", 200, 200, { frame_id: "frame-1" }));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    let lastSyncedIds: string[] = [];
    doc.subscribe(objects, () => {
      lastSyncedIds = [];
      objects.forEach((_lo: LiveObject, id: string) => {
        lastSyncedIds.push(id);
      });
    }, { isDeep: true });

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(lastSyncedIds).toEqual([]);
    expect(objects.size).toBe(0);
  });

  it("delete frame, recreate, old objects should not reappear", () => {
    objects.set("s1", makeShape("s1", 100, 100, { frame_id: "frame-1" }));
    objects.set("s2", makeShape("s2", 200, 200, { frame_id: "frame-1" }));
    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2"));

    cascadeDeleteFrame(objects, frames, "frame-1");

    expect(objects.has("s1")).toBe(false);
    expect(objects.has("s2")).toBe(false);
    expect(frames.has("frame-1")).toBe(false);

    frames.set("frame-1", makeFrame("frame-1", 1, "Frame 2 (new)"));

    const objectIds: string[] = [];
    objects.forEach((_lo: LiveObject, id: string) => {
      objectIds.push(id);
    });
    expect(objectIds).toEqual([]);
    expect(objects.size).toBe(0);
  });
});

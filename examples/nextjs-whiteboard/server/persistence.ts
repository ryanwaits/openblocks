import type { LivelyServer } from "@waits/lively-server";
import type { StorageOp, SerializedCrdt } from "@waits/lively-types";
import { LiveObject, LiveMap, StorageDocument } from "@waits/lively-storage";
import type { BoardObject, Frame } from "../src/types/board";

// --- Config ---

// Prefer NEXT_PUBLIC_ variants — shell env vars can hold stale values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "";

console.log(`[persistence] Supabase URL: ${SUPABASE_URL || "(empty)"}`);

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveBoardId(roomId: string): string | null {
  if (roomId === "default") return "00000000-0000-0000-0000-000000000000";
  if (UUID_RE.test(roomId)) return roomId;
  return null;
}

// --- Supabase fetch helpers ---

async function fetchBoardObjects(boardUUID: string): Promise<BoardObject[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/board_objects?board_id=eq.${boardUUID}&select=*`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) {
      console.error(`fetchBoardObjects failed (${res.status}):`, await res.text());
      return [];
    }
    return res.json();
  } catch (e) {
    console.error(`fetchBoardObjects network error:`, e);
    return [];
  }
}

async function fetchBoardFrames(boardUUID: string): Promise<Frame[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/boards?id=eq.${boardUUID}&select=frames`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) return [];
    const boards = await res.json();
    if (boards.length > 0 && Array.isArray(boards[0].frames) && boards[0].frames.length > 0) {
      return boards[0].frames;
    }
    return [];
  } catch (e) {
    console.error(`fetchBoardFrames network error:`, e);
    return [];
  }
}

/** Normalize objects so every row has the same keys (PostgREST PGRST102). */
function normalizeForUpsert(objects: BoardObject[]): Record<string, unknown>[] {
  return objects.map((obj) => ({
    id: obj.id,
    board_id: obj.board_id,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    color: obj.color,
    text: obj.text,
    z_index: obj.z_index,
    created_by: obj.created_by,
    created_by_name: obj.created_by_name ?? null,
    updated_at: obj.updated_at,
    font_weight: obj.font_weight ?? null,
    font_style: obj.font_style ?? null,
    text_decoration: obj.text_decoration ?? null,
    text_color: obj.text_color ?? null,
    text_align: obj.text_align ?? null,
    points: obj.points ?? null,
    stroke_color: obj.stroke_color ?? null,
    stroke_width: obj.stroke_width ?? null,
    start_arrow: obj.start_arrow ?? null,
    end_arrow: obj.end_arrow ?? null,
    start_object_id: obj.start_object_id ?? null,
    end_object_id: obj.end_object_id ?? null,
    label: obj.label ?? null,
    rotation: obj.rotation ?? null,
    frame_id: obj.frame_id ?? null,
  }));
}

async function persistObjects(objects: BoardObject[]): Promise<void> {
  if (objects.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/board_objects`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(normalizeForUpsert(objects)),
  });
  if (!res.ok) {
    console.error(`persistObjects failed (${res.status}):`, await res.text());
  }
}

async function deleteObjects(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Supabase REST: DELETE with in() filter
  const filter = ids.map((id) => `"${id}"`).join(",");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/board_objects?id=in.(${filter})`,
    { method: "DELETE", headers: supabaseHeaders() }
  );
  if (!res.ok) {
    console.error(`deleteObjects failed (${res.status}):`, await res.text());
  }
}

async function persistFrames(boardUUID: string, frames: Frame[]): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/boards?id=eq.${boardUUID}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(),
      body: JSON.stringify({ frames }),
    }
  );
  if (!res.ok) {
    console.error(`persistFrames failed (${res.status}):`, await res.text());
  }
}

// --- CRDT ↔ BoardObject conversion ---

function boardObjectToLiveObject(obj: BoardObject): LiveObject {
  // Flatten all fields into a LiveObject (no nested CRDTs needed for board objects)
  const data: Record<string, unknown> = { ...obj };
  // Serialize points array as JSON string to avoid nested CRDT complexity
  if (obj.points) {
    data.points = JSON.stringify(obj.points);
  }
  return new LiveObject(data);
}

function liveObjectToBoardObject(lo: LiveObject): BoardObject | null {
  // Guard: ops deserialized before the _deserializeValue fix may be raw objects
  if (typeof lo.toObject !== "function") return null;
  const raw = lo.toObject();
  const obj = { ...raw } as unknown as BoardObject;
  // Deserialize points from JSON string back to array
  if (typeof obj.points === "string") {
    try {
      obj.points = JSON.parse(obj.points as unknown as string);
    } catch {
      obj.points = undefined;
    }
  }
  return obj;
}

function frameToLiveObject(frame: Frame): LiveObject {
  return new LiveObject({ ...frame });
}

function liveObjectToFrame(lo: LiveObject): Frame | null {
  if (typeof lo.toObject !== "function") return null;
  return lo.toObject() as unknown as Frame;
}

// --- initialStorage callback ---

export async function buildInitialStorage(roomId: string): Promise<SerializedCrdt | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("No Supabase credentials — returning null initial storage");
    return null;
  }

  const boardUUID = resolveBoardId(roomId);
  if (!boardUUID) {
    console.warn(`[persistence] skipping non-UUID room "${roomId}"`);
    return null;
  }
  const [objects, frames] = await Promise.all([
    fetchBoardObjects(boardUUID),
    fetchBoardFrames(boardUUID),
  ]);

  // Build CRDT tree: root = LiveObject({ objects: LiveMap, frames: LiveMap })
  const objectsMap = new LiveMap<LiveObject>();
  for (const obj of objects) {
    objectsMap.set(obj.id, boardObjectToLiveObject(obj));
  }

  const framesMap = new LiveMap<LiveObject>();
  if (frames.length > 0) {
    for (const frame of frames) {
      framesMap.set(frame.id, frameToLiveObject(frame));
    }
  } else {
    // Default: single "Frame 1"
    const defaultFrame: Frame = { id: crypto.randomUUID(), index: 0, label: "Frame 1" };
    framesMap.set(defaultFrame.id, frameToLiveObject(defaultFrame));
  }

  const root = new LiveObject({ objects: objectsMap, frames: framesMap });
  const doc = new StorageDocument(root);
  return doc.serialize();
}

// --- onStorageChange callback (debounced per room) ---

interface RoomSnapshot {
  objects: Map<string, BoardObject>;
  frames: Map<string, Frame>;
}

const snapshots = new Map<string, RoomSnapshot>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEBOUNCE_MS = 2000;

function readCurrentState(server: LivelyServer, roomId: string): { objects: Map<string, BoardObject>; frames: Map<string, Frame> } | null {
  const room = server.getRoomManager().get(roomId);
  if (!room || !room.storageInitialized) return null;
  const doc = room.getStorageDocument()!;
  const root = doc.getRoot();

  const objectsMap = root.get("objects") as LiveMap<LiveObject> | undefined;
  const framesMap = root.get("frames") as LiveMap<LiveObject> | undefined;

  const objects = new Map<string, BoardObject>();
  if (objectsMap) {
    objectsMap.forEach((lo: LiveObject, key: string) => {
      const obj = liveObjectToBoardObject(lo);
      if (obj) objects.set(key, obj);
    });
  }

  const frames = new Map<string, Frame>();
  if (framesMap) {
    framesMap.forEach((lo: LiveObject, key: string) => {
      const frame = liveObjectToFrame(lo);
      if (frame) frames.set(key, frame);
    });
  }

  return { objects, frames };
}

async function flushRoom(server: LivelyServer, roomId: string): Promise<void> {
  const boardUUID = resolveBoardId(roomId);
  if (!boardUUID) return;
  const current = readCurrentState(server, roomId);
  if (!current) return;

  const prev = snapshots.get(roomId) || { objects: new Map(), frames: new Map() };

  // --- Diff objects ---
  const toUpsert: BoardObject[] = [];
  const toDelete: string[] = [];

  // New or changed objects
  for (const [id, obj] of current.objects) {
    const prevObj = prev.objects.get(id);
    if (!prevObj || prevObj.updated_at !== obj.updated_at) {
      toUpsert.push(obj);
    }
  }

  // Deleted objects
  for (const id of prev.objects.keys()) {
    if (!current.objects.has(id)) {
      toDelete.push(id);
    }
  }

  // --- Diff frames ---
  const currentFrames = Array.from(current.frames.values()).sort((a, b) => a.index - b.index);
  const prevFrames = Array.from(prev.frames.values()).sort((a, b) => a.index - b.index);
  const framesChanged = currentFrames.length !== prevFrames.length ||
    currentFrames.some((f, i) => f.id !== prevFrames[i]?.id || f.label !== prevFrames[i]?.label || f.index !== prevFrames[i]?.index);

  // --- Persist ---
  const promises: Promise<void>[] = [];
  if (toUpsert.length > 0) promises.push(persistObjects(toUpsert));
  if (toDelete.length > 0) promises.push(deleteObjects(toDelete));
  if (framesChanged) promises.push(persistFrames(boardUUID, currentFrames));

  if (promises.length > 0) {
    await Promise.all(promises);
    console.log(`[persistence] ${roomId}: upserted=${toUpsert.length} deleted=${toDelete.length} framesChanged=${framesChanged}`);
  }

  // Update snapshot cache
  snapshots.set(roomId, current);
}

export function createStorageChangeHandler(server: LivelyServer) {
  return (_roomId: string, _ops: StorageOp[]) => {
    // Debounce per room
    const existing = debounceTimers.get(_roomId);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      _roomId,
      setTimeout(() => {
        debounceTimers.delete(_roomId);
        flushRoom(server, _roomId).catch((e) =>
          console.error(`[persistence] flush error for ${_roomId}:`, e)
        );
      }, DEBOUNCE_MS)
    );
  };
}

export function createLeaveHandler(server: LivelyServer) {
  return (roomId: string, _user: unknown) => {
    const room = server.getRoomManager().get(roomId);
    // If last client disconnected, flush immediately
    if (room && room.size === 0) {
      const timer = debounceTimers.get(roomId);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(roomId);
      }
      flushRoom(server, roomId).catch((e) =>
        console.error(`[persistence] final flush error for ${roomId}:`, e)
      );
    }
  };
}

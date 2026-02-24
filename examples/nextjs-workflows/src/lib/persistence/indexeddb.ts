import type { SerializedCrdt, SerializedLiveObject } from "@waits/lively-types";

const DB_NAME = "lively-cache";
const STORE_NAME = "snapshots";
const DB_VERSION = 1;

/** Bump when CRDT schema changes — stale cache auto-discarded on mismatch. */
export const SCHEMA_VERSION = 1;

interface SnapshotRecord {
  roomId: string;
  data: SerializedCrdt;
  schemaVersion: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "roomId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(
  roomId: string,
  data: SerializedCrdt,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: SnapshotRecord = {
      roomId,
      data,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
    };
    store.put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silent degradation
  }
}

export async function loadSnapshot(
  roomId: string,
): Promise<SerializedLiveObject | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(roomId);
    const record = await new Promise<SnapshotRecord | undefined>(
      (resolve, reject) => {
        req.onsuccess = () => resolve(req.result as SnapshotRecord | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    db.close();

    if (!record || record.schemaVersion !== SCHEMA_VERSION) return null;
    if (
      !record.data ||
      typeof record.data !== "object" ||
      (record.data as SerializedLiveObject).type !== "LiveObject"
    ) {
      return null;
    }
    return record.data as SerializedLiveObject;
  } catch {
    return null;
  }
}

export async function deleteSnapshot(roomId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(roomId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Silent degradation
  }
}

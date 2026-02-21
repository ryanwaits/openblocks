import WebSocket from "ws";
import type { StorageDocument } from "@waits/openblocks-storage";
import type { Doc as YDoc } from "yjs";
import type { Connection, PresenceUser } from "./types.js";
import { LiveStateStore } from "./live-state.js";

export class Room {
  readonly id: string;
  readonly connections: Map<string, Connection> = new Map();
  private _storage: StorageDocument | null = null;
  private _storageInitialized = false;
  storageInitPromise: Promise<void> | null = null;
  private _presenceCache: string | null = null;
  readonly liveState: LiveStateStore = new LiveStateStore();

  // Yjs state
  private _yjsDoc: YDoc | null = null;
  private _yjsInitialized = false;
  yjsInitPromise: Promise<void> | null = null;

  constructor(id: string) {
    this.id = id;
  }

  get storageInitialized(): boolean {
    return this._storageInitialized;
  }

  initStorage(doc: StorageDocument): void {
    this._storage = doc;
    this._storageInitialized = true;
  }

  getStorageDocument(): StorageDocument | null {
    return this._storage;
  }

  addConnection(id: string, ws: WebSocket, user: PresenceUser): void {
    const now = Date.now();
    this.connections.set(id, {
      ws,
      user: {
        ...user,
        onlineStatus: user.onlineStatus ?? "online",
        lastActiveAt: user.lastActiveAt ?? now,
        isIdle: user.isIdle ?? false,
      },
      onlineStatus: "online",
      lastActiveAt: now,
      lastHeartbeat: now,
    });
    this._presenceCache = null;
  }

  removeConnection(id: string): PresenceUser | undefined {
    const conn = this.connections.get(id);
    this.connections.delete(id);
    this._presenceCache = null;
    return conn?.user;
  }

  getPresenceMessage(): string {
    if (!this._presenceCache) {
      this._presenceCache = JSON.stringify({
        type: "presence",
        users: this.getUsers(),
      });
    }
    return this._presenceCache;
  }

  broadcast(data: string, excludeIds?: string[]): void {
    const excluded = excludeIds ? new Set(excludeIds) : undefined;
    for (const [id, conn] of this.connections) {
      if (excluded?.has(id)) continue;
      if (conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.send(data);
        } catch {}
      }
    }
  }

  send(connectionId: string, data: string): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(data);
      } catch {}
    }
  }

  getUsers(): PresenceUser[] {
    return Array.from(this.connections.values()).map((c) => ({
      ...c.user,
      onlineStatus: c.onlineStatus,
      lastActiveAt: c.lastActiveAt,
      isIdle: c.user.isIdle,
      location: c.location ?? c.user.location,
      metadata: c.metadata ?? c.user.metadata,
    }));
  }

  // Yjs accessors
  get yjsInitialized(): boolean {
    return this._yjsInitialized;
  }

  initYjs(doc: YDoc): void {
    this._yjsDoc = doc;
    this._yjsInitialized = true;
  }

  getYjsDoc(): YDoc | null {
    return this._yjsDoc;
  }

  get size(): number {
    return this.connections.size;
  }
}

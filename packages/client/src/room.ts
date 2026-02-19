import type {
  ConnectionStatus,
  PresenceUser,
  CursorData,
  SerializedCrdt,
  StorageOp,
} from "@waits/openblocks-types";
import {
  StorageDocument,
  LiveObject,
  AbstractCrdt,
} from "@waits/openblocks-storage";
import { EventEmitter } from "./event-emitter.js";
import { ConnectionManager } from "./connection.js";

export interface RoomConfig {
  serverUrl: string;
  roomId: string;
  userId: string;
  displayName: string;
  WebSocket?: { new (url: string): WebSocket };
  reconnect?: boolean;
  maxRetries?: number;
  cursorThrottleMs?: number;
  initialStorage?: Record<string, unknown>;
}

type RoomEvents = {
  status: (status: ConnectionStatus) => void;
  presence: (users: PresenceUser[]) => void;
  cursors: (cursors: Map<string, CursorData>) => void;
  message: (message: Record<string, unknown>) => void;
};

export class Room {
  readonly roomId: string;
  private readonly userId: string;
  private readonly connection: ConnectionManager;
  private readonly emitter = new EventEmitter<RoomEvents>();

  private presence: PresenceUser[] = [];
  private cursors = new Map<string, CursorData>();
  private batching = false;
  private batchQueue: string[] = [];
  private batchStorageOps: StorageOp[] = [];

  // Throttle state for updateCursor
  private cursorThrottleMs: number;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCursor: { x: number; y: number } | null = null;
  private lastCursorSend = 0;

  // Storage state
  private storageDoc: StorageDocument | null = null;
  private storageResolvers: Array<(result: { root: LiveObject }) => void> = [];
  private initialStorageData: Record<string, unknown> | undefined;
  private sentStorageInit = false;

  constructor(config: RoomConfig) {
    this.roomId = config.roomId;
    this.userId = config.userId;
    this.cursorThrottleMs = config.cursorThrottleMs ?? 50;
    this.initialStorageData = config.initialStorage;

    const wsScheme = config.serverUrl.replace(/^http/, "ws");
    const base = wsScheme.replace(/\/$/, "");
    const url = `${base}/rooms/${config.roomId}?userId=${encodeURIComponent(config.userId)}&displayName=${encodeURIComponent(config.displayName)}`;

    this.connection = new ConnectionManager({
      url,
      WebSocket: config.WebSocket,
      reconnect: config.reconnect,
      maxRetries: config.maxRetries,
    });

    this.connection.on("status", (status) => {
      if (status === "reconnecting" || status === "disconnected") {
        this.presence = [];
        this.cursors.clear();
      }
      this.emitter.emit("status", status);
    });

    this.connection.on("message", (raw) => {
      this.handleMessage(raw);
    });
  }

  connect(): void {
    this.connection.connect();
  }

  disconnect(): void {
    this.connection.disconnect();
  }

  getStatus(): ConnectionStatus {
    return this.connection.getStatus();
  }

  getSelf(): PresenceUser | null {
    return this.presence.find((u) => u.userId === this.userId) ?? null;
  }

  getPresence(): PresenceUser[] {
    return this.presence;
  }

  getOthers(): PresenceUser[] {
    return this.presence.filter((u) => u.userId !== this.userId);
  }

  getCursors(): Map<string, CursorData> {
    return new Map(this.cursors);
  }

  send(message: { type: string; [key: string]: unknown }): void {
    const data = JSON.stringify(message);
    if (this.batching) {
      this.batchQueue.push(data);
    } else {
      this.connection.send(data);
    }
  }

  updateCursor(x: number, y: number): void {
    const now = Date.now();
    const elapsed = now - this.lastCursorSend;

    if (elapsed >= this.cursorThrottleMs) {
      this.sendCursor(x, y);
    } else {
      this.pendingCursor = { x, y };
      if (!this.cursorTimer) {
        this.cursorTimer = setTimeout(() => {
          this.cursorTimer = null;
          if (this.pendingCursor) {
            this.sendCursor(this.pendingCursor.x, this.pendingCursor.y);
            this.pendingCursor = null;
          }
        }, this.cursorThrottleMs - elapsed);
      }
    }
  }

  batch<T>(fn: () => T): T {
    this.batching = true;
    this.batchStorageOps = [];
    try {
      const result = fn();
      return result;
    } finally {
      this.batching = false;
      // Send queued regular messages
      for (const data of this.batchQueue) {
        this.connection.send(data);
      }
      this.batchQueue = [];
      // Send batched storage ops as single message
      if (this.batchStorageOps.length > 0) {
        this.connection.send(
          JSON.stringify({ type: "storage:ops", ops: this.batchStorageOps })
        );
        this.batchStorageOps = [];
      }
    }
  }

  // --- Storage API ---

  async getStorage(): Promise<{ root: LiveObject }> {
    if (this.storageDoc) {
      return { root: this.storageDoc.getRoot() };
    }
    return new Promise((resolve) => {
      this.storageResolvers.push(resolve);
    });
  }

  subscribe<K extends keyof RoomEvents>(event: K, callback: RoomEvents[K]): () => void;
  subscribe(
    target: AbstractCrdt,
    callback: () => void,
    opts?: { isDeep?: boolean }
  ): () => void;
  subscribe(
    eventOrTarget: string | AbstractCrdt,
    callback: ((...args: any[]) => void),
    opts?: { isDeep?: boolean }
  ): () => void {
    if (typeof eventOrTarget === "string") {
      return this.emitter.on(
        eventOrTarget as keyof RoomEvents,
        callback as RoomEvents[keyof RoomEvents]
      );
    }
    // CRDT subscription
    if (!this.storageDoc) {
      throw new Error("Storage not initialized. Call getStorage() first.");
    }
    return this.storageDoc.subscribe(eventOrTarget, callback, opts);
  }

  // --- Internal ---

  private sendCursor(x: number, y: number): void {
    this.lastCursorSend = Date.now();
    this.send({ type: "cursor:update", x, y });
  }

  private initStorageFromDoc(doc: StorageDocument): void {
    this.storageDoc = doc;
    // Register op callback — local mutations auto-send
    doc.setOnOpsGenerated((ops) => {
      if (this.batching) {
        this.batchStorageOps.push(...ops);
      } else {
        this.connection.send(
          JSON.stringify({ type: "storage:ops", ops })
        );
      }
    });
    // Resolve pending getStorage() calls
    const root = doc.getRoot();
    for (const resolve of this.storageResolvers) {
      resolve({ root });
    }
    this.storageResolvers = [];
  }

  private handleMessage(raw: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof parsed.type !== "string") return;

    // --- Storage message interception (return early) ---

    if (parsed.type === "storage:init") {
      const root = parsed.root as SerializedCrdt | null;
      if (root !== null) {
        if (this.storageDoc && this.sentStorageInit) {
          // Echo of our own init — skip to preserve local root references
          this.sentStorageInit = false;
        } else if (this.storageDoc) {
          // Reconnection — re-hydrate in-place
          this.storageDoc.applySnapshot(root);
        } else {
          const doc = StorageDocument.deserialize(root);
          this.initStorageFromDoc(doc);
        }
      } else {
        // Server has no storage — send initialStorage if available
        if (this.initialStorageData && !this.storageDoc) {
          const rootObj = new LiveObject(this.initialStorageData);
          const doc = new StorageDocument(rootObj);
          this.initStorageFromDoc(doc);
          // Send to server
          this.sentStorageInit = true;
          this.connection.send(
            JSON.stringify({ type: "storage:init", root: doc.serialize() })
          );
        }
      }
      return;
    }

    if (parsed.type === "storage:ops") {
      if (this.storageDoc) {
        const ops = parsed.ops as StorageOp[];
        this.storageDoc.applyOps(ops);
        if (typeof parsed.clock === "number") {
          this.storageDoc._clock.merge(parsed.clock as number);
        }
      }
      return;
    }

    // --- Regular message handling ---

    switch (parsed.type) {
      case "presence":
        this.presence = parsed.users as PresenceUser[];
        // Clean up cursors for disconnected users
        const activeIds = new Set(this.presence.map((u) => u.userId));
        for (const key of this.cursors.keys()) {
          if (!activeIds.has(key)) {
            this.cursors.delete(key);
          }
        }
        this.emitter.emit("presence", this.presence);
        break;

      case "cursor:update": {
        const cursor = parsed.cursor as CursorData;
        if (cursor?.userId) {
          this.cursors.set(cursor.userId, cursor);
          this.emitter.emit("cursors", new Map(this.cursors));
        }
        break;
      }

      default:
        this.emitter.emit("message", parsed);
        break;
    }
  }
}

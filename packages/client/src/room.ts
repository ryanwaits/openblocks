import type {
  ConnectionStatus,
  PresenceUser,
  CursorData,
  SerializedCrdt,
  StorageOp,
  OnlineStatus,
} from "@waits/lively-types";
import {
  StorageDocument,
  LiveObject,
  AbstractCrdt,
  HistoryManager,
} from "@waits/lively-storage";
import { EventEmitter } from "./event-emitter.js";
import { ConnectionManager } from "./connection.js";
import { ActivityTracker } from "./activity-tracker.js";

export interface RoomConfig {
  serverUrl: string;
  roomId: string;
  userId: string;
  displayName: string;
  WebSocket?: { new (url: string): WebSocket };
  reconnect?: boolean;
  maxRetries?: number;
  connectionTimeoutMs?: number;
  cursorThrottleMs?: number;
  initialStorage?: Record<string, unknown>;
  inactivityTime?: number;
  offlineInactivityTime?: number;
  token?: string;
}

type RoomEvents = {
  status: (status: ConnectionStatus) => void;
  presence: (users: PresenceUser[]) => void;
  cursors: (cursors: Map<string, CursorData>) => void;
  message: (message: Record<string, unknown>) => void;
  liveState: (key: string, value: unknown) => void;
  error: (error: Error) => void;
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
  private pendingCursor: { x: number; y: number; viewportPos?: { x: number; y: number }; viewportScale?: number } | null = null;
  private lastCursorSend = 0;

  // Storage state
  private storageDoc: StorageDocument | null = null;
  private storageResolvers: Array<(result: { root: LiveObject }) => void> = [];
  private initialStorageData: Record<string, unknown> | undefined;
  private sentStorageInit = false;
  private _onStorageReset: ((root: LiveObject) => void) | null = null;

  // Activity tracking
  private activityTracker: ActivityTracker;

  // Live state
  private liveStates = new Map<string, { value: unknown; timestamp: number; userId: string }>();
  private liveStateSubscribers = new Map<string, Set<() => void>>();

  constructor(config: RoomConfig) {
    this.roomId = config.roomId;
    this.userId = config.userId;
    this.cursorThrottleMs = Math.max(1, config.cursorThrottleMs ?? 50);
    this.initialStorageData = config.initialStorage;

    const wsScheme = config.serverUrl.replace(/^http/, "ws");
    const base = wsScheme.replace(/\/$/, "");
    let url = `${base}/rooms/${config.roomId}?userId=${encodeURIComponent(config.userId)}&displayName=${encodeURIComponent(config.displayName)}`;
    if (config.token) {
      url += `&token=${encodeURIComponent(config.token)}`;
    }

    this.activityTracker = new ActivityTracker({
      inactivityTime: config.inactivityTime,
      offlineInactivityTime: config.offlineInactivityTime,
    });

    this.connection = new ConnectionManager({
      url,
      WebSocket: config.WebSocket,
      reconnect: config.reconnect,
      maxRetries: config.maxRetries,
      connectionTimeoutMs: config.connectionTimeoutMs,
    });

    this.connection.on("status", (status) => {
      if (status === "reconnecting" || status === "disconnected") {
        this.presence = [];
        this.cursors.clear();
        this.batching = false;
        this.batchQueue = [];
        this.batchStorageOps = [];
        if (this.cursorTimer) {
          clearTimeout(this.cursorTimer);
          this.cursorTimer = null;
        }
        this.pendingCursor = null;
        this.lastCursorSend = 0;
      }
      this.emitter.emit("status", status);
    });

    this.connection.on("message", (raw) => {
      this.handleMessage(raw);
    });

    this.connection.on("error", () => {
      this.emitter.emit("error", new Error("WebSocket error"));
    });
  }

  connect(): void {
    this.connection.connect();
    this.activityTracker.start((status: OnlineStatus) => {
      this.send({
        type: "presence:update",
        onlineStatus: status,
        isIdle: status === "away",
      });
    });
  }

  disconnect(): void {
    this.activityTracker.stop();
    if (this.cursorTimer) {
      clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
    }
    this.pendingCursor = null;
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

  updatePresence(data: {
    location?: string;
    metadata?: Record<string, unknown>;
    onlineStatus?: OnlineStatus;
  }): void {
    this.send({ type: "presence:update", ...data });

    // Optimistic local update so getters (getFollowing, etc.) reflect immediately
    const idx = this.presence.findIndex((u) => u.userId === this.userId);
    if (idx !== -1) {
      const self = { ...this.presence[idx] };
      if ("location" in data) self.location = data.location;
      if ("metadata" in data) {
        self.metadata = { ...((self.metadata as Record<string, unknown>) ?? {}), ...data.metadata };
      }
      if ("onlineStatus" in data) self.onlineStatus = data.onlineStatus;
      this.presence = [...this.presence];
      this.presence[idx] = self as PresenceUser;
      this.emitter.emit("presence", this.presence);
    }
  }

  getOthersOnLocation(locationId: string): PresenceUser[] {
    return this.presence.filter(
      (u) => u.userId !== this.userId && u.location === locationId
    );
  }

  // --- Follow API ---

  followUser(targetUserId: string): void {
    const self = this.getSelf();
    const currentMetadata = (self?.metadata as Record<string, unknown>) ?? {};
    this.updatePresence({ metadata: { ...currentMetadata, following: targetUserId } });
  }

  stopFollowing(): void {
    const self = this.getSelf();
    const currentMetadata = (self?.metadata as Record<string, unknown>) ?? {};
    this.updatePresence({ metadata: { ...currentMetadata, following: null } });
  }

  getFollowing(): string | null {
    const self = this.getSelf();
    const metadata = self?.metadata as Record<string, unknown> | undefined;
    return (metadata?.following as string) ?? null;
  }

  getFollowers(): string[] {
    return this.getOthers()
      .filter((u) => {
        const metadata = u.metadata as Record<string, unknown> | undefined;
        return metadata?.following === this.userId;
      })
      .map((u) => u.userId);
  }

  // --- Live State API ---

  setLiveState(key: string, value: unknown, opts?: { merge?: boolean }): void {
    const timestamp = Date.now();
    this.liveStates.set(key, { value, timestamp, userId: this.userId });
    this.notifyLiveStateSubscribers(key);
    this.send({
      type: "state:update",
      key,
      value,
      timestamp,
      ...(opts?.merge && { merge: true }),
    });
  }

  getLiveState(key: string): unknown | undefined {
    return this.liveStates.get(key)?.value;
  }

  getAllLiveStates(): Map<string, { value: unknown; timestamp: number; userId: string }> {
    return new Map(this.liveStates);
  }

  subscribeLiveState(key: string, cb: () => void): () => void {
    let subs = this.liveStateSubscribers.get(key);
    if (!subs) {
      subs = new Set();
      this.liveStateSubscribers.set(key, subs);
    }
    subs.add(cb);
    return () => {
      subs!.delete(cb);
      if (subs!.size === 0) {
        this.liveStateSubscribers.delete(key);
      }
    };
  }

  // --- Undo/Redo ---

  undo(): void {
    if (!this.storageDoc) return;
    const history = this.storageDoc.getHistory();
    const ops = history.undo();
    if (ops) {
      this.storageDoc.applyLocalOps(ops);
    }
  }

  redo(): void {
    if (!this.storageDoc) return;
    const history = this.storageDoc.getHistory();
    const ops = history.redo();
    if (ops) {
      this.storageDoc.applyLocalOps(ops);
    }
  }

  getHistory(): HistoryManager | null {
    return this.storageDoc?.getHistory() ?? null;
  }

  send(message: { type: string; [key: string]: unknown }): void {
    const data = JSON.stringify(message);
    if (this.batching) {
      this.batchQueue.push(data);
    } else {
      this.connection.send(data);
    }
  }

  updateCursor(x: number, y: number, viewportPos?: { x: number; y: number }, viewportScale?: number): void {
    const now = Date.now();
    const elapsed = now - this.lastCursorSend;

    if (elapsed >= this.cursorThrottleMs) {
      this.sendCursor(x, y, viewportPos, viewportScale);
    } else {
      this.pendingCursor = { x, y, viewportPos, viewportScale };
      if (!this.cursorTimer) {
        this.cursorTimer = setTimeout(() => {
          this.cursorTimer = null;
          if (this.pendingCursor) {
            const { x: px, y: py, viewportPos: pvp, viewportScale: pvs } = this.pendingCursor;
            this.sendCursor(px, py, pvp, pvs);
            this.pendingCursor = null;
          }
        }, this.cursorThrottleMs - elapsed);
      }
    }
  }

  batch<T>(fn: () => T): T {
    this.batching = true;
    this.batchStorageOps = [];
    const history = this.storageDoc?.getHistory();
    history?.startBatch();
    try {
      const result = fn();
      return result;
    } finally {
      history?.endBatch();
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

  /** Returns the current storage root, or null if storage hasn't loaded yet. */
  getCurrentRoot(): LiveObject | null {
    return this.storageDoc?.getRoot() ?? null;
  }

  /**
   * Register a callback invoked when the storage root is replaced after
   * a reconnection snapshot. Returns an unsubscribe function.
   */
  onStorageReset(cb: (root: LiveObject) => void): () => void {
    this._onStorageReset = cb;
    return () => {
      if (this._onStorageReset === cb) this._onStorageReset = null;
    };
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

  private sendCursor(x: number, y: number, viewportPos?: { x: number; y: number }, viewportScale?: number): void {
    this.lastCursorSend = Date.now();
    const msg: Record<string, unknown> = { type: "cursor:update", x, y };
    if (viewportPos) msg.viewportPos = viewportPos;
    if (viewportScale !== undefined) msg.viewportScale = viewportScale;
    this.send(msg as { type: string; [key: string]: unknown });
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

  private notifyLiveStateSubscribers(key: string): void {
    const subs = this.liveStateSubscribers.get(key);
    if (subs) {
      for (const cb of subs) {
        cb();
      }
    }
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
          this._onStorageReset?.(this.storageDoc.getRoot());
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

    // --- Live state message handling ---

    if (parsed.type === "state:init") {
      const states = parsed.states as Record<string, { value: unknown; timestamp: number; userId: string }>;
      if (states) {
        for (const [key, entry] of Object.entries(states)) {
          this.liveStates.set(key, entry);
          this.notifyLiveStateSubscribers(key);
        }
      }
      return;
    }

    if (parsed.type === "state:update") {
      const key = parsed.key as string;
      const value = parsed.value;
      const timestamp = parsed.timestamp as number;
      const userId = parsed.userId as string;
      const existing = this.liveStates.get(key);
      if (!existing || timestamp >= existing.timestamp) {
        this.liveStates.set(key, { value, timestamp, userId });
        this.notifyLiveStateSubscribers(key);
        this.emitter.emit("liveState", key, value);
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

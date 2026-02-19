import type {
  ConnectionStatus,
  PresenceUser,
  CursorData,
} from "@waits/openblocks-types";
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

  // Throttle state for updateCursor
  private cursorThrottleMs: number;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCursor: { x: number; y: number } | null = null;
  private lastCursorSend = 0;

  constructor(config: RoomConfig) {
    this.roomId = config.roomId;
    this.userId = config.userId;
    this.cursorThrottleMs = config.cursorThrottleMs ?? 50;

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

  batch(fn: () => void): void {
    this.batching = true;
    try {
      fn();
    } finally {
      this.batching = false;
      for (const data of this.batchQueue) {
        this.connection.send(data);
      }
      this.batchQueue = [];
    }
  }

  subscribe<K extends keyof RoomEvents>(event: K, callback: RoomEvents[K]): () => void {
    return this.emitter.on(event, callback);
  }

  private sendCursor(x: number, y: number): void {
    this.lastCursorSend = Date.now();
    this.send({ type: "cursor:update", x, y });
  }

  private handleMessage(raw: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof parsed.type !== "string") return;

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

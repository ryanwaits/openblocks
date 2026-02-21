import http from "node:http";
import type net from "node:net";
import { URL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { StorageDocument, LiveObject } from "@waits/openblocks-storage";
import type { StorageOp, SerializedCrdt } from "@waits/openblocks-types";
import { Room } from "./room.js";
import { RoomManager } from "./room-manager.js";
import type {
  ServerConfig,
  PresenceUser,
  CursorData,
  OnMessageHandler,
  OnJoinHandler,
  OnLeaveHandler,
  OnStorageChangeHandler,
  InitialStorageHandler,
  AuthHandler,
} from "./types.js";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function colorForUser(userId: string): string {
  return COLORS[Math.abs(hashCode(userId)) % COLORS.length];
}

const DEFAULT_PATH = "/rooms";
const DEFAULT_CLEANUP_MS = 30_000;

export class OpenBlocksServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private roomManager = new RoomManager();

  private path: string;
  private auth?: AuthHandler;
  private cleanupTimeoutMs: number;
  private maxConnections?: number;
  private onMessage?: OnMessageHandler;
  private onJoin?: OnJoinHandler;
  private onLeave?: OnLeaveHandler;
  private onStorageChange?: OnStorageChangeHandler;
  private initialStorage?: InitialStorageHandler;

  // Map ws instance → { roomId, connectionId } for close handler
  private wsMetadata = new WeakMap<
    WebSocket,
    { roomId: string; connectionId: string }
  >();

  private heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatTimeoutMs = 45_000;
  private readonly heartbeatCheckIntervalMs = 15_000;

  // Map req → upgrade metadata (avoids `any` cast on req)
  private reqMetadata = new WeakMap<
    http.IncomingMessage,
    { roomId: string; userId?: string; displayName?: string }
  >();

  // Track raw sockets for clean shutdown
  private sockets = new Set<net.Socket>();

  constructor(config: ServerConfig = {}) {
    this.path = config.path ?? DEFAULT_PATH;
    this.auth = config.auth;
    this.cleanupTimeoutMs =
      config.roomConfig?.cleanupTimeoutMs ?? DEFAULT_CLEANUP_MS;
    this.maxConnections = config.roomConfig?.maxConnections;
    this.onMessage = config.onMessage;
    this.onJoin = config.onJoin;
    this.onLeave = config.onLeave;
    this.onStorageChange = config.onStorageChange;
    this.initialStorage = config.initialStorage;

    this.httpServer = http.createServer((_req, res) => {
      res.writeHead(426);
      res.end("Upgrade required");
    });

    this.httpServer.on("connection", (socket) => {
      this.sockets.add(socket);
      socket.once("close", () => this.sockets.delete(socket));
    });

    this.wss = new WebSocketServer({ noServer: true });

    this.httpServer.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    this.wss.on("connection", (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  /** Start listening on the configured port (0 = random). */
  start(port?: number): Promise<void> {
    const p = port ?? 0;
    return new Promise((resolve, reject) => {
      this.httpServer.listen(p, () => {
        this.startHeartbeatCheck();
        resolve();
      });
      this.httpServer.once("error", reject);
    });
  }

  /** Gracefully close all connections and stop listening. */
  async stop(): Promise<void> {
    this.stopHeartbeatCheck();

    // Terminate all WebSocket connections
    for (const ws of this.wss.clients) {
      ws.terminate();
    }

    // Close the WebSocket server
    this.wss.close();

    // Destroy all tracked raw TCP sockets
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();

    // Close the HTTP server — use closeAllConnections for stragglers
    if (this.httpServer.listening) {
      this.httpServer.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
        // Safety: resolve after a short delay if close() hangs (Bun compat)
        setTimeout(resolve, 100);
      });
    }
  }

  /** The port the server is listening on. Returns -1 if not listening. */
  get port(): number {
    const addr = this.httpServer.address();
    if (addr && typeof addr === "object") return addr.port;
    return -1;
  }

  /**
   * Push data into a room from outside the WebSocket flow (e.g., HTTP API).
   * Returns false if room doesn't exist.
   */
  broadcastToRoom(
    roomId: string,
    data: string,
    excludeIds?: string[]
  ): boolean {
    const room = this.roomManager.get(roomId);
    if (!room) return false;
    room.broadcast(data, excludeIds);
    return true;
  }

  /**
   * Mutate storage from the server side. Runs callback against the live root,
   * collects generated ops, and broadcasts them to all connected clients.
   * Returns false if the room doesn't exist or storage isn't initialized.
   */
  async mutateStorage(roomId: string, callback: (root: LiveObject) => void): Promise<boolean> {
    const room = this.roomManager.get(roomId);
    if (!room || !room.storageInitialized) return false;

    const doc = room.getStorageDocument()!;
    const collected: StorageOp[] = [];

    doc.setOnOpsGenerated((ops) => collected.push(...ops));
    const history = doc.getHistory();
    history.pause();

    try {
      callback(doc.getRoot());
    } finally {
      history.resume();
      doc.setOnOpsGenerated(() => {});
    }

    if (collected.length > 0) {
      room.broadcast(
        JSON.stringify({ type: "storage:ops", ops: collected, clock: doc._clock.value })
      );
    }

    return true;
  }

  /** Return all users currently connected to a room. */
  getRoomUsers(roomId: string): PresenceUser[] {
    const room = this.roomManager.get(roomId);
    return room?.getUsers() ?? [];
  }

  /**
   * Set a live-state key from the server side. Broadcasts the update to all
   * clients with userId "__server__". Returns false if the room doesn't exist.
   */
  setLiveState(roomId: string, key: string, value: unknown): boolean {
    const room = this.roomManager.get(roomId);
    if (!room) return false;
    const timestamp = Date.now();
    const accepted = room.liveState.set(key, value, timestamp, "__server__");
    if (accepted) {
      room.broadcast(
        JSON.stringify({
          type: "state:update",
          key,
          value: room.liveState.get(key)!.value,
          timestamp: room.liveState.get(key)!.timestamp,
          userId: "__server__",
        })
      );
    }
    return accepted;
  }

  /** Expose room manager for advanced use. */
  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  // ── Upgrade ──────────────────────────────────────────────

  private async handleUpgrade(
    req: http.IncomingMessage,
    socket: import("node:stream").Duplex,
    head: Buffer
  ): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathPrefix = this.path.endsWith("/") ? this.path : this.path + "/";

    // Expect URL like /rooms/{roomId}
    if (!url.pathname.startsWith(pathPrefix)) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    const roomId = url.pathname.slice(pathPrefix.length).split("/")[0];
    if (!roomId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    // Auth
    let userId: string | undefined;
    let displayName: string | undefined;

    if (this.auth) {
      try {
        const result = await this.auth.authenticate(req);
        if (!result) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        userId = result.userId;
        displayName = result.displayName;
      } catch {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    } else {
      // Fallback: query params
      userId = url.searchParams.get("userId") ?? undefined;
      displayName = url.searchParams.get("displayName") ?? undefined;
    }

    // Max connections check
    const room = this.roomManager.getOrCreate(roomId);
    if (this.maxConnections && room.size >= this.maxConnections) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }

    // Stash info for the connection handler
    this.reqMetadata.set(req, { roomId, userId, displayName });

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  // ── Connection lifecycle ─────────────────────────────────

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const meta = this.reqMetadata.get(req)!;

    const connectionId = crypto.randomUUID();
    const userId = meta.userId || connectionId;
    const displayName = meta.displayName || "Anonymous";
    const color = colorForUser(userId);

    const now = Date.now();
    const user: PresenceUser = {
      userId,
      displayName,
      color,
      connectedAt: now,
      onlineStatus: "online",
      lastActiveAt: now,
      isIdle: false,
    };

    const room = this.roomManager.getOrCreate(meta.roomId);
    room.addConnection(connectionId, ws, user);
    this.wsMetadata.set(ws, { roomId: meta.roomId, connectionId });

    // Broadcast updated presence to all in room
    this.broadcastPresence(room);

    // Send storage snapshot to new connection
    if (room.storageInitialized) {
      const doc = room.getStorageDocument()!;
      room.send(
        connectionId,
        JSON.stringify({ type: "storage:init", root: doc.serialize() })
      );
    } else if (this.initialStorage) {
      // Guard: only first caller runs initialStorage; others wait
      if (!room.storageInitPromise) {
        room.storageInitPromise = Promise.resolve(this.initialStorage(meta.roomId))
          .then((data) => {
            if (data && !room.storageInitialized) {
              const doc = StorageDocument.deserialize(data);
              room.initStorage(doc);
              room.broadcast(
                JSON.stringify({ type: "storage:init", root: doc.serialize() })
              );
            } else if (!room.storageInitialized) {
              room.broadcast(
                JSON.stringify({ type: "storage:init", root: null })
              );
            }
          })
          .catch(() => {
            room.broadcast(
              JSON.stringify({ type: "storage:init", root: null })
            );
          });
      } else {
        // Subsequent caller: wait for init, then send existing storage
        room.storageInitPromise.then(() => {
          if (room.storageInitialized) {
            const doc = room.getStorageDocument()!;
            room.send(
              connectionId,
              JSON.stringify({ type: "storage:init", root: doc.serialize() })
            );
          } else {
            room.send(
              connectionId,
              JSON.stringify({ type: "storage:init", root: null })
            );
          }
        });
      }
    } else {
      // No storage — tell client
      room.send(
        connectionId,
        JSON.stringify({ type: "storage:init", root: null })
      );
    }

    // Send live state snapshot
    const allStates = room.liveState.getAll();
    if (Object.keys(allStates).length > 0) {
      room.send(
        connectionId,
        JSON.stringify({ type: "state:init", states: allStates })
      );
    }

    // Fire onJoin callback
    if (this.onJoin) {
      Promise.resolve(this.onJoin(meta.roomId, user)).catch(() => {});
    }

    // ── Message handling ──
    ws.on("message", (raw) => {
      this.handleMessage(meta.roomId, connectionId, raw);
    });

    // ── Error handling — prevent unhandled 'error' from crashing ──
    ws.on("error", () => {});

    // ── Close handling ──
    ws.on("close", () => {
      this.handleClose(ws);
    });
  }

  private handleMessage(
    roomId: string,
    connectionId: string,
    raw: import("ws").RawData
  ): void {
    const room = this.roomManager.get(roomId);
    if (!room) return;

    const conn = room.connections.get(connectionId);
    if (!conn) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return; // ignore malformed messages
    }

    if (typeof parsed.type !== "string") return; // enforce envelope

    // --- Storage message interception (return early to prevent relay) ---

    if (parsed.type === "storage:init") {
      if (!room.storageInitialized) {
        const root = parsed.root as SerializedCrdt;
        if (
          root !== null &&
          (typeof root !== "object" || !("type" in root))
        ) {
          return; // invalid root shape
        }
        if (root) {
          const doc = StorageDocument.deserialize(root);
          room.initStorage(doc);
          room.broadcast(
            JSON.stringify({ type: "storage:init", root: doc.serialize() })
          );
        }
      }
      // If already initialized, ignore (race condition guard)
      return;
    }

    if (parsed.type === "storage:ops") {
      if (!Array.isArray(parsed.ops) || parsed.ops.length === 0) {
        return; // invalid ops
      }
      if (!room.storageInitialized) {
        return;
      }
      const ops = parsed.ops as StorageOp[];
      const doc = room.getStorageDocument()!;
      doc.applyOps(ops);
      const clock = doc._clock.value;
      room.broadcast(
        JSON.stringify({ type: "storage:ops", ops, clock })
      );
      if (this.onStorageChange) {
        Promise.resolve(this.onStorageChange(roomId, ops)).catch(() => {});
      }
      return;
    }

    if (parsed.type === "state:update") {
      const key = parsed.key as string;
      const value = parsed.value;
      const timestamp = parsed.timestamp as number;
      const merge = parsed.merge as boolean | undefined;
      if (!key || typeof timestamp !== "number") return;

      const accepted = room.liveState.set(key, value, timestamp, conn.user.userId, merge);
      if (accepted) {
        // Broadcast to all including sender (with userId)
        room.broadcast(
          JSON.stringify({
            type: "state:update",
            key,
            value: room.liveState.get(key)!.value,
            timestamp: room.liveState.get(key)!.timestamp,
            userId: conn.user.userId,
          })
        );
      }
      return;
    }

    if (parsed.type === "heartbeat") {
      conn.lastHeartbeat = Date.now();
      conn.lastActiveAt = Date.now();
      return;
    }

    if (parsed.type === "presence:update") {
      if (parsed.onlineStatus !== undefined) {
        conn.onlineStatus = parsed.onlineStatus as any;
        conn.user.onlineStatus = parsed.onlineStatus as any;
      }
      if (parsed.isIdle !== undefined) {
        conn.user.isIdle = parsed.isIdle as boolean;
      }
      if (parsed.location !== undefined) {
        conn.location = parsed.location as string;
        conn.user.location = parsed.location as string;
      }
      if (parsed.metadata !== undefined) {
        conn.metadata = parsed.metadata as Record<string, unknown>;
        conn.user.metadata = parsed.metadata as Record<string, unknown>;
      }
      conn.lastActiveAt = Date.now();
      conn.user.lastActiveAt = Date.now();
      room["_presenceCache"] = null; // invalidate cache
      this.broadcastPresence(room);
      return;
    }

    if (parsed.type === "cursor:update") {
      if (
        typeof parsed.x !== "number" ||
        !isFinite(parsed.x) ||
        typeof parsed.y !== "number" ||
        !isFinite(parsed.y)
      ) {
        return; // invalid cursor data
      }
      const vp = parsed.viewportPos as { x: number; y: number } | undefined;
      const vs = parsed.viewportScale as number | undefined;
      const isValidVp = vp && typeof vp.x === "number" && isFinite(vp.x) && typeof vp.y === "number" && isFinite(vp.y);
      const isValidVs = typeof vs === "number" && isFinite(vs);
      const cursor: CursorData = {
        userId: conn.user.userId,
        displayName: conn.user.displayName,
        color: conn.user.color,
        x: parsed.x as number,
        y: parsed.y as number,
        lastUpdate: Date.now(),
        ...(isValidVp && { viewportPos: vp }),
        ...(isValidVs && { viewportScale: vs }),
      };
      room.broadcast(
        JSON.stringify({ type: "cursor:update", cursor }),
        [connectionId]
      );
      return;
    }

    // Custom message → callback + relay
    if (this.onMessage) {
      Promise.resolve(
        this.onMessage(roomId, conn.user.userId, parsed)
      ).catch(() => {});
    }

    room.broadcast(JSON.stringify(parsed), [connectionId]);
  }

  private handleClose(ws: WebSocket): void {
    const meta = this.wsMetadata.get(ws);
    if (!meta) return;

    const room = this.roomManager.get(meta.roomId);
    if (!room) return;

    const user = room.removeConnection(meta.connectionId);

    if (user && this.onLeave) {
      Promise.resolve(this.onLeave(meta.roomId, user)).catch(() => {});
    }

    if (room.size === 0) {
      this.roomManager.scheduleCleanup(meta.roomId, this.cleanupTimeoutMs);
    }

    // Broadcast updated presence
    this.broadcastPresence(room);
  }

  private broadcastPresence(room: Room): void {
    room.broadcast(room.getPresenceMessage());
  }

  private startHeartbeatCheck(): void {
    this.heartbeatCheckTimer = setInterval(() => {
      const now = Date.now();
      for (const room of this.roomManager.all()) {
        let changed = false;
        for (const [, conn] of room.connections) {
          if (
            conn.onlineStatus !== "offline" &&
            now - conn.lastHeartbeat > this.heartbeatTimeoutMs
          ) {
            conn.onlineStatus = "offline";
            conn.user.onlineStatus = "offline";
            room["_presenceCache"] = null;
            changed = true;
          }
        }
        if (changed) {
          this.broadcastPresence(room);
        }
      }
    }, this.heartbeatCheckIntervalMs);
  }

  private stopHeartbeatCheck(): void {
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer);
      this.heartbeatCheckTimer = null;
    }
  }
}

import http from "node:http";
import type net from "node:net";
import { URL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { StorageDocument } from "@waits/openblocks-storage";
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
      this.httpServer.listen(p, () => resolve());
      this.httpServer.once("error", reject);
    });
  }

  /** Gracefully close all connections and stop listening. */
  async stop(): Promise<void> {
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

    // Stash info for the connection handler via headers
    (req as any).__ob = { roomId, userId, displayName };

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  // ── Connection lifecycle ─────────────────────────────────

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const meta = (req as any).__ob as {
      roomId: string;
      userId?: string;
      displayName?: string;
    };

    const connectionId = crypto.randomUUID();
    const userId = meta.userId || connectionId;
    const displayName = meta.displayName || "Anonymous";
    const color = colorForUser(userId);

    const user: PresenceUser = {
      userId,
      displayName,
      color,
      connectedAt: Date.now(),
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
      // Seed room from callback if available
      Promise.resolve(this.initialStorage(meta.roomId))
        .then((data) => {
          if (data && !room.storageInitialized) {
            const doc = StorageDocument.deserialize(data);
            room.initStorage(doc);
            // Send to all connections in room (could have more by now)
            room.broadcast(
              JSON.stringify({ type: "storage:init", root: doc.serialize() })
            );
          } else if (!room.storageInitialized) {
            // No storage yet — tell client
            room.send(
              connectionId,
              JSON.stringify({ type: "storage:init", root: null })
            );
          }
        })
        .catch(() => {
          room.send(
            connectionId,
            JSON.stringify({ type: "storage:init", root: null })
          );
        });
    } else {
      // No storage — tell client
      room.send(
        connectionId,
        JSON.stringify({ type: "storage:init", root: null })
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
      if (!room.storageInitialized) {
        // Storage not initialized — drop ops
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

    if (parsed.type === "cursor:update") {
      const cursor: CursorData = {
        userId: conn.user.userId,
        displayName: conn.user.displayName,
        color: conn.user.color,
        x: parsed.x as number,
        y: parsed.y as number,
        lastUpdate: Date.now(),
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
    const users = room.getUsers();
    room.broadcast(JSON.stringify({ type: "presence", users }));
  }
}

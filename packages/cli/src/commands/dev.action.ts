import { OpenBlocksServer } from "@waits/openblocks-server";
import ora from "ora";
import { RoomPersistence } from "../persistence.js";
import {
  printBanner,
  logJoin,
  logLeave,
  logStorageChange,
  logRoomCreated,
} from "../logger.js";

interface DevServerOpts {
  port: number;
  dataDir: string;
  reset: boolean;
}

export async function startDevServer(opts: DevServerOpts): Promise<void> {
  const persistence = new RoomPersistence(opts.dataDir);

  if (opts.reset) {
    await persistence.reset();
  }
  await persistence.ensureDir();

  const seenRooms = new Set<string>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const server = new OpenBlocksServer({
    initialStorage: async (roomId) => {
      return persistence.load(roomId);
    },
    onStorageChange: (roomId, ops) => {
      // Clear existing timer for this room
      const existing = debounceTimers.get(roomId);
      if (existing) clearTimeout(existing);

      // Debounce: coalesce writes within 200ms
      const timer = setTimeout(async () => {
        debounceTimers.delete(roomId);
        const room = server.getRoomManager().get(roomId);
        const doc = room?.getStorageDocument();
        if (!doc) return;
        await persistence.save(roomId, doc.serialize());
        logStorageChange(roomId, ops.length);
      }, 200);

      debounceTimers.set(roomId, timer);
    },
    onJoin: (roomId, user) => {
      if (!seenRooms.has(roomId)) {
        seenRooms.add(roomId);
        logRoomCreated(roomId);
      }
      logJoin(roomId, user.displayName ?? user.id);
    },
    onLeave: (roomId, user) => {
      logLeave(roomId, user.displayName ?? user.id);
    },
  });

  const spinner = ora("Starting dev server...").start();
  await server.start(opts.port);
  spinner.succeed("Dev server running");

  printBanner(server.port, opts.dataDir);

  // Flush all pending debounced writes
  async function flushAll(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const [roomId, timer] of debounceTimers) {
      clearTimeout(timer);
      debounceTimers.delete(roomId);
      const room = server.getRoomManager().get(roomId);
      const doc = room?.getStorageDocument();
      if (doc) {
        pending.push(persistence.save(roomId, doc.serialize()));
      }
    }
    await Promise.all(pending);
  }

  async function shutdown(): Promise<void> {
    console.log("\nShutting down...");
    await flushAll();
    await server.stop();
    process.exit(0);
  }

  // Keyboard shortcuts (raw mode)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", async (key: string) => {
      if (key === "q" || key === "\u0003") {
        // q or Ctrl+C
        await shutdown();
      } else if (key === "c") {
        console.clear();
        printBanner(server.port, opts.dataDir);
      }
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

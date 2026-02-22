import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LivelyServer } from "@waits/lively-server";

const PORT = parseInt(process.env.LIVELY_PORT || "2003", 10);
const DATA_DIR = join(import.meta.dir, "../.lively");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

function yjsPath(roomId: string): string {
  return join(DATA_DIR, `${roomId}.yjs`);
}

const server = new LivelyServer({
  path: "/rooms",
  initialYjs: async (roomId: string) => {
    const path = yjsPath(roomId);
    if (existsSync(path)) {
      console.log(`[markdown] Loading Yjs state for room ${roomId}`);
      return new Uint8Array(readFileSync(path));
    }
    return null;
  },
  onYjsChange: (roomId: string, state: Uint8Array) => {
    writeFileSync(yjsPath(roomId), state);
  },
  onJoin: (roomId, user) => {
    console.log(`[markdown] join: ${user.displayName} → room ${roomId}`);
  },
  onLeave: (roomId, user) => {
    console.log(`[markdown] leave: ${user.displayName} ← room ${roomId}`);
  },
});

await server.start(PORT);
console.log(`[markdown] Server listening on :${server.port}`);

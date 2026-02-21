import fs from "node:fs/promises";
import path from "node:path";
import type { SerializedCrdt } from "@waits/openblocks-types";

interface RoomFileData {
  root: SerializedCrdt;
  updatedAt: number;
}

export interface RoomInfo {
  roomId: string;
  updatedAt: number;
  sizeBytes: number;
}

export class RoomPersistence {
  private roomsDir: string;

  constructor(dataDir: string) {
    this.roomsDir = path.join(dataDir, "rooms");
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.roomsDir, { recursive: true });
  }

  async load(roomId: string): Promise<SerializedCrdt | null> {
    const filePath = this.filePath(roomId);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data: RoomFileData = JSON.parse(raw);
      return data.root ?? null;
    } catch {
      return null;
    }
  }

  async save(roomId: string, root: SerializedCrdt): Promise<void> {
    await this.ensureDir();
    const data: RoomFileData = { root, updatedAt: Date.now() };
    await fs.writeFile(this.filePath(roomId), JSON.stringify(data, null, 2));
  }

  async reset(): Promise<void> {
    await fs.rm(this.roomsDir, { recursive: true, force: true });
  }

  async list(): Promise<RoomInfo[]> {
    try {
      const files = await fs.readdir(this.roomsDir);
      const results: RoomInfo[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const filePath = path.join(this.roomsDir, file);
        const stat = await fs.stat(filePath);
        const roomId = file.replace(/\.json$/, "");
        const raw = await fs.readFile(filePath, "utf-8");
        const data: RoomFileData = JSON.parse(raw);
        results.push({
          roomId,
          updatedAt: data.updatedAt,
          sizeBytes: stat.size,
        });
      }
      return results;
    } catch {
      return [];
    }
  }

  async delete(roomId: string): Promise<void> {
    await fs.rm(this.filePath(roomId), { force: true });
  }

  async exists(roomId: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(roomId));
      return true;
    } catch {
      return false;
    }
  }

  private filePath(roomId: string): string {
    return path.join(this.roomsDir, `${sanitize(roomId)}.json`);
  }
}

export function sanitize(roomId: string): string {
  return roomId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

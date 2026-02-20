import { Room } from "./room.js";

export class RoomManager {
  readonly rooms: Map<string, Room> = new Map();
  private cleanupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  getOrCreate(roomId: string): Room {
    this.cancelCleanup(roomId);
    let room = this.rooms.get(roomId);
    if (!room) {
      room = new Room(roomId);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  remove(roomId: string): void {
    this.cancelCleanup(roomId);
    this.rooms.delete(roomId);
  }

  scheduleCleanup(roomId: string, timeoutMs: number): void {
    this.cancelCleanup(roomId);
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(roomId);
      const room = this.rooms.get(roomId);
      if (room && room.size === 0) {
        this.rooms.delete(roomId);
      }
    }, timeoutMs);
    this.cleanupTimers.set(roomId, timer);
  }

  all(): IterableIterator<Room> {
    return this.rooms.values();
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  private cancelCleanup(roomId: string): void {
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
    }
  }
}

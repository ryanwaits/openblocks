import { Room } from "./room.js";
import type { RoomConfig } from "./room.js";

export interface ClientConfig {
  serverUrl: string;
  WebSocket?: { new (url: string): WebSocket };
  reconnect?: boolean;
  maxRetries?: number;
}

export interface JoinRoomOptions {
  userId: string;
  displayName: string;
  cursorThrottleMs?: number;
}

export class OpenBlocksClient {
  private readonly config: ClientConfig;
  private readonly rooms = new Map<string, Room>();

  constructor(config: ClientConfig) {
    this.config = config;
  }

  joinRoom(roomId: string, options: JoinRoomOptions): Room {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const room = new Room({
      serverUrl: this.config.serverUrl,
      roomId,
      userId: options.userId,
      displayName: options.displayName,
      WebSocket: this.config.WebSocket,
      reconnect: this.config.reconnect,
      maxRetries: this.config.maxRetries,
      cursorThrottleMs: options.cursorThrottleMs,
    });

    this.rooms.set(roomId, room);
    room.connect();
    return room;
  }

  leaveRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.disconnect();
    this.rooms.delete(roomId);
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getRooms(): Room[] {
    return Array.from(this.rooms.values());
  }
}

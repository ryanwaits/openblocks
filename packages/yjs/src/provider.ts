import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import type { Room } from "@waits/openblocks-client";

export interface OpenBlocksYjsProviderOptions {
  /** Existing Y.Doc to use. If omitted, a new one is created. */
  doc?: Y.Doc;
}

function encodeUpdate(data: Uint8Array): string {
  // Avoid spread for large arrays (stack overflow)
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

function decodeUpdate(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type ProviderEvent = "sync" | "awareness-update" | "status";
type EventCallback = (...args: unknown[]) => void;

export class OpenBlocksYjsProvider {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  private readonly room: Room;
  private _synced = false;
  private _connected = false;
  private _destroyed = false;

  private unsubMessage: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;
  private docUpdateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;
  private awarenessUpdateHandler: (({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => void) | null = null;

  private eventListeners = new Map<ProviderEvent, Set<EventCallback>>();

  constructor(room: Room, options?: OpenBlocksYjsProviderOptions) {
    this.room = room;
    this.doc = options?.doc ?? new Y.Doc();
    this.awareness = new Awareness(this.doc);
  }

  get synced(): boolean {
    return this._synced;
  }

  get connected(): boolean {
    return this._connected;
  }

  on(event: ProviderEvent, callback: EventCallback): void {
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(callback);
  }

  off(event: ProviderEvent, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: ProviderEvent, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(...args));
  }

  connect(): void {
    if (this._destroyed || this._connected) return;
    this._connected = true;

    // Listen for incoming messages from the room
    this.unsubMessage = this.room.subscribe("message", (message: Record<string, unknown>) => {
      if (this._destroyed) return;
      this.handleMessage(message);
    });

    // Listen for room connection status to (re-)initiate sync
    this.unsubStatus = this.room.subscribe("status", (status: string) => {
      if (this._destroyed) return;
      if (status === "connected") {
        this._synced = false;
        this.sendSyncStep1();
      }
    });

    // Listen for local Y.Doc updates → send to room
    this.docUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (this._destroyed || origin === this) return; // skip remote-applied updates
      this.room.send({
        type: "yjs:update",
        data: encodeUpdate(update),
      });
    };
    this.doc.on("update", this.docUpdateHandler);

    // Listen for local awareness updates → send to room
    this.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
      if (this._destroyed || origin === "remote") return;
      const changedClients = added.concat(updated).concat(removed);
      const encoded = encodeAwarenessUpdate(this.awareness, changedClients);
      this.room.send({
        type: "yjs:awareness",
        data: encodeUpdate(encoded),
      });
    };
    this.awareness.on("update", this.awarenessUpdateHandler);

    // Try to initiate sync now (if already connected, it works; if not, status listener handles it)
    this.sendSyncStep1();
  }

  disconnect(): void {
    if (!this._connected) return;
    this._connected = false;
    this._synced = false;

    // Remove awareness states for local client
    removeAwarenessStates(this.awareness, [this.doc.clientID], this);

    // Unsubscribe
    this.unsubMessage?.();
    this.unsubMessage = null;
    this.unsubStatus?.();
    this.unsubStatus = null;

    if (this.docUpdateHandler) {
      this.doc.off("update", this.docUpdateHandler);
      this.docUpdateHandler = null;
    }

    if (this.awarenessUpdateHandler) {
      this.awareness.off("update", this.awarenessUpdateHandler);
      this.awarenessUpdateHandler = null;
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.disconnect();
    this.awareness.destroy();
    this.eventListeners.clear();
  }

  private sendSyncStep1(): void {
    const stateVector = Y.encodeStateVector(this.doc);
    this.room.send({
      type: "yjs:sync-step1",
      data: encodeUpdate(stateVector),
    });
  }

  private handleMessage(message: Record<string, unknown>): void {
    const type = message.type as string;
    const data = message.data as string;

    switch (type) {
      case "yjs:update": {
        if (typeof data !== "string") return;
        const update = decodeUpdate(data);
        Y.applyUpdate(this.doc, update, this); // origin=this to prevent echo
        break;
      }

      case "yjs:sync-step1": {
        // Peer is requesting sync — send our diff
        if (typeof data !== "string") return;
        const stateVector = decodeUpdate(data);
        const diff = Y.encodeStateAsUpdate(this.doc, stateVector);
        this.room.send({
          type: "yjs:sync-step2",
          data: encodeUpdate(diff),
        });
        break;
      }

      case "yjs:sync-step2": {
        // Received diff — apply and mark synced
        if (typeof data !== "string") return;
        const update = decodeUpdate(data);
        Y.applyUpdate(this.doc, update, this);
        if (!this._synced) {
          this._synced = true;
          this.emit("sync", true);
        }
        break;
      }

      case "yjs:awareness": {
        if (typeof data !== "string") return;
        const update = decodeUpdate(data);
        applyAwarenessUpdate(this.awareness, update, "remote");
        this.emit("awareness-update");
        break;
      }
    }
  }
}

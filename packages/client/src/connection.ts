import type { ConnectionStatus } from "@waits/openblocks-types";
import { EventEmitter } from "./event-emitter.js";

export interface ConnectionConfig {
  url: string;
  WebSocket?: { new (url: string): WebSocket };
  reconnect?: boolean;
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

type ConnectionEvents = {
  status: (status: ConnectionStatus) => void;
  message: (data: string) => void;
  error: (error: Event) => void;
};

export class ConnectionManager extends EventEmitter<ConnectionEvents> {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  private readonly url: string;
  private readonly WS: { new (url: string): WebSocket };
  private readonly shouldReconnect: boolean;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(config: ConnectionConfig) {
    super();
    this.url = config.url;
    this.WS = config.WebSocket ?? globalThis.WebSocket;
    this.shouldReconnect = config.reconnect ?? true;
    this.maxRetries = config.maxRetries ?? 10;
    this.baseDelay = config.baseDelay ?? 250;
    this.maxDelay = config.maxDelay ?? 30_000;
  }

  connect(): void {
    if (this.status === "connected" || this.status === "connecting") return;
    this.intentionalClose = false;
    this.setStatus("connecting");
    this.createSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.attempt = 0;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  send(data: string): void {
    if (this.ws && this.status === "connected") {
      this.ws.send(data);
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private createSocket(): void {
    try {
      this.ws = new this.WS(this.url);
    } catch (err) {
      this.handleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempt = 0;
      this.setStatus("connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.emit("message", typeof event.data === "string" ? event.data : String(event.data));
    };

    this.ws.onerror = (event: Event) => {
      this.emit("error", event);
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) return;
      this.handleReconnect();
    };
  }

  private handleReconnect(): void {
    if (!this.shouldReconnect || this.attempt >= this.maxRetries) {
      this.setStatus("disconnected");
      return;
    }
    this.setStatus("reconnecting");
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );
    const jitter = delay * 0.2 * Math.random();
    this.attempt++;
    this.reconnectTimer = setTimeout(() => {
      this.createSocket();
    }, delay + jitter);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit("status", status);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

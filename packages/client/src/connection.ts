import type { ConnectionStatus } from "@waits/lively-types";
import { EventEmitter } from "./event-emitter.js";

export interface ConnectionConfig {
  url: string;
  WebSocket?: { new (url: string): WebSocket };
  reconnect?: boolean;
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  heartbeatIntervalMs?: number;
  /** Abort a connection attempt if it hasn't opened within this many ms (default 10 000). */
  connectionTimeoutMs?: number;
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
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  private readonly url: string;
  private readonly WS: { new (url: string): WebSocket };
  private readonly shouldReconnect: boolean;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly heartbeatIntervalMs: number;
  private readonly connectionTimeoutMs: number;
  private connectionTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ConnectionConfig) {
    super();
    this.url = config.url;
    this.WS = config.WebSocket ?? globalThis.WebSocket;
    this.shouldReconnect = config.reconnect ?? true;
    this.maxRetries = config.maxRetries ?? 20;
    this.baseDelay = config.baseDelay ?? 250;
    this.maxDelay = config.maxDelay ?? 30_000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 30_000;
    this.connectionTimeoutMs = config.connectionTimeoutMs ?? 10_000;
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
    this.clearConnectionTimeout();
    this.stopHeartbeat();
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

  send(data: string): boolean {
    if (this.ws && this.status === "connected") {
      this.ws.send(data);
      return true;
    }
    return false;
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

    // Abort if the socket doesn't open within the timeout window.
    // This prevents hanging forever when the server is cold-starting.
    this.clearConnectionTimeout();
    this.connectionTimeoutTimer = setTimeout(() => {
      if (this.ws && this.status !== "connected") {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
        this.handleReconnect();
      }
    }, this.connectionTimeoutMs);

    this.ws.onopen = () => {
      this.clearConnectionTimeout();
      this.attempt = 0;
      this.setStatus("connected");
      this.startHeartbeat();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.emit("message", typeof event.data === "string" ? event.data : String(event.data));
    };

    this.ws.onerror = (event: Event) => {
      this.emit("error", event);
    };

    this.ws.onclose = () => {
      this.clearConnectionTimeout();
      this.ws = null;
      this.stopHeartbeat();
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

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send(JSON.stringify({ type: "heartbeat" }));
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

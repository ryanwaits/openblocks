import WebSocket from "ws";

export function connectClient(
  port: number,
  roomId: string,
  params: Record<string, string> = {}
): WebSocket {
  const qs = new URLSearchParams(params).toString();
  const url = `ws://127.0.0.1:${port}/rooms/${roomId}${qs ? "?" + qs : ""}`;
  return new WebSocket(url);
}

export function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

export interface MessageStream {
  next(): Promise<Record<string, unknown>>;
  nextOfType(type: string): Promise<Record<string, unknown>>;
}

/**
 * Creates a buffered message stream for a WebSocket.
 * Must be called BEFORE `waitForOpen` to avoid missing messages
 * that arrive in the same tick as the `open` event.
 */
export function createMessageStream(ws: WebSocket): MessageStream {
  const queue: Record<string, unknown>[] = [];
  let waiting: ((msg: Record<string, unknown>) => void) | null = null;

  ws.on("message", (data: any) => {
    const parsed = JSON.parse(data.toString());
    if (waiting) {
      const resolve = waiting;
      waiting = null;
      resolve(parsed);
    } else {
      queue.push(parsed);
    }
  });

  return {
    next(): Promise<Record<string, unknown>> {
      if (queue.length > 0) return Promise.resolve(queue.shift()!);
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
    async nextOfType(type: string): Promise<Record<string, unknown>> {
      while (true) {
        const msg = await this.next();
        if (msg.type === type) return msg;
      }
    },
  };
}

export type EventMap = Record<string, (...args: any[]) => void>;

export class EventEmitter<E extends EventMap> {
  private listeners = new Map<keyof E, Set<E[keyof E]>>();

  on<K extends keyof E>(event: K, callback: E[K]): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof E>(event: K, callback: E[K]): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      (cb as (...a: any[]) => void)(...args);
    }
  }

  removeAllListeners(event?: keyof E): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

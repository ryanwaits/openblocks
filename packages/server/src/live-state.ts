export interface LiveStateEntry {
  value: unknown;
  timestamp: number;
  userId: string;
}

export class LiveStateStore {
  private _states = new Map<string, LiveStateEntry>();

  /**
   * Set a key. LWW: accept if timestamp >= existing.
   * If merge is true, shallow-merge value into existing (both must be objects).
   */
  set(
    key: string,
    value: unknown,
    timestamp: number,
    userId: string,
    merge?: boolean
  ): boolean {
    const existing = this._states.get(key);
    if (existing && timestamp < existing.timestamp) {
      return false; // reject stale update
    }

    let finalValue = value;
    if (
      merge &&
      existing &&
      typeof existing.value === "object" &&
      existing.value !== null &&
      typeof value === "object" &&
      value !== null
    ) {
      finalValue = { ...existing.value, ...value };
    }

    this._states.set(key, { value: finalValue, timestamp, userId });
    return true;
  }

  get(key: string): LiveStateEntry | undefined {
    return this._states.get(key);
  }

  getAll(): Record<string, LiveStateEntry> {
    const result: Record<string, LiveStateEntry> = {};
    for (const [key, entry] of this._states) {
      result[key] = entry;
    }
    return result;
  }

  delete(key: string): boolean {
    return this._states.delete(key);
  }

  clear(): void {
    this._states.clear();
  }
}

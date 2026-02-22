import type { StorageOp } from "@waits/lively-types";

export interface HistoryEntry {
  forward: StorageOp[];
  inverse: StorageOp[];
}

export interface HistoryConfig {
  maxEntries?: number;
  enabled?: boolean;
}

export class HistoryManager {
  private _undoStack: HistoryEntry[] = [];
  private _redoStack: HistoryEntry[] = [];
  private _currentBatch: { forward: StorageOp[]; inverse: StorageOp[] } | null =
    null;
  private _maxEntries: number;
  private _enabled: boolean;
  private _paused = false;
  private _subscribers = new Set<() => void>();

  constructor(config?: HistoryConfig) {
    this._maxEntries = config?.maxEntries ?? 100;
    this._enabled = config?.enabled ?? true;
  }

  record(forward: StorageOp, inverse: StorageOp): void {
    if (!this._enabled || this._paused) return;

    if (this._currentBatch) {
      this._currentBatch.forward.push(forward);
      this._currentBatch.inverse.unshift(inverse); // reverse order for undo
      return;
    }

    this._pushUndo({ forward: [forward], inverse: [inverse] });
    this._redoStack.length = 0;
    this._notify();
  }

  startBatch(): void {
    this._currentBatch = { forward: [], inverse: [] };
  }

  endBatch(): void {
    const batch = this._currentBatch;
    this._currentBatch = null;
    if (!batch || batch.forward.length === 0) return;

    this._pushUndo({ forward: batch.forward, inverse: batch.inverse });
    this._redoStack.length = 0;
    this._notify();
  }

  undo(): StorageOp[] | null {
    if (this._undoStack.length === 0) return null;
    const entry = this._undoStack.pop()!;
    this._redoStack.push(entry);
    this._notify();
    return entry.inverse;
  }

  redo(): StorageOp[] | null {
    if (this._redoStack.length === 0) return null;
    const entry = this._redoStack.pop()!;
    this._undoStack.push(entry);
    this._notify();
    return entry.forward;
  }

  canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._currentBatch = null;
    this._notify();
  }

  pause(): void {
    this._paused = true;
  }

  resume(): void {
    this._paused = false;
  }

  subscribe(cb: () => void): () => void {
    this._subscribers.add(cb);
    return () => {
      this._subscribers.delete(cb);
    };
  }

  private _pushUndo(entry: HistoryEntry): void {
    this._undoStack.push(entry);
    if (this._undoStack.length > this._maxEntries) {
      this._undoStack.shift(); // evict oldest
    }
  }

  private _notify(): void {
    for (const cb of this._subscribers) {
      cb();
    }
  }
}

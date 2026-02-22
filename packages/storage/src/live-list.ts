import type {
  SerializedCrdt,
  SerializedLiveList,
  StorageOp,
  ListInsertOp,
  ListDeleteOp,
  ListMoveOp,
} from "@waits/lively-types";
import { AbstractCrdt } from "./abstract-crdt.js";
import { generateKeyBetween } from "./fractional-index.js";

interface ListEntry<T> {
  position: string;
  value: T;
  clock: number;
}

export class LiveList<T = unknown> extends AbstractCrdt {
  private _items: ListEntry<T>[] = [];
  private _immutableCache: readonly T[] | null = null;

  constructor(initial?: T[]) {
    super();
    if (initial) {
      let prev: string | null = null;
      for (const value of initial) {
        const position = generateKeyBetween(prev, null);
        if (value instanceof AbstractCrdt) {
          (value as AbstractCrdt)._parent = this;
          (value as AbstractCrdt)._path = [...this._path, position];
        }
        this._items.push({ position, value, clock: 0 });
        prev = position;
      }
    }
  }

  push(item: T): void {
    const lastPos = this._items.length > 0
      ? this._items[this._items.length - 1].position
      : null;
    const position = generateKeyBetween(lastPos, null);
    this._insertAt(position, item);
  }

  insert(item: T, index: number): void {
    const before = index > 0 ? this._items[index - 1].position : null;
    const after = index < this._items.length ? this._items[index].position : null;
    const position = generateKeyBetween(before, after);
    this._insertAt(position, item);
  }

  delete(index: number): void {
    const entry = this._items[index];
    if (!entry) return;

    // Capture inverse before mutation
    if (this._doc?._captureInverse) {
      this._doc._captureInverse({
        type: "list-insert",
        path: this._path,
        position: entry.position,
        value: serializeValue(entry.value),
        clock: 0,
      });
    }

    const clock = this._doc ? this._doc._clock.tick() : 0;
    this._items.splice(index, 1);
    this._immutableCache = null;

    const op: ListDeleteOp = {
      type: "list-delete",
      path: this._path,
      position: entry.position,
      clock,
    };
    this._emitOp(op);
    this._notifySubscribers();
  }

  move(from: number, to: number): void {
    const entry = this._items[from];
    if (!entry) return;

    const clock = this._doc ? this._doc._clock.tick() : 0;

    // Capture old position for inverse before we compute new
    const oldPosition = entry.position;

    // Remove from old position
    this._items.splice(from, 1);

    // Calculate new fractional position
    const adjustedTo = Math.min(to, this._items.length);
    const before = adjustedTo > 0 ? this._items[adjustedTo - 1].position : null;
    const after = adjustedTo < this._items.length ? this._items[adjustedTo].position : null;
    const newPosition = generateKeyBetween(before, after);

    // Insert at new position
    const newEntry: ListEntry<T> = { position: newPosition, value: entry.value, clock };
    this._items.splice(adjustedTo, 0, newEntry);
    this._immutableCache = null;

    // Capture inverse: move(newPosition → oldPosition)
    if (this._doc?._captureInverse) {
      this._doc._captureInverse({
        type: "list-move",
        path: this._path,
        fromPosition: newPosition,
        toPosition: oldPosition,
        clock: 0,
      });
    }

    const op: ListMoveOp = {
      type: "list-move",
      path: this._path,
      fromPosition: oldPosition,
      toPosition: newPosition,
      clock,
    };
    this._emitOp(op);
    this._notifySubscribers();
  }

  get(index: number): T | undefined {
    return this._items[index]?.value;
  }

  /** Look up a child by its fractional-index position key (used for path resolution). */
  _getByPosition(position: string): T | undefined {
    const entry = this._items.find((e) => e.position === position);
    return entry?.value;
  }

  get length(): number {
    return this._items.length;
  }

  forEach(cb: (value: T, index: number) => void): void {
    this._items.forEach((entry, i) => cb(entry.value, i));
  }

  map<U>(cb: (value: T, index: number) => U): U[] {
    return this._items.map((entry, i) => cb(entry.value, i));
  }

  toArray(): T[] {
    return this._items.map((e) => e.value);
  }

  toImmutable(): readonly T[] {
    if (!this._immutableCache) {
      this._immutableCache = Object.freeze(this.toArray());
    }
    return this._immutableCache;
  }

  _serialize(): SerializedCrdt {
    const items = this._items.map((entry) => ({
      position: entry.position,
      value: serializeValue(entry.value),
    }));
    return { type: "LiveList", items };
  }

  _applyOp(op: StorageOp): boolean {
    if (op.type === "list-insert") {
      const insertOp = op as ListInsertOp;
      // Check if position already exists (idempotency)
      if (this._items.some((e) => e.position === insertOp.position)) {
        return false;
      }
      const value = (this._doc ? this._doc._deserializeValue(insertOp.value) : deserializeValue(insertOp.value)) as T;
      if (value instanceof AbstractCrdt) {
        (value as AbstractCrdt)._attach(
          this._doc!,
          [...this._path, insertOp.position],
          this
        );
      }
      const entry: ListEntry<T> = {
        position: insertOp.position,
        value,
        clock: insertOp.clock,
      };
      // Insert in sorted order
      const idx = this._findInsertIndex(insertOp.position);
      this._items.splice(idx, 0, entry);
      this._immutableCache = null;
      this._notifySubscribers();
      return true;
    }

    if (op.type === "list-delete") {
      const deleteOp = op as ListDeleteOp;
      const idx = this._items.findIndex((e) => e.position === deleteOp.position);
      if (idx === -1) return false;
      this._items.splice(idx, 1);
      this._immutableCache = null;
      this._notifySubscribers();
      return true;
    }

    if (op.type === "list-move") {
      const moveOp = op as ListMoveOp;
      const idx = this._items.findIndex((e) => e.position === moveOp.fromPosition);
      if (idx === -1) return false;
      const entry = this._items[idx];
      this._items.splice(idx, 1);
      const newEntry: ListEntry<T> = {
        position: moveOp.toPosition,
        value: entry.value,
        clock: moveOp.clock,
      };
      const newIdx = this._findInsertIndex(moveOp.toPosition);
      this._items.splice(newIdx, 0, newEntry);
      this._immutableCache = null;
      this._notifySubscribers();
      return true;
    }

    return false;
  }

  private _insertAt(position: string, item: T): void {
    const clock = this._doc ? this._doc._clock.tick() : 0;

    // Capture inverse before mutation
    if (this._doc?._captureInverse) {
      this._doc._captureInverse({
        type: "list-delete",
        path: this._path,
        position,
        clock: 0,
      });
    }

    if (item instanceof AbstractCrdt) {
      (item as AbstractCrdt)._attach(this._doc!, [...this._path, position], this);
    }

    const entry: ListEntry<T> = { position, value: item, clock };
    const idx = this._findInsertIndex(position);
    this._items.splice(idx, 0, entry);
    this._immutableCache = null;

    const op: ListInsertOp = {
      type: "list-insert",
      path: this._path,
      position,
      value: serializeValue(item),
      clock,
    };
    this._emitOp(op);
    this._notifySubscribers();
  }

  private _findInsertIndex(position: string): number {
    let lo = 0;
    let hi = this._items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._items[mid].position < position) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  static _deserialize<T>(
    serialized: SerializedLiveList,
    deserialize?: (data: SerializedCrdt) => unknown
  ): LiveList<T> {
    const list = new LiveList<T>();
    const sorted = [...serialized.items].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0
    );
    for (const item of sorted) {
      const value = (deserialize ? deserialize(item.value) : deserializeValue(item.value)) as T;
      list._items.push({ position: item.position, value, clock: 0 });
    }
    return list;
  }
}

function serializeValue(value: unknown): SerializedCrdt {
  if (value instanceof AbstractCrdt) {
    return value._serialize();
  }
  return value as SerializedCrdt;
}

function deserializeValue(serialized: SerializedCrdt): unknown {
  if (serialized !== null && typeof serialized === "object" && "type" in serialized) {
    if (serialized.type === "LiveList") {
      return LiveList._deserialize(serialized as SerializedLiveList);
    }
  }
  return serialized;
}

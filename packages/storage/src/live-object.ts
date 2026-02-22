import type {
  SerializedCrdt,
  SerializedLiveObject,
  StorageOp,
  SetOp,
  DeleteOp,
} from "@waits/lively-types";
import { AbstractCrdt } from "./abstract-crdt.js";

interface FieldEntry {
  value: unknown;
  clock: number;
}

export class LiveObject<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends AbstractCrdt {
  private _fields = new Map<string, FieldEntry>();
  private _immutableCache: Readonly<T> | null = null;

  constructor(initial?: Partial<T>) {
    super();
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        this._fields.set(key, { value, clock: 0 });
        if (value instanceof AbstractCrdt) {
          value._parent = this;
          value._path = [...this._path, key];
        }
      }
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    const entry = this._fields.get(key as string);
    return entry?.value as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const clock = this._doc ? this._doc._clock.tick() : 0;
    const k = key as string;

    // Capture inverse before mutation
    if (this._doc?._captureInverse) {
      const existing = this._fields.get(k);
      if (existing) {
        this._doc._captureInverse({
          type: "set",
          path: this._path,
          key: k,
          value: serializeValue(existing.value),
          clock: existing.clock,
        });
      } else {
        this._doc._captureInverse({
          type: "delete",
          path: this._path,
          key: k,
          clock: 0,
        });
      }
    }

    // Register child CRDT
    if (value instanceof AbstractCrdt) {
      value._attach(this._doc!, [...this._path, k], this);
    }

    this._fields.set(k, { value, clock });
    this._immutableCache = null;

    const op: SetOp = {
      type: "set",
      path: this._path,
      key: k,
      value: serializeValue(value),
      clock,
    };
    this._emitOp(op);
    this._notifySubscribers();
  }

  update(partial: Partial<T>): void {
    for (const [key, value] of Object.entries(partial)) {
      this.set(key as keyof T, value as T[keyof T]);
    }
  }

  toObject(): T {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of this._fields) {
      result[key] = entry.value;
    }
    return result as T;
  }

  toImmutable(): Readonly<T> {
    if (!this._immutableCache) {
      this._immutableCache = Object.freeze({ ...this.toObject() });
    }
    return this._immutableCache;
  }

  _serialize(): SerializedCrdt {
    const data: Record<string, SerializedCrdt> = {};
    for (const [key, entry] of this._fields) {
      data[key] = serializeValue(entry.value);
    }
    return { type: "LiveObject", data };
  }

  _applyOp(op: StorageOp): boolean {
    if (op.type === "set") {
      const setOp = op as SetOp;
      const existing = this._fields.get(setOp.key);
      // LWW: apply only if clock is greater
      if (existing && setOp.clock <= existing.clock) {
        return false;
      }
      const value = this._doc ? this._doc._deserializeValue(setOp.value) : deserializeValue(setOp.value);
      if (value instanceof AbstractCrdt) {
        value._attach(this._doc!, [...this._path, setOp.key], this);
      }
      this._fields.set(setOp.key, { value, clock: setOp.clock });
      this._immutableCache = null;
      this._notifySubscribers();
      return true;
    }
    if (op.type === "delete") {
      const deleteOp = op as DeleteOp;
      const existing = this._fields.get(deleteOp.key);
      if (!existing || deleteOp.clock <= existing.clock) {
        return false;
      }
      this._fields.delete(deleteOp.key);
      this._immutableCache = null;
      this._notifySubscribers();
      return true;
    }
    return false;
  }

  static _deserialize(
    serialized: SerializedLiveObject,
    deserialize?: (data: SerializedCrdt) => unknown
  ): LiveObject {
    const obj = new LiveObject();
    for (const [key, val] of Object.entries(serialized.data)) {
      const value = deserialize ? deserialize(val) : deserializeValue(val);
      obj._fields.set(key, { value, clock: 0 });
    }
    return obj;
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
    if (serialized.type === "LiveObject") {
      return LiveObject._deserialize(serialized as SerializedLiveObject);
    }
    // LiveMap and LiveList handled by their own modules — imported dynamically
    // to avoid circular deps. The StorageDocument.deserialize handles this.
  }
  return serialized;
}

import type { SerializedCrdt, StorageOp } from "@waits/lively-types";
import type { LamportClock } from "./clock.js";

export interface StorageDocumentHost {
  _onLocalOp(op: StorageOp): void;
  _captureInverse?(op: StorageOp): void;
  _clock: LamportClock;
  _deserializeValue(data: SerializedCrdt): unknown;
}

export abstract class AbstractCrdt {
  _path: string[] = [];
  _parent: AbstractCrdt | null = null;
  _doc: StorageDocumentHost | null = null;
  _subscribers: Set<() => void> = new Set<() => void>();

  abstract _serialize(): SerializedCrdt;
  abstract _applyOp(op: StorageOp): boolean;

  _emitOp(op: StorageOp): void {
    if (this._doc) {
      this._doc._onLocalOp(op);
    }
  }

  _notifySubscribers(): void {
    for (const cb of this._subscribers) {
      cb();
    }
    // Walk up parent chain for deep subscriptions
    if (this._parent) {
      this._parent._notifySubscribers();
    }
  }

  _attach(doc: StorageDocumentHost, path: string[], parent: AbstractCrdt | null): void {
    this._doc = doc;
    this._path = path;
    this._parent = parent;
  }
}

import type {
  SerializedCrdt,
  SerializedLiveObject,
  SerializedLiveMap,
  SerializedLiveList,
  StorageOp,
} from "@waits/lively-types";
import { AbstractCrdt, type StorageDocumentHost } from "./abstract-crdt.js";
import { LamportClock } from "./clock.js";
import { LiveObject } from "./live-object.js";
import { LiveMap } from "./live-map.js";
import { LiveList } from "./live-list.js";
import { HistoryManager, type HistoryConfig } from "./history.js";

interface Subscription {
  target: AbstractCrdt;
  callback: () => void;
  isDeep: boolean;
}

export class StorageDocument implements StorageDocumentHost {
  _clock: LamportClock = new LamportClock();
  private _root: LiveObject;
  private _subscriptions = new Set<Subscription>();
  private _onOpsGenerated: ((ops: StorageOp[]) => void) | null = null;
  _history: HistoryManager;
  _pendingInverse: StorageOp | null = null;
  _notificationBatch: Set<AbstractCrdt> | null = null;

  constructor(root: LiveObject, historyConfig?: HistoryConfig) {
    this._root = root;
    this._history = new HistoryManager(historyConfig);
    this._attachTree(root, []);
  }

  getRoot(): LiveObject {
    return this._root;
  }

  serialize(): SerializedCrdt {
    return this._root._serialize();
  }

  static deserialize(data: SerializedCrdt): StorageDocument {
    const root = deserializeCrdt(data) as LiveObject;
    return new StorageDocument(root);
  }

  applyOps(ops: StorageOp[]): void {
    this._notificationBatch = new Set();
    try {
      for (const op of ops) {
        this._clock.merge(op.clock);
        const target = this._resolveTarget(op);
        if (target) {
          target._applyOp(op);
        }
      }
    } finally {
      const batch = this._notificationBatch;
      this._notificationBatch = null;
      this._flushBatch(batch);
    }
  }

  applySnapshot(serialized: SerializedCrdt): void {
    // Re-hydrate in-place — preserve subscriptions
    const oldRoot = this._root;
    const newRoot = deserializeCrdt(serialized) as LiveObject;

    // Build path→node maps for old and new trees
    const oldNodes = new Map<string, AbstractCrdt>();
    this._collectNodes(oldRoot, [], oldNodes);
    const newNodes = new Map<string, AbstractCrdt>();
    this._collectNodes(newRoot, [], newNodes);

    // Transfer shallow subscribers from matched old→new nodes
    for (const [pathKey, oldNode] of oldNodes) {
      const newNode = newNodes.get(pathKey);
      if (newNode) {
        for (const cb of oldNode._subscribers) {
          newNode._subscribers.add(cb);
        }
      }
    }

    // Re-target deep subscriptions by path lookup
    for (const sub of this._subscriptions) {
      const pathKey = this._nodePathKey(sub.target, oldNodes);
      if (pathKey !== null) {
        const newNode = newNodes.get(pathKey);
        if (newNode) {
          sub.target = newNode;
        }
      }
    }

    this._root = newRoot;
    this._attachTree(newRoot, []);

    // Notify all deep subscribers
    for (const sub of this._subscriptions) {
      sub.callback();
    }
    // Notify all shallow subscribers on new root
    for (const [, newNode] of newNodes) {
      for (const cb of newNode._subscribers) {
        cb();
      }
    }
  }

  subscribe(
    target: AbstractCrdt,
    callback: () => void,
    opts?: { isDeep?: boolean }
  ): () => void {
    const isDeep = opts?.isDeep ?? false;

    if (isDeep) {
      // Deep: use subscription tracking
      const sub: Subscription = { target, callback, isDeep: true };
      this._subscriptions.add(sub);
      return () => {
        this._subscriptions.delete(sub);
      };
    }

    // Shallow: attach directly to target's subscriber set
    target._subscribers.add(callback);
    return () => {
      target._subscribers.delete(callback);
    };
  }

  _captureInverse(op: StorageOp): void {
    this._pendingInverse = op;
  }

  _onLocalOp(op: StorageOp): void {
    // Record history if not paused
    if (this._pendingInverse) {
      this._history.record(op, this._pendingInverse);
      this._pendingInverse = null;
    }

    // Op is already stamped by the set/delete method via _clock.tick().
    // Don't re-stamp — this prevents echoed ops from re-applying locally.
    if (this._onOpsGenerated) {
      this._onOpsGenerated([op]);
    }
  }

  getHistory(): HistoryManager {
    return this._history;
  }

  /**
   * Apply ops locally with fresh clocks (used by undo/redo).
   * Pauses history recording to prevent re-recording during replay.
   */
  applyLocalOps(ops: StorageOp[]): StorageOp[] {
    this._history.pause();
    this._notificationBatch = new Set();
    const reclockedOps: StorageOp[] = [];
    try {
      for (const op of ops) {
        const clock = this._clock.tick();
        const reclocked = { ...op, clock };
        const target = this._resolveTarget(reclocked);
        if (target) {
          target._applyOp(reclocked);
        }
        reclockedOps.push(reclocked);
      }
      // Flush reclocked ops to network
      if (reclockedOps.length > 0 && this._onOpsGenerated) {
        this._onOpsGenerated(reclockedOps);
      }
    } finally {
      const batch = this._notificationBatch;
      this._notificationBatch = null;
      this._history.resume();
      this._flushBatch(batch);
    }
    return reclockedOps;
  }

  setOnOpsGenerated(cb: (ops: StorageOp[]) => void): void {
    this._onOpsGenerated = cb;
  }

  _deserializeValue(data: SerializedCrdt): unknown {
    return deserializeCrdt(data);
  }

  /** Flush a batch of changed nodes — shallow once per node, deep deduplicated by callback */
  private _flushBatch(batch: Set<AbstractCrdt>): void {
    // Fire shallow subscribers for each changed node
    for (const node of batch) {
      for (const cb of node._subscribers) {
        cb();
      }
    }
    // Fire deep subscribers deduplicated by callback identity
    const firedDeep = new Set<() => void>();
    for (const sub of this._subscriptions) {
      if (!sub.isDeep) continue;
      if (firedDeep.has(sub.callback)) continue;
      for (const node of batch) {
        if (isAncestorOrSelf(sub.target, node)) {
          sub.callback();
          firedDeep.add(sub.callback);
          break;
        }
      }
    }
  }

  /** Walk the CRDT tree and notify deep subscriptions */
  _notifyDeepSubscribers(changed: AbstractCrdt): void {
    for (const sub of this._subscriptions) {
      if (!sub.isDeep) continue;
      // Fire if target is the changed node or an ancestor of it
      if (isAncestorOrSelf(sub.target, changed)) {
        sub.callback();
      }
    }
  }

  private _collectNodes(
    node: AbstractCrdt,
    path: string[],
    map: Map<string, AbstractCrdt>
  ): void {
    const key = path.join("\0");
    map.set(key, node);

    if (node instanceof LiveObject) {
      const obj = node.toObject();
      for (const [k, value] of Object.entries(obj)) {
        if (value instanceof AbstractCrdt) {
          this._collectNodes(value, [...path, k], map);
        }
      }
    } else if (node instanceof LiveMap) {
      node.forEach((value: unknown, k: string) => {
        if (value instanceof AbstractCrdt) {
          this._collectNodes(value as AbstractCrdt, [...path, k], map);
        }
      });
    }
  }

  private _nodePathKey(
    target: AbstractCrdt,
    nodeMap: Map<string, AbstractCrdt>
  ): string | null {
    for (const [key, node] of nodeMap) {
      if (node === target) return key;
    }
    return null;
  }

  private _attachTree(node: AbstractCrdt, path: string[]): void {
    node._doc = this;
    node._path = path;

    // Override _notifySubscribers to also trigger deep subscriptions
    const doc = this;
    node._notifySubscribers = function () {
      if (doc._notificationBatch) {
        doc._notificationBatch.add(this);
        return;
      }
      // Shallow subscribers
      for (const cb of this._subscribers) {
        cb();
      }
      // Deep subscribers
      doc._notifyDeepSubscribers(this);
    };

    // Recurse into children
    if (node instanceof LiveObject) {
      const obj = node.toObject();
      for (const [key, value] of Object.entries(obj)) {
        if (value instanceof AbstractCrdt) {
          value._parent = node;
          this._attachTree(value, [...path, key]);
        }
      }
    } else if (node instanceof LiveMap) {
      node.forEach((value: unknown, key: string) => {
        if (value instanceof AbstractCrdt) {
          (value as AbstractCrdt)._parent = node;
          this._attachTree(value as AbstractCrdt, [...path, key]);
        }
      });
    } else if (node instanceof LiveList) {
      node.forEach((value: unknown, _index: number) => {
        if (value instanceof AbstractCrdt) {
          // For LiveList, the position is the path segment
          // We can't easily get position from index, so skip deep path for now
          (value as AbstractCrdt)._parent = node;
          (value as AbstractCrdt)._doc = this;
        }
      });
    }
  }

  private _resolveTarget(op: StorageOp): AbstractCrdt | null {
    let current: AbstractCrdt = this._root;
    for (const segment of op.path) {
      const next = this._getChild(current, segment);
      if (!next || !(next instanceof AbstractCrdt)) return null;
      current = next;
    }
    return current;
  }

  private _getChild(node: AbstractCrdt, key: string): unknown {
    if (node instanceof LiveObject) {
      return node.get(key);
    }
    if (node instanceof LiveMap) {
      return node.get(key);
    }
    if (node instanceof LiveList) {
      return node._getByPosition(key);
    }
    return null;
  }
}

function isAncestorOrSelf(ancestor: AbstractCrdt, node: AbstractCrdt): boolean {
  let current: AbstractCrdt | null = node;
  while (current) {
    if (current === ancestor) return true;
    current = current._parent;
  }
  return false;
}

export function deserializeCrdt(data: SerializedCrdt): unknown {
  if (data === null || typeof data !== "object") {
    return data;
  }
  if (!("type" in data)) {
    return data;
  }

  switch (data.type) {
    case "LiveObject":
      return LiveObject._deserialize(data as SerializedLiveObject, deserializeCrdt);
    case "LiveMap":
      return LiveMap._deserialize(data as SerializedLiveMap, deserializeCrdt);
    case "LiveList":
      return LiveList._deserialize(data as SerializedLiveList, deserializeCrdt);
    default:
      return data;
  }
}

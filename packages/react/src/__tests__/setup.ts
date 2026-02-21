import { Window } from "happy-dom";
import { mock } from "bun:test";

// Register DOM globals (happy-dom v20 removed GlobalRegistrator)
const win = new Window({ url: "http://localhost" });

// Patch JS builtins that happy-dom v20 doesn't copy
(win as any).SyntaxError = SyntaxError;
(win as any).TypeError = TypeError;
(win as any).RangeError = RangeError;
(win as any).Error = Error;
(win as any).DOMException = (win as any).DOMException ?? DOMException;

const DOM_GLOBALS = [
  "document", "navigator", "location", "history", "self", "top", "parent",
  "HTMLElement", "HTMLDivElement", "HTMLSpanElement", "HTMLInputElement",
  "HTMLButtonElement", "HTMLFormElement", "HTMLAnchorElement", "HTMLImageElement",
  "HTMLTemplateElement", "HTMLStyleElement", "Element", "Node", "Text", "Comment",
  "DocumentFragment", "Document", "DocumentType", "DOMParser", "NodeList",
  "HTMLCollection", "NamedNodeMap", "Attr", "CharacterData", "CSSStyleDeclaration",
  "CSSStyleSheet", "StyleSheet", "TreeWalker", "Range", "Selection", "NodeFilter",
  "NodeIterator", "XMLSerializer", "DOMTokenList", "Event", "CustomEvent",
  "MouseEvent", "KeyboardEvent", "FocusEvent", "InputEvent", "PointerEvent",
  "TouchEvent", "UIEvent", "AnimationEvent", "ClipboardEvent", "ErrorEvent",
  "EventTarget", "MessageEvent", "MutationObserver", "IntersectionObserver",
  "ResizeObserver", "getComputedStyle", "requestAnimationFrame",
  "cancelAnimationFrame", "Headers", "Request", "Response", "URL",
  "URLSearchParams", "FormData", "Blob", "File", "FileList",
  "AbortController", "AbortSignal", "localStorage", "sessionStorage", "Storage",
] as const;

for (const key of DOM_GLOBALS) {
  const val = (win as any)[key];
  if (val !== undefined) {
    (globalThis as any)[key] = val;
  }
}

(globalThis as any).window = globalThis;

// --- Mock helpers ---

export function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

export type MockRoom = ReturnType<typeof createMockRoom>;

export function createMockRoom(overrides?: {
  getStorage?: () => Promise<{ root: any }>;
  roomId?: string;
}) {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  function subscribe(eventOrTarget: string | object, callback: (...args: any[]) => void, opts?: any) {
    if (typeof eventOrTarget === "string") {
      let set = listeners.get(eventOrTarget);
      if (!set) { set = new Set(); listeners.set(eventOrTarget, set); }
      set.add(callback);
      return () => { set!.delete(callback); };
    }
    // CRDT subscription — deep sub
    let set = listeners.get("__crdt__");
    if (!set) { set = new Set(); listeners.set("__crdt__", set); }
    set.add(callback);
    return () => { set!.delete(callback); };
  }

  function emit(event: string, ...args: any[]) {
    const set = listeners.get(event);
    if (set) for (const cb of set) cb(...args);
  }

  function emitCrdt() {
    const set = listeners.get("__crdt__");
    if (set) for (const cb of set) cb();
  }

  let _status: string = "connected";
  let _self: any = null;
  let _others: any[] = [];
  let _cursors = new Map();

  let _liveStates = new Map<string, { value: unknown; timestamp: number; userId: string }>();
  const liveStateListeners = new Map<string, Set<() => void>>();

  function subscribeLiveState(key: string, cb: () => void) {
    let set = liveStateListeners.get(key);
    if (!set) { set = new Set(); liveStateListeners.set(key, set); }
    set.add(cb);
    return () => { set!.delete(cb); };
  }

  function emitLiveState(key: string) {
    const set = liveStateListeners.get(key);
    if (set) for (const cb of set) cb();
  }

  // Mock history
  let _canUndo = false;
  let _canRedo = false;
  const historyListeners = new Set<() => void>();
  const mockHistory = {
    canUndo: () => _canUndo,
    canRedo: () => _canRedo,
    subscribe: (cb: () => void) => {
      historyListeners.add(cb);
      return () => { historyListeners.delete(cb); };
    },
    setCanUndo(v: boolean) { _canUndo = v; for (const cb of historyListeners) cb(); },
    setCanRedo(v: boolean) { _canRedo = v; for (const cb of historyListeners) cb(); },
  };

  return {
    roomId: overrides?.roomId ?? "mock",
    subscribe: mock(subscribe as any),
    emit,
    emitCrdt,
    getStatus: mock(() => _status),
    setStatus(s: string) { _status = s; },
    getSelf: mock(() => _self),
    setSelf(s: any) { _self = s; },
    getOthers: mock(() => _others),
    setOthers(o: any[]) { _others = o; },
    getOthersOnLocation: mock((loc: string) => _others.filter((u: any) => u.location === loc)),
    getCursors: mock(() => new Map(_cursors)),
    setCursors(c: Map<string, any>) { _cursors = c; },
    getStorage: overrides?.getStorage ?? mock(() => Promise.resolve({ root: {} })),
    batch: mock((fn: () => any) => fn()),
    send: mock(() => {}),
    updateCursor: mock((_x: number, _y: number) => {}),
    updatePresence: mock((_data: any) => {}),
    connect: mock(() => {}),
    disconnect: mock(() => {}),
    // Live state
    setLiveState: mock((key: string, value: unknown) => {
      _liveStates.set(key, { value, timestamp: Date.now(), userId: "mock" });
      emitLiveState(key);
    }),
    getLiveState: mock((key: string) => _liveStates.get(key)?.value),
    getAllLiveStates: mock(() => new Map(_liveStates)),
    subscribeLiveState: mock(subscribeLiveState),
    setMockLiveState(key: string, value: unknown) {
      _liveStates.set(key, { value, timestamp: Date.now(), userId: "other" });
      emitLiveState(key);
    },
    // Undo/redo
    undo: mock(() => {}),
    redo: mock(() => {}),
    getHistory: mock(() => mockHistory),
    mockHistory,
    // Follow
    followUser: mock((_targetUserId: string) => {}),
    stopFollowing: mock(() => {}),
    getFollowing: mock(() => null as string | null),
    getFollowers: mock(() => [] as string[]),
  };
}

export function createMockClient(roomFactory?: (roomId: string) => MockRoom) {
  const joinRoom = mock((roomId: string, _opts: any) => {
    return roomFactory ? roomFactory(roomId) : createMockRoom();
  });
  const leaveRoom = mock((_roomId: string) => {});
  return { joinRoom, leaveRoom } as any;
}

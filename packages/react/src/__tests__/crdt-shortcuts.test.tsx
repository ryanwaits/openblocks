import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, createDeferredPromise, type MockRoom } from "./setup";

const { act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
const { LivelyProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useObject, useMap, useList } = await import("../use-crdt-shortcuts.js");
const { LiveObject, LiveMap, LiveList, StorageDocument } = await import("@waits/lively-client");

function createStorageRoom() {
  const root = new LiveObject({
    settings: new LiveObject({ theme: "light" }),
    users: new LiveMap([["u1", "Alice"]]),
    items: new LiveList(["a", "b", "c"]),
  });
  const doc = new StorageDocument(root);
  const deferred = createDeferredPromise<{ root: any }>();
  const origSubscribe = createMockRoom().subscribe;
  const mockRoom = createMockRoom({ getStorage: () => deferred.promise });

  // Wire CRDT subscriptions through real StorageDocument
  const origSub = mockRoom.subscribe;
  (mockRoom.subscribe as any).mockImplementation((eventOrTarget: any, cb: any, opts: any) => {
    if (typeof eventOrTarget !== "string") {
      return doc.subscribe(eventOrTarget, cb, opts);
    }
    return origSub(eventOrTarget, cb, opts);
  });

  return { root, doc, deferred, mockRoom };
}

let mockRoom: MockRoom;
let client: any;
let deferred: ReturnType<typeof createDeferredPromise>;
let root: InstanceType<typeof LiveObject>;

function setup() {
  const s = createStorageRoom();
  mockRoom = s.mockRoom;
  deferred = s.deferred;
  root = s.root;
  client = createMockClient(() => mockRoom);
}

function wrapper({ children }: { children: any }) {
  return createElement(
    LivelyProvider,
    { client },
    createElement(
      RoomProvider,
      { roomId: "r", userId: "u1", displayName: "U1" },
      children
    )
  );
}

describe("useObject", () => {
  it("returns null while storage loading", () => {
    setup();
    const { result } = renderHook(() => useObject("settings"), { wrapper });
    expect(result.current).toBeNull();
  });

  it("returns LiveObject after storage loads", async () => {
    setup();
    const { result } = renderHook(() => useObject("settings"), { wrapper });

    await act(async () => {
      deferred.resolve({ root });
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.get("theme")).toBe("light");
  });
});

describe("useMap", () => {
  it("returns null while storage loading", () => {
    setup();
    const { result } = renderHook(() => useMap("users"), { wrapper });
    expect(result.current).toBeNull();
  });

  it("returns LiveMap after storage loads", async () => {
    setup();
    const { result } = renderHook(() => useMap("users"), { wrapper });

    await act(async () => {
      deferred.resolve({ root });
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.get("u1")).toBe("Alice");
  });
});

describe("useList", () => {
  it("returns null while storage loading", () => {
    setup();
    const { result } = renderHook(() => useList("items"), { wrapper });
    expect(result.current).toBeNull();
  });

  it("returns LiveList after storage loads", async () => {
    setup();
    const { result } = renderHook(() => useList("items"), { wrapper });

    await act(async () => {
      deferred.resolve({ root });
    });

    expect(result.current).not.toBeNull();
    expect(result.current!.toArray()).toEqual(["a", "b", "c"]);
  });
});

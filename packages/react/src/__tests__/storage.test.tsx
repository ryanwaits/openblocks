import "./setup";
import { describe, it, expect, mock } from "bun:test";
import { createMockRoom, createMockClient, createDeferredPromise, type MockRoom } from "./setup";

const { render, act, renderHook } = await import("@testing-library/react");
const { createElement, Suspense } = await import("react");
const { OpenBlocksProvider } = await import("../client-context.js");
const { RoomProvider } = await import("../room-context.js");
const { useStorage } = await import("../use-storage.js");
const { useMutation } = await import("../use-mutation.js");
const { useStorageSuspense } = await import("../suspense.js");

// Use real LiveObject + StorageDocument for storage tests (via client re-export)
const { LiveObject, StorageDocument } = await import("@waits/openblocks-client");

function createStorageRoom() {
  const root = new LiveObject<Record<string, unknown>>({ count: 0, name: "test" });
  const doc = new StorageDocument(root);
  const deferred = createDeferredPromise<{ root: typeof root }>();
  const mockRoom = createMockRoom({
    getStorage: () => deferred.promise,
  });

  // Wire up CRDT subscribe to the real StorageDocument
  const origSubscribe = mockRoom.subscribe.getMockImplementation()!;
  (mockRoom.subscribe as any).mockImplementation((eventOrTarget: any, cb: any, opts: any) => {
    if (typeof eventOrTarget !== "string") {
      // Real CRDT subscription through StorageDocument
      return doc.subscribe(eventOrTarget, cb, opts);
    }
    return origSubscribe(eventOrTarget, cb, opts);
  });

  // Wire up batch to actually run the fn
  (mockRoom.batch as any).mockImplementation((fn: () => any) => fn());

  return { root, doc, deferred, mockRoom };
}

let client: any;

function makeWrapper(mockRoom: MockRoom) {
  client = createMockClient(() => mockRoom);
  return function wrapper({ children }: { children: any }) {
    return createElement(
      OpenBlocksProvider,
      { client },
      createElement(
        RoomProvider,
        { roomId: "r", userId: "u1", displayName: "U1" },
        children
      )
    );
  };
}

describe("useStorage", () => {
  it("returns null while storage loading, then value after resolve", async () => {
    const { root, deferred, mockRoom } = createStorageRoom();
    const wrapper = makeWrapper(mockRoom);

    const { result } = renderHook(
      () => useStorage((r: any) => r.get("count")),
      { wrapper }
    );
    expect(result.current).toBeNull();

    await act(async () => {
      deferred.resolve({ root });
    });
    expect(result.current).toBe(0);
  });

  it("re-renders on deep mutation", async () => {
    const { root, deferred, mockRoom } = createStorageRoom();
    const wrapper = makeWrapper(mockRoom);

    const { result } = renderHook(
      () => useStorage((r: any) => r.get("count")),
      { wrapper }
    );

    await act(async () => {
      deferred.resolve({ root });
    });
    expect(result.current).toBe(0);

    await act(() => {
      root.set("count", 42);
    });
    expect(result.current).toBe(42);
  });

  it("returns stable reference when selector result unchanged", async () => {
    const { root, deferred, mockRoom } = createStorageRoom();
    const wrapper = makeWrapper(mockRoom);

    const { result } = renderHook(
      () => useStorage((r: any) => ({ count: r.get("count") })),
      { wrapper }
    );

    await act(async () => {
      deferred.resolve({ root });
    });
    const first = result.current;

    // Mutate a different field — selector output same shape
    await act(() => {
      root.set("name", "changed");
    });
    // shallowEqual should keep the reference stable
    expect(result.current).toBe(first);
  });
});

describe("useMutation", () => {
  it("calls batch with root and returns value", async () => {
    const { root, deferred, mockRoom } = createStorageRoom();
    const wrapper = makeWrapper(mockRoom);

    const { result } = renderHook(
      () =>
        useMutation(
          (ctx: any, inc: number) => {
            const cur = ctx.storage.root.get("count") as number;
            ctx.storage.root.set("count", cur + inc);
            return cur + inc;
          },
          []
        ),
      { wrapper }
    );

    await act(async () => {
      deferred.resolve({ root });
    });

    let returnValue: number | undefined;
    await act(() => {
      returnValue = result.current(5);
    });
    expect(returnValue).toBe(5);
    expect(root.get("count")).toBe(5);
  });

  it("throws if storage not loaded", async () => {
    const { mockRoom } = createStorageRoom();
    const wrapper = makeWrapper(mockRoom);

    const { result } = renderHook(
      () => useMutation((ctx: any) => ctx.storage.root.get("count"), []),
      { wrapper }
    );

    expect(() => result.current()).toThrow("storage not loaded");
  });
});

describe("useStorageSuspense", () => {
  it("suspends while loading, resolves after storage ready", async () => {
    const { root, deferred, mockRoom } = createStorageRoom();
    client = createMockClient(() => mockRoom);

    function Inner() {
      const count = useStorageSuspense((r: any) => r.get("count"));
      return createElement("div", { "data-testid": "value" }, String(count));
    }

    function Fallback() {
      return createElement("div", { "data-testid": "fallback" }, "loading");
    }

    const { container } = render(
      createElement(
        OpenBlocksProvider,
        { client },
        createElement(
          RoomProvider,
          { roomId: "r", userId: "u1", displayName: "U1" },
          createElement(Suspense, { fallback: createElement(Fallback) }, createElement(Inner))
        )
      )
    );

    // Should show fallback
    expect(container.querySelector("[data-testid='fallback']")?.textContent).toBe("loading");
    expect(container.querySelector("[data-testid='value']")).toBeNull();

    await act(async () => {
      deferred.resolve({ root });
    });

    // Should now show value
    expect(container.querySelector("[data-testid='value']")?.textContent).toBe("0");
    expect(container.querySelector("[data-testid='fallback']")).toBeNull();
  });
});

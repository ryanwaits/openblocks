import { Window } from "happy-dom";
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ---------------------------------------------------------------------------
// Register DOM globals (happy-dom v20 removed GlobalRegistrator).
// We patch window.SyntaxError which happy-dom v20+bun 1.3.8 is missing.
// ---------------------------------------------------------------------------
const win = new Window({ url: "http://localhost" });

// Patch: happy-dom v20 doesn't copy JS builtins onto the Window prototype.
// querySelector internals reference this.window.SyntaxError which is absent.
(win as any).SyntaxError = SyntaxError;
(win as any).TypeError = TypeError;
(win as any).RangeError = RangeError;
(win as any).Error = Error;
(win as any).DOMException = (win as any).DOMException ?? DOMException;

// Selective DOM global registration (avoid overwriting JS builtins)
const DOM_GLOBALS = [
  "document",
  "navigator",
  "location",
  "history",
  "self",
  "top",
  "parent",
  "HTMLElement",
  "HTMLDivElement",
  "HTMLSpanElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "HTMLTemplateElement",
  "HTMLStyleElement",
  "Element",
  "Node",
  "Text",
  "Comment",
  "DocumentFragment",
  "Document",
  "DocumentType",
  "DOMParser",
  "NodeList",
  "HTMLCollection",
  "NamedNodeMap",
  "Attr",
  "CharacterData",
  "CSSStyleDeclaration",
  "CSSStyleSheet",
  "StyleSheet",
  "TreeWalker",
  "Range",
  "Selection",
  "NodeFilter",
  "NodeIterator",
  "XMLSerializer",
  "DOMTokenList",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
  "PointerEvent",
  "TouchEvent",
  "UIEvent",
  "AnimationEvent",
  "ClipboardEvent",
  "ErrorEvent",
  "EventTarget",
  "MessageEvent",
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "Headers",
  "Request",
  "Response",
  "URL",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "FileList",
  "AbortController",
  "AbortSignal",
  "localStorage",
  "sessionStorage",
  "Storage",
] as const;

for (const key of DOM_GLOBALS) {
  const val = (win as any)[key];
  if (val !== undefined) {
    (globalThis as any)[key] = val;
  }
}

(globalThis as any).window = globalThis;

// Dynamic imports so React/testing-library see the DOM globals
const { render, act, renderHook } = await import("@testing-library/react");
const { createElement } = await import("react");
type ReactNode = import("react").ReactNode;
const { LivelyProvider, useClient } = await import("../client-context.js");
const { RoomProvider, useStorageRoot, useIsInsideRoom } = await import("../room-context.js");

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type Resolve<T> = (value: T) => void;

function createDeferredPromise<T>() {
  let resolve!: Resolve<T>;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function createMockRoom(overrides?: { getStorage?: () => Promise<{ root: any }> }) {
  return {
    roomId: "mock",
    connect: mock(() => {}),
    subscribe: mock(() => mock(() => {})),
    getStatus: mock(() => "connected" as const),
    getSelf: mock(() => null),
    getOthers: mock(() => []),
    getCursors: mock(() => new Map()),
    getStorage: overrides?.getStorage ?? mock(() => Promise.resolve({ root: {} })),
    batch: mock((fn: () => any) => fn()),
  };
}

function createMockClient(roomFactory?: (roomId: string) => ReturnType<typeof createMockRoom>) {
  const joinRoom = mock((roomId: string, _opts: any) => {
    return roomFactory ? roomFactory(roomId) : createMockRoom();
  });
  const leaveRoom = mock((_roomId: string) => {});
  return { joinRoom, leaveRoom } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LivelyProvider", () => {
  it("renders children", () => {
    const client = createMockClient();
    const { container } = render(
      createElement(LivelyProvider, { client }, createElement("div", { "data-testid": "child" }, "hello"))
    );
    const el = container.querySelector("[data-testid='child']");
    expect(el).not.toBeNull();
    expect(el!.textContent).toBe("hello");
  });
});

describe("useClient", () => {
  it("throws outside provider", () => {
    const orig = console.error;
    console.error = mock(() => {});

    expect(() => {
      renderHook(() => useClient());
    }).toThrow("useClient must be used within an <LivelyProvider>");

    console.error = orig;
  });
});

describe("RoomProvider", () => {
  let client: ReturnType<typeof createMockClient>;

  function Wrapper({ roomId, children }: { roomId: string; children?: ReactNode }) {
    return createElement(
      LivelyProvider,
      { client },
      createElement(
        RoomProvider,
        { roomId, userId: "u1", displayName: "User 1" },
        children
      )
    );
  }

  beforeEach(() => {
    client = createMockClient();
  });

  it("calls client.joinRoom on mount and client.leaveRoom on unmount", async () => {
    const { unmount } = render(createElement(Wrapper, { roomId: "room-a" }));

    expect(client.joinRoom).toHaveBeenCalledTimes(1);
    expect(client.joinRoom.mock.calls[0][0]).toBe("room-a");

    unmount();
    // leaveRoom is deferred via setTimeout to survive React strict-mode remounts
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(client.leaveRoom).toHaveBeenCalledTimes(1);
    expect(client.leaveRoom.mock.calls[0][0]).toBe("room-a");
  });

  it("populates storage context after getStorage resolves", async () => {
    const deferred = createDeferredPromise<{ root: any }>();
    const mockRoom = createMockRoom({ getStorage: () => deferred.promise });
    client = createMockClient(() => mockRoom);

    function StorageProbe() {
      const storage = useStorageRoot();
      return createElement("div", { "data-testid": "storage" }, storage ? "loaded" : "pending");
    }

    const { container } = render(
      createElement(
        LivelyProvider,
        { client },
        createElement(
          RoomProvider,
          { roomId: "room-s", userId: "u1", displayName: "User 1" },
          createElement(StorageProbe)
        )
      )
    );

    expect(container.querySelector("[data-testid='storage']")!.textContent).toBe("pending");

    const fakeRoot = { get: mock(() => null) };
    await act(async () => {
      deferred.resolve({ root: fakeRoot as any });
    });

    expect(container.querySelector("[data-testid='storage']")!.textContent).toBe("loaded");
  });

  it("ignores stale getStorage when roomId changes before resolution", async () => {
    const deferredA = createDeferredPromise<{ root: any }>();
    const deferredB = createDeferredPromise<{ root: any }>();

    const rooms: Record<string, ReturnType<typeof createMockRoom>> = {
      a: createMockRoom({ getStorage: () => deferredA.promise }),
      b: createMockRoom({ getStorage: () => deferredB.promise }),
    };

    client = createMockClient((roomId) => rooms[roomId]);

    function StorageProbe() {
      const storage = useStorageRoot();
      return createElement("div", { "data-testid": "storage" }, storage ? "loaded" : "pending");
    }

    function TestHarness({ roomId }: { roomId: string }) {
      return createElement(
        LivelyProvider,
        { client },
        createElement(
          RoomProvider,
          { roomId, userId: "u1", displayName: "User 1" },
          createElement(StorageProbe)
        )
      );
    }

    const { container, rerender } = render(createElement(TestHarness, { roomId: "a" }));

    // Switch to room "b" before "a" resolves
    rerender(createElement(TestHarness, { roomId: "b" }));

    // Resolve room "a" — should be ignored (stale)
    await act(async () => {
      deferredA.resolve({ root: {} as any });
    });
    expect(container.querySelector("[data-testid='storage']")!.textContent).toBe("pending");

    // Resolve room "b" — should be accepted
    await act(async () => {
      deferredB.resolve({ root: {} as any });
    });
    expect(container.querySelector("[data-testid='storage']")!.textContent).toBe("loaded");
  });
});

describe("useIsInsideRoom", () => {
  it("returns false outside RoomProvider", () => {
    const { result } = renderHook(() => useIsInsideRoom());
    expect(result.current).toBe(false);
  });

  it("returns true inside RoomProvider", () => {
    const c = createMockClient();
    function wrapper({ children }: { children: any }) {
      return createElement(
        LivelyProvider,
        { client: c },
        createElement(
          RoomProvider,
          { roomId: "r", userId: "u1", displayName: "U1" },
          children
        )
      );
    }
    const { result } = renderHook(() => useIsInsideRoom(), { wrapper });
    expect(result.current).toBe(true);
  });
});

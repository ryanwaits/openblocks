import "./setup";
import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock the react hooks before importing CursorOverlay
const mockUseCursors = mock(() => new Map());
const mockUseSelf = mock(() => ({ userId: "self" }));
const mockUseOthers = mock(() => [] as any[]);

mock.module("@waits/lively-react", () => ({
  useCursors: mockUseCursors,
  useSelf: mockUseSelf,
  useOthers: mockUseOthers,
}));

const { render } = await import("@testing-library/react");
const React = await import("react");
const { CursorOverlay } = await import("../cursor-overlay.js");

function makeCursors(
  entries: Array<{ userId: string; x: number; y: number; color: string; displayName: string; lastUpdate: number }>
): Map<string, any> {
  const m = new Map();
  for (const e of entries) m.set(e.userId, e);
  return m;
}

beforeEach(() => {
  mockUseCursors.mockReset();
  mockUseSelf.mockReset();
  mockUseOthers.mockReset();
  mockUseSelf.mockReturnValue({ userId: "self" });
  mockUseOthers.mockReturnValue([]);
  mockUseCursors.mockReturnValue(new Map());
});

describe("CursorOverlay", () => {
  it("renders cursors for other users, not self", () => {
    mockUseCursors.mockReturnValue(
      makeCursors([
        { userId: "self", x: 0, y: 0, color: "#000", displayName: "Me", lastUpdate: Date.now() },
        { userId: "bob", x: 50, y: 60, color: "#f00", displayName: "Bob", lastUpdate: Date.now() },
      ])
    );
    const { container } = render(React.createElement(CursorOverlay));
    // Should only render Bob's cursor, not self
    expect(container.textContent).toContain("Bob");
    expect(container.textContent).not.toContain("Me");
  });

  it("passes mode through to Cursor", () => {
    mockUseCursors.mockReturnValue(
      makeCursors([
        { userId: "bob", x: 10, y: 20, color: "#f00", displayName: "Bob", lastUpdate: Date.now() },
      ])
    );
    const { container } = render(
      React.createElement(CursorOverlay, { mode: "avatar" })
    );
    // In avatar mode without avatarUrl, should show initials (rounded-full div)
    const initialsDiv = container.querySelector(".rounded-full");
    expect(initialsDiv).not.toBeNull();
  });

  it("passes avatarUrl from useOthers presence data", () => {
    mockUseCursors.mockReturnValue(
      makeCursors([
        { userId: "bob", x: 10, y: 20, color: "#f00", displayName: "Bob", lastUpdate: Date.now() },
      ])
    );
    mockUseOthers.mockReturnValue([
      { userId: "bob", displayName: "Bob", avatarUrl: "https://example.com/bob.jpg" },
    ]);
    const { container } = render(
      React.createElement(CursorOverlay, { mode: "avatar" })
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/bob.jpg");
  });

  it("applies opacity:0 to inactive cursors", () => {
    const oldTime = Date.now() - 10_000; // 10s ago
    mockUseCursors.mockReturnValue(
      makeCursors([
        { userId: "bob", x: 10, y: 20, color: "#f00", displayName: "Bob", lastUpdate: oldTime },
      ])
    );
    const { container } = render(
      React.createElement(CursorOverlay, { inactivityTimeout: 5000 })
    );
    const cursorEl = container.firstElementChild as HTMLElement;
    expect(cursorEl).not.toBeNull();
    expect(cursorEl.style.opacity).toBe("0");
  });

  it("does not fade active cursors", () => {
    mockUseCursors.mockReturnValue(
      makeCursors([
        { userId: "bob", x: 10, y: 20, color: "#f00", displayName: "Bob", lastUpdate: Date.now() },
      ])
    );
    const { container } = render(
      React.createElement(CursorOverlay, { inactivityTimeout: 5000 })
    );
    const cursorEl = container.firstElementChild as HTMLElement;
    expect(cursorEl).not.toBeNull();
    // Active cursor should not have opacity:0
    expect(cursorEl.style.opacity).not.toBe("0");
  });
});

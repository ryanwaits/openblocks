import "./setup";
import { describe, it, expect } from "bun:test";
import type { PresenceUser } from "@waits/lively-types";

const { render } = await import("@testing-library/react");
const React = await import("react");
const { Avatar } = await import("../avatar.js");

function makeUser(overrides?: Partial<PresenceUser>): PresenceUser {
  return {
    userId: "u1",
    displayName: "Alice Bob",
    color: "#ef4444",
    connectedAt: Date.now(),
    onlineStatus: "online",
    lastActiveAt: Date.now(),
    isIdle: false,
    ...overrides,
  };
}

describe("Avatar", () => {
  it("renders initials by default", () => {
    const { container } = render(React.createElement(Avatar, { user: makeUser() }));
    expect(container.textContent).toContain("AB");
  });

  it("renders image when avatarUrl provided", () => {
    const user = makeUser({ avatarUrl: "https://example.com/pic.jpg" });
    const { container } = render(React.createElement(Avatar, { user }));
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/pic.jpg");
  });

  it("does not show status dot by default", () => {
    const { container } = render(React.createElement(Avatar, { user: makeUser() }));
    const dot = container.querySelector("[data-testid='status-dot']");
    expect(dot).toBeNull();
  });

  it("shows status dot when showStatus=true", () => {
    const { container } = render(
      React.createElement(Avatar, { user: makeUser(), showStatus: true })
    );
    const dot = container.querySelector("[data-testid='status-dot']");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("data-status")).toBe("online");
  });

  it("shows away status dot", () => {
    const user = makeUser({ onlineStatus: "away" });
    const { container } = render(
      React.createElement(Avatar, { user, showStatus: true })
    );
    const dot = container.querySelector("[data-testid='status-dot']");
    expect(dot?.getAttribute("data-status")).toBe("away");
  });

  it("shows offline status dot", () => {
    const user = makeUser({ onlineStatus: "offline" });
    const { container } = render(
      React.createElement(Avatar, { user, showStatus: true })
    );
    const dot = container.querySelector("[data-testid='status-dot']");
    expect(dot?.getAttribute("data-status")).toBe("offline");
  });
});

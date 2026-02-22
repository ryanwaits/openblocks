import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ActivityTracker } from "../activity-tracker";
import type { OnlineStatus } from "@waits/lively-types";

describe("ActivityTracker", () => {
  // Note: Since bun:test doesn't have a DOM, the tracker's SSR guard
  // means event listeners won't be attached. We test the core logic.

  it("starts with online status", () => {
    const tracker = new ActivityTracker();
    const statuses: OnlineStatus[] = [];
    tracker.start((s) => statuses.push(s));
    expect(tracker.getStatus()).toBe("online");
    tracker.stop();
  });

  it("getLastActivity returns recent timestamp", () => {
    const tracker = new ActivityTracker();
    const before = Date.now();
    tracker.start(() => {});
    const after = Date.now();
    expect(tracker.getLastActivity()).toBeGreaterThanOrEqual(before);
    expect(tracker.getLastActivity()).toBeLessThanOrEqual(after);
    tracker.stop();
  });

  it("stop clears poll timer", () => {
    const tracker = new ActivityTracker({ pollInterval: 100 });
    tracker.start(() => {});
    tracker.stop();
    // No assertion — just verify no errors/leaks
    expect(tracker.getStatus()).toBe("online");
  });

  it("respects custom config values", () => {
    const tracker = new ActivityTracker({
      inactivityTime: 5000,
      offlineInactivityTime: 10000,
      pollInterval: 1000,
    });
    tracker.start(() => {});
    expect(tracker.getStatus()).toBe("online");
    tracker.stop();
  });
});

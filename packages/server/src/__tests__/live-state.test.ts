import { describe, it, expect } from "bun:test";
import { LiveStateStore } from "../live-state";

describe("LiveStateStore", () => {
  it("set and get", () => {
    const store = new LiveStateStore();
    store.set("filter", "all", 1, "user1");
    expect(store.get("filter")).toEqual({
      value: "all",
      timestamp: 1,
      userId: "user1",
    });
  });

  it("LWW: rejects stale update", () => {
    const store = new LiveStateStore();
    store.set("filter", "all", 5, "user1");
    const accepted = store.set("filter", "active", 3, "user2");
    expect(accepted).toBe(false);
    expect(store.get("filter")?.value).toBe("all");
  });

  it("LWW: accepts newer update", () => {
    const store = new LiveStateStore();
    store.set("filter", "all", 1, "user1");
    const accepted = store.set("filter", "active", 2, "user2");
    expect(accepted).toBe(true);
    expect(store.get("filter")?.value).toBe("active");
  });

  it("LWW: accepts equal timestamp", () => {
    const store = new LiveStateStore();
    store.set("filter", "all", 1, "user1");
    const accepted = store.set("filter", "active", 1, "user2");
    expect(accepted).toBe(true);
  });

  it("merge mode shallow-merges objects", () => {
    const store = new LiveStateStore();
    store.set("config", { a: 1, b: 2 }, 1, "user1");
    store.set("config", { b: 3, c: 4 }, 2, "user2", true);
    expect(store.get("config")?.value).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("merge mode: non-object replaces", () => {
    const store = new LiveStateStore();
    store.set("val", "string", 1, "user1");
    store.set("val", 42, 2, "user2", true);
    expect(store.get("val")?.value).toBe(42);
  });

  it("getAll returns all entries", () => {
    const store = new LiveStateStore();
    store.set("a", 1, 1, "u1");
    store.set("b", 2, 1, "u2");
    const all = store.getAll();
    expect(Object.keys(all)).toEqual(["a", "b"]);
    expect(all.a.value).toBe(1);
    expect(all.b.value).toBe(2);
  });

  it("delete removes entry", () => {
    const store = new LiveStateStore();
    store.set("a", 1, 1, "u1");
    expect(store.delete("a")).toBe(true);
    expect(store.get("a")).toBeUndefined();
  });

  it("delete returns false for missing", () => {
    const store = new LiveStateStore();
    expect(store.delete("nope")).toBe(false);
  });

  it("clear removes all", () => {
    const store = new LiveStateStore();
    store.set("a", 1, 1, "u1");
    store.set("b", 2, 1, "u2");
    store.clear();
    expect(store.getAll()).toEqual({});
  });
});

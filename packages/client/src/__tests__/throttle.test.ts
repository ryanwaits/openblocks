import { describe, it, expect, mock } from "bun:test";
import { throttle } from "../throttle";

describe("throttle", () => {
  it("fires immediately on first call", () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 100);
    throttled(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it("suppresses rapid calls", () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 100);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("trailing call fires after cooldown", async () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 20);
    throttled(1); // fires immediately
    throttled(2); // queued
    throttled(3); // replaces queued

    await new Promise((r) => setTimeout(r, 40));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe(3); // last value wins
  });

  it("allows next call after cooldown", async () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 20);
    throttled(1);
    await new Promise((r) => setTimeout(r, 30));
    throttled(2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe(2);
  });

  it("flush() forces pending call", () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 1000);
    throttled(1); // immediate
    throttled(2); // queued
    throttled.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1][0]).toBe(2);
  });

  it("flush() is no-op with nothing pending", () => {
    const fn = mock(() => {});
    const throttled = throttle(fn, 100);
    throttled.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});

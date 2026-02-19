import { describe, it, expect, mock } from "bun:test";
import { EventEmitter } from "../event-emitter";

type TestEvents = {
  message: (data: string) => void;
  count: (n: number) => void;
};

describe("EventEmitter", () => {
  it("calls listener on emit", () => {
    const emitter = new EventEmitter<TestEvents>();
    const cb = mock(() => {});
    emitter.on("message", cb);
    emitter.emit("message", "hello");
    expect(cb).toHaveBeenCalledWith("hello");
  });

  it("supports multiple listeners", () => {
    const emitter = new EventEmitter<TestEvents>();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});
    emitter.on("message", cb1);
    emitter.on("message", cb2);
    emitter.emit("message", "hi");
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("on() returns unsubscribe function", () => {
    const emitter = new EventEmitter<TestEvents>();
    const cb = mock(() => {});
    const unsub = emitter.on("message", cb);
    unsub();
    emitter.emit("message", "ignored");
    expect(cb).not.toHaveBeenCalled();
  });

  it("off() removes specific listener", () => {
    const emitter = new EventEmitter<TestEvents>();
    const cb = mock(() => {});
    emitter.on("message", cb);
    emitter.off("message", cb);
    emitter.emit("message", "ignored");
    expect(cb).not.toHaveBeenCalled();
  });

  it("removeAllListeners(event) clears one event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const msgCb = mock(() => {});
    const countCb = mock(() => {});
    emitter.on("message", msgCb);
    emitter.on("count", countCb);
    emitter.removeAllListeners("message");
    emitter.emit("message", "gone");
    emitter.emit("count", 42);
    expect(msgCb).not.toHaveBeenCalled();
    expect(countCb).toHaveBeenCalledWith(42);
  });

  it("removeAllListeners() clears all events", () => {
    const emitter = new EventEmitter<TestEvents>();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});
    emitter.on("message", cb1);
    emitter.on("count", cb2);
    emitter.removeAllListeners();
    emitter.emit("message", "gone");
    emitter.emit("count", 0);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("emit with no listeners is a no-op", () => {
    const emitter = new EventEmitter<TestEvents>();
    expect(() => emitter.emit("message", "nothing")).not.toThrow();
  });
});

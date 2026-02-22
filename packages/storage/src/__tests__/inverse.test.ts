import { describe, it, expect } from "bun:test";
import { computeInverseOp, type FieldSnapshot } from "../inverse";
import type {
  SetOp,
  DeleteOp,
  ListInsertOp,
  ListDeleteOp,
  ListMoveOp,
} from "@waits/lively-types";

function makeGetter(
  data: Record<string, FieldSnapshot | undefined>
): (path: string[], key: string) => FieldSnapshot | undefined {
  return (_path, key) => data[key];
}

describe("computeInverseOp", () => {
  describe("set op", () => {
    it("existing field → set with old value", () => {
      const op: SetOp = {
        type: "set",
        path: [],
        key: "name",
        value: "new",
        clock: 2,
      };
      const getter = makeGetter({
        name: { value: "old", clock: 1 },
      });
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "set",
        path: [],
        key: "name",
        value: "old",
        clock: 1,
      });
    });

    it("new field → delete", () => {
      const op: SetOp = {
        type: "set",
        path: ["shapes"],
        key: "abc",
        value: "hello",
        clock: 3,
      };
      const getter = makeGetter({});
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "delete",
        path: ["shapes"],
        key: "abc",
        clock: 0,
      });
    });
  });

  describe("delete op", () => {
    it("existing field → set with old value", () => {
      const op: DeleteOp = {
        type: "delete",
        path: [],
        key: "color",
        clock: 5,
      };
      const getter = makeGetter({
        color: { value: "red", clock: 3 },
      });
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "set",
        path: [],
        key: "color",
        value: "red",
        clock: 3,
      });
    });

    it("missing field → null", () => {
      const op: DeleteOp = {
        type: "delete",
        path: [],
        key: "gone",
        clock: 5,
      };
      const getter = makeGetter({});
      expect(computeInverseOp(op, getter)).toBeNull();
    });
  });

  describe("list-insert op", () => {
    it("inverse is list-delete at same position", () => {
      const op: ListInsertOp = {
        type: "list-insert",
        path: ["items"],
        position: "a0",
        value: "hello",
        clock: 1,
      };
      const getter = makeGetter({});
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "list-delete",
        path: ["items"],
        position: "a0",
        clock: 0,
      });
    });
  });

  describe("list-delete op", () => {
    it("inverse is list-insert with old value", () => {
      const op: ListDeleteOp = {
        type: "list-delete",
        path: ["items"],
        position: "a0",
        clock: 3,
      };
      const getter = makeGetter({
        a0: { value: "stored-value", clock: 1 },
      });
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "list-insert",
        path: ["items"],
        position: "a0",
        value: "stored-value",
        clock: 0,
      });
    });

    it("missing position → null", () => {
      const op: ListDeleteOp = {
        type: "list-delete",
        path: ["items"],
        position: "a0",
        clock: 3,
      };
      const getter = makeGetter({});
      expect(computeInverseOp(op, getter)).toBeNull();
    });
  });

  describe("list-move op", () => {
    it("inverse swaps from/to positions", () => {
      const op: ListMoveOp = {
        type: "list-move",
        path: ["items"],
        fromPosition: "a0",
        toPosition: "a1",
        clock: 2,
      };
      const getter = makeGetter({});
      const inverse = computeInverseOp(op, getter);
      expect(inverse).toEqual({
        type: "list-move",
        path: ["items"],
        fromPosition: "a1",
        toPosition: "a0",
        clock: 0,
      });
    });
  });

  it("unknown op type returns null", () => {
    const op = { type: "unknown", path: [], clock: 0 } as any;
    const getter = makeGetter({});
    expect(computeInverseOp(op, getter)).toBeNull();
  });
});

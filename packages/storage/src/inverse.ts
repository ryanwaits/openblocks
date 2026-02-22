import type {
  StorageOp,
  SerializedCrdt,
  SetOp,
  DeleteOp,
  ListInsertOp,
  ListDeleteOp,
  ListMoveOp,
} from "@waits/lively-types";

export interface FieldSnapshot {
  value: SerializedCrdt;
  clock: number;
}

/**
 * Given a forward op and a way to look up the current value at the target,
 * returns the inverse op that would undo the forward op.
 *
 * `getCurrentValue` returns `{ value, clock }` for existing fields, or
 * `undefined` if the field/position doesn't exist.
 */
export function computeInverseOp(
  op: StorageOp,
  getCurrentValue: (
    path: string[],
    key: string
  ) => FieldSnapshot | undefined
): StorageOp | null {
  switch (op.type) {
    case "set": {
      const setOp = op as SetOp;
      const existing = getCurrentValue(setOp.path, setOp.key);
      if (existing) {
        // Revert to old value
        return {
          type: "set",
          path: setOp.path,
          key: setOp.key,
          value: existing.value,
          clock: existing.clock,
        };
      }
      // Field didn't exist — inverse is delete
      return {
        type: "delete",
        path: setOp.path,
        key: setOp.key,
        clock: 0, // will be re-stamped on undo
      };
    }

    case "delete": {
      const deleteOp = op as DeleteOp;
      const existing = getCurrentValue(deleteOp.path, deleteOp.key);
      if (!existing) return null; // nothing to restore
      return {
        type: "set",
        path: deleteOp.path,
        key: deleteOp.key,
        value: existing.value,
        clock: existing.clock,
      };
    }

    case "list-insert": {
      const insertOp = op as ListInsertOp;
      // Inverse of insert is delete at the same position
      return {
        type: "list-delete",
        path: insertOp.path,
        position: insertOp.position,
        clock: 0,
      };
    }

    case "list-delete": {
      const deleteOp = op as ListDeleteOp;
      const existing = getCurrentValue(deleteOp.path, deleteOp.position);
      if (!existing) return null;
      // Inverse of delete is re-insert at the same position with the old value
      return {
        type: "list-insert",
        path: deleteOp.path,
        position: deleteOp.position,
        value: existing.value,
        clock: 0,
      };
    }

    case "list-move": {
      const moveOp = op as ListMoveOp;
      // Inverse of move(from, to) is move(to, from)
      return {
        type: "list-move",
        path: moveOp.path,
        fromPosition: moveOp.toPosition,
        toPosition: moveOp.fromPosition,
        clock: 0,
      };
    }

    default:
      return null;
  }
}

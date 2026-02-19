import type { BoardObject } from "./board";

export type UndoEntry =
  | { type: "create"; objects: BoardObject[] }
  | { type: "delete"; objects: BoardObject[] }
  | { type: "update"; before: BoardObject[]; after: BoardObject[] };

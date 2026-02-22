import type { Room, LiveObject, LiveMap } from "@waits/lively-client";
import { LiveObject as LO } from "@waits/lively-storage";
import type { BoardObject, Frame } from "@/types/board";
import { serializeBoardState, serializeFrameState } from "./system-prompt";
import { computeEdgePoint, computeLineBounds } from "@/lib/geometry/edge-intersection";
import { frameOriginX, FRAME_ORIGIN_Y } from "@/lib/geometry/frames";
import { cascadeDeleteFrame } from "@/lib/sync/cascade-delete-frame";

export interface ExecutorContext {
  boardId: string;
  boardUUID: string;
  userId: string;
  displayName: string;
  objects: BoardObject[];
  room: Room;
  objectsMap: LiveMap<LiveObject>;
  framesMap?: LiveMap<LiveObject>;
  frames: Frame[];
  activeFrameId?: string;
}

interface ToolResult {
  result: string;
  objects?: BoardObject[];
  newFrameIndex?: number;
}

function nextZIndex(objects: BoardObject[]): number {
  if (objects.length === 0) return 0;
  return Math.max(...objects.map((o) => o.z_index)) + 1;
}

function makeObject(
  ctx: ExecutorContext,
  overrides: Partial<BoardObject> & { type: BoardObject["type"] }
): BoardObject {
  return {
    id: crypto.randomUUID(),
    board_id: ctx.boardUUID,
    type: overrides.type,
    x: overrides.x ?? 400 + Math.random() * 400,
    y: overrides.y ?? 200 + Math.random() * 300,
    width: overrides.width ?? (overrides.type === "sticky" ? 200 : overrides.type === "text" ? 300 : 200),
    height: overrides.height ?? (overrides.type === "sticky" ? 200 : overrides.type === "text" ? 40 : 150),
    color: overrides.color ?? (overrides.type === "sticky" ? "#fef08a" : overrides.type === "rectangle" ? "#bfdbfe" : "transparent"),
    text: overrides.text ?? "",
    z_index: nextZIndex(ctx.objects),
    created_by: ctx.userId,
    created_by_name: `AI (${ctx.displayName})`,
    updated_at: new Date().toISOString(),
    frame_id: ctx.activeFrameId,
  };
}

function boardObjectToLiveData(obj: BoardObject): Record<string, unknown> {
  const data: Record<string, unknown> = { ...obj };
  if (obj.points) {
    data.points = JSON.stringify(obj.points);
  }
  return data;
}

function crdtCreate(ctx: ExecutorContext, obj: BoardObject) {
  ctx.room.batch(() => {
    ctx.objectsMap.set(obj.id, new LO(boardObjectToLiveData(obj)));
  });
  ctx.objects.push(obj);
}

function crdtUpdate(ctx: ExecutorContext, obj: BoardObject) {
  ctx.room.batch(() => {
    const existing = ctx.objectsMap.get(obj.id);
    if (existing) {
      existing.update(boardObjectToLiveData(obj));
    }
  });
}

function crdtDelete(ctx: ExecutorContext, objectId: string) {
  ctx.room.batch(() => {
    ctx.objectsMap.delete(objectId);
  });
  const idx = ctx.objects.findIndex((o) => o.id === objectId);
  if (idx !== -1) ctx.objects.splice(idx, 1);
}

export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ExecutorContext
): Promise<ToolResult> {
  switch (toolName) {
    case "createStickyNote": {
      const obj = makeObject(ctx, {
        type: "sticky",
        x: toolInput.x as number | undefined,
        y: toolInput.y as number | undefined,
        color: (toolInput.color as string) || "#fef08a",
        text: (toolInput.text as string) || "",
      });
      crdtCreate(ctx, obj);
      return { result: `Created sticky note "${obj.text}" (id: ${obj.id})`, objects: [obj] };
    }

    case "createShape": {
      const rawType = toolInput.type as string;
      const shapeType = rawType === "text" ? "text" as const
        : rawType === "circle" ? "circle" as const
        : rawType === "diamond" ? "diamond" as const
        : rawType === "pill" ? "pill" as const
        : "rectangle" as const;
      const shapeDefaults: Record<string, { width: number; height: number; color: string }> = {
        text: { width: 300, height: 40, color: "transparent" },
        circle: { width: 150, height: 150, color: "#dbeafe" },
        diamond: { width: 150, height: 150, color: "#e9d5ff" },
        pill: { width: 200, height: 80, color: "#d1fae5" },
        rectangle: { width: 200, height: 150, color: "#bfdbfe" },
      };
      const defaults = shapeDefaults[shapeType] || shapeDefaults.rectangle;
      const obj = makeObject(ctx, {
        type: shapeType,
        x: toolInput.x as number | undefined,
        y: toolInput.y as number | undefined,
        width: (toolInput.width as number) || defaults.width,
        height: (toolInput.height as number) || defaults.height,
        color: (toolInput.color as string) || defaults.color,
        text: (toolInput.text as string) || "",
      });
      crdtCreate(ctx, obj);
      return { result: `Created ${shapeType} (id: ${obj.id})`, objects: [obj] };
    }

    case "moveObject": {
      const obj = ctx.objects.find((o) => o.id === toolInput.objectId);
      if (!obj) return { result: `Error: object ${toolInput.objectId} not found` };
      obj.x = toolInput.x as number;
      obj.y = toolInput.y as number;
      obj.updated_at = new Date().toISOString();
      crdtUpdate(ctx, obj);
      return { result: `Moved object ${obj.id} to (${obj.x}, ${obj.y})`, objects: [obj] };
    }

    case "resizeObject": {
      const obj = ctx.objects.find((o) => o.id === toolInput.objectId);
      if (!obj) return { result: `Error: object ${toolInput.objectId} not found` };
      obj.width = toolInput.width as number;
      obj.height = toolInput.height as number;
      obj.updated_at = new Date().toISOString();
      crdtUpdate(ctx, obj);
      return { result: `Resized object ${obj.id} to ${obj.width}x${obj.height}`, objects: [obj] };
    }

    case "updateText": {
      const obj = ctx.objects.find((o) => o.id === toolInput.objectId);
      if (!obj) return { result: `Error: object ${toolInput.objectId} not found` };
      obj.text = toolInput.newText as string;
      obj.updated_at = new Date().toISOString();
      crdtUpdate(ctx, obj);
      return { result: `Updated text of ${obj.id}`, objects: [obj] };
    }

    case "changeColor": {
      const obj = ctx.objects.find((o) => o.id === toolInput.objectId);
      if (!obj) return { result: `Error: object ${toolInput.objectId} not found` };
      obj.color = toolInput.color as string;
      obj.updated_at = new Date().toISOString();
      crdtUpdate(ctx, obj);
      return { result: `Changed color of ${obj.id} to ${obj.color}`, objects: [obj] };
    }

    case "createConnector": {
      const fromId = toolInput.fromObjectId as string | undefined;
      const toId = toolInput.toObjectId as string | undefined;
      const fromPoint = toolInput.fromPoint as { x: number; y: number } | undefined;
      const toPoint = toolInput.toPoint as { x: number; y: number } | undefined;

      let startPt: { x: number; y: number };
      const fromObj = fromId ? ctx.objects.find((o) => o.id === fromId) : undefined;
      if (fromObj) {
        startPt = { x: fromObj.x + fromObj.width / 2, y: fromObj.y + fromObj.height / 2 };
      } else if (fromPoint) {
        startPt = fromPoint;
      } else {
        return { result: "Error: must provide fromObjectId or fromPoint" };
      }

      let endPt: { x: number; y: number };
      const toObj = toId ? ctx.objects.find((o) => o.id === toId) : undefined;
      if (toObj) {
        endPt = { x: toObj.x + toObj.width / 2, y: toObj.y + toObj.height / 2 };
      } else if (toPoint) {
        endPt = toPoint;
      } else {
        return { result: "Error: must provide toObjectId or toPoint" };
      }

      const resolvedStart = fromObj ? computeEdgePoint(fromObj, endPt) : startPt;
      const resolvedEnd = toObj ? computeEdgePoint(toObj, resolvedStart) : endPt;

      const points = [resolvedStart, resolvedEnd];
      const bounds = computeLineBounds(points);

      const arrowEnd = (toolInput.arrowEnd as string) || "end";
      const strokeColor = (toolInput.color as string) || "#374151";
      const label = (toolInput.label as string) || undefined;

      const obj = makeObject(ctx, {
        type: "line",
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color: "transparent",
      });
      obj.points = points;
      obj.stroke_color = strokeColor;
      obj.stroke_width = 2;
      obj.start_arrow = arrowEnd === "start" || arrowEnd === "both";
      obj.end_arrow = arrowEnd === "end" || arrowEnd === "both";
      obj.start_object_id = fromId || null;
      obj.end_object_id = toId || null;
      if (label) obj.label = label;

      crdtCreate(ctx, obj);
      return { result: `Created connector (id: ${obj.id})${fromId ? ` from ${fromId}` : ""}${toId ? ` to ${toId}` : ""}`, objects: [obj] };
    }

    case "createFrame": {
      if (!ctx.framesMap) return { result: "Error: frames storage not available" };
      const nextIndex = ctx.frames.length === 0
        ? 0
        : Math.max(...ctx.frames.map((f) => f.index)) + 1;
      const label = (toolInput.label as string) || `Frame ${nextIndex + 1}`;
      const frame: Frame = { id: crypto.randomUUID(), index: nextIndex, label };
      ctx.room.batch(() => {
        ctx.framesMap!.set(frame.id, new LO({ ...frame }));
      });
      ctx.frames.push(frame);
      // Update active frame so subsequent objects go to this new frame
      ctx.activeFrameId = frame.id;
      const originX = frameOriginX(nextIndex);
      return {
        result: `Created frame "${label}" (id: ${frame.id}, index: ${nextIndex}). Place objects using local coordinates (e.g. x: 200–800, y: 100–600). Objects are automatically assigned to the active frame.`,
        newFrameIndex: nextIndex,
      };
    }

    case "deleteObject": {
      const idx = ctx.objects.findIndex((o) => o.id === toolInput.objectId);
      if (idx === -1) return { result: `Error: object ${toolInput.objectId} not found` };
      crdtDelete(ctx, toolInput.objectId as string);
      return { result: `Deleted object ${toolInput.objectId}` };
    }

    case "deleteFrame": {
      if (!ctx.framesMap) return { result: "Error: frames storage not available" };
      const frameId = toolInput.frameId as string;
      const idx = ctx.frames.findIndex((f) => f.id === frameId);
      if (idx === -1) return { result: `Error: frame ${frameId} not found` };
      ctx.room.batch(() => {
        cascadeDeleteFrame(ctx.objectsMap, ctx.framesMap!, frameId);
      });
      ctx.frames.splice(idx, 1);
      ctx.objects = ctx.objects.filter((o) => ctx.objectsMap.has(o.id));
      return { result: `Deleted frame ${frameId} and all contained objects` };
    }

    case "getBoardState": {
      return { result: `${serializeBoardState(ctx.objects)}${serializeFrameState(ctx.frames)}` };
    }

    default:
      return { result: `Unknown tool: ${toolName}` };
  }
}

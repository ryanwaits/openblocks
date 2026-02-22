import Anthropic from "@anthropic-ai/sdk";
import { LivelyClient, type Room, type LiveObject, type LiveMap } from "@waits/lively-client";
import WebSocket from "ws";
import { AI_TOOLS } from "@/lib/ai/tools";
import { SYSTEM_PROMPT, serializeBoardState, serializeFrameState } from "@/lib/ai/system-prompt";
import { executeToolCall, type ExecutorContext } from "@/lib/ai/executor";
import type { BoardObject, Frame } from "@/types/board";

const anthropic = new Anthropic();

// In-memory rate limiter
const rateLimits = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(userId, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterSec = Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  entry.count++;
  return { allowed: true };
}

function liveObjectToBoardObject(lo: LiveObject): BoardObject {
  const raw = lo.toObject();
  const obj = { ...raw } as unknown as BoardObject;
  if (typeof obj.points === "string") {
    try { obj.points = JSON.parse(obj.points as unknown as string); } catch { obj.points = undefined; }
  }
  return obj;
}

function liveObjectToFrame(lo: LiveObject): Frame {
  return lo.toObject() as unknown as Frame;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, boardId, userId, displayName, selectedIds, activeFrameId } = body as {
      message: string;
      boardId: string;
      userId: string;
      displayName: string;
      selectedIds?: string[];
      activeFrameId?: string;
    };

    if (!message || !boardId || !userId || !displayName) {
      return Response.json({ error: "Missing required fields: message, boardId, userId, displayName" }, { status: 400 });
    }

    // Rate limit
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return Response.json(
        { error: `Rate limit exceeded, try again in ${rateCheck.retryAfterSec} seconds` },
        { status: 429 }
      );
    }

    const serverUrl = process.env.LIVELY_SERVER_URL || "http://localhost:1999";

    // Create temporary Lively client with Node.js ws
    const client = new LivelyClient({
      serverUrl,
      WebSocket: WebSocket as unknown as { new (url: string): globalThis.WebSocket },
      reconnect: false,
    });

    const room = client.joinRoom(boardId, {
      userId: `ai-${userId}`,
      displayName: `AI (${displayName})`,
    });

    // Wait for storage with timeout
    let storage: { root: LiveObject };
    try {
      storage = await Promise.race([
        room.getStorage(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Storage timeout")), 5000)
        ),
      ]);
    } catch {
      client.leaveRoom(boardId);
      return Response.json({ error: "Failed to connect to board server" }, { status: 503 });
    }

    const { root } = storage;
    const objectsMap = root.get("objects") as LiveMap<LiveObject>;
    const framesMap = root.get("frames") as LiveMap<LiveObject> | undefined;

    // Read current objects from CRDT
    const objects: BoardObject[] = [];
    if (objectsMap) {
      objectsMap.forEach((lo: LiveObject) => {
        objects.push(liveObjectToBoardObject(lo));
      });
    }

    // Read frames from CRDT
    const frames: Frame[] = [];
    if (framesMap) {
      framesMap.forEach((lo: LiveObject) => {
        frames.push(liveObjectToFrame(lo));
      });
    }

    const boardUUID = boardId === "default" ? "00000000-0000-0000-0000-000000000000" : boardId;

    // Filter objects to active frame — AI can only see and modify objects on the active frame
    const frameObjects = activeFrameId
      ? objects.filter((o) => o.frame_id === activeFrameId)
      : objects;

    const ctx: ExecutorContext = {
      boardId,
      boardUUID,
      userId,
      displayName,
      objects: frameObjects,
      room,
      objectsMap,
      framesMap: framesMap ?? undefined,
      frames,
      activeFrameId,
    };

    // Build user message with board state + selection context
    let userContent = `Current board state:\n${serializeBoardState(frameObjects)}${serializeFrameState(frames)}`;
    if (selectedIds && selectedIds.length > 0) {
      const selectedObjs = frameObjects.filter((o) => selectedIds.includes(o.id));
      if (selectedObjs.length > 0) {
        userContent += `\n\nCurrently selected objects (user has these selected):\n${JSON.stringify(selectedObjs.map((o) => ({ id: o.id, type: o.type, text: o.text })))}`;
      }
    }
    userContent += `\n\nUser request: ${message}`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userContent },
    ];

    let objectsCreated = 0;
    let objectsModified = 0;
    let textResponse = "";
    let newFrameIndex: number | null = null;
    const affectedBounds: { x: number; y: number; width: number; height: number }[] = [];

    // Agentic loop
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: AI_TOOLS,
      messages,
    });

    for (let iteration = 0; iteration < 10; iteration++) {
      if (response.stop_reason !== "tool_use") break;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      const modifyTools = ["moveObject", "resizeObject", "updateText", "changeColor"];
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        const result = await executeToolCall(tool.name, tool.input as Record<string, unknown>, ctx);
        const isModify = modifyTools.includes(tool.name);
        if (result.objects) {
          if (!isModify) objectsCreated += result.objects.length;
          for (const obj of result.objects) {
            affectedBounds.push({ x: obj.x, y: obj.y, width: obj.width, height: obj.height });
          }
        }
        if (isModify) objectsModified++;
        if (tool.name === "createFrame" && result.newFrameIndex != null) {
          newFrameIndex = result.newFrameIndex;
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: result.result,
        });
      }

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: AI_TOOLS,
        messages,
      });
    }

    // Extract final text
    for (const block of response.content) {
      if (block.type === "text") {
        textResponse += block.text;
      }
    }

    // Disconnect AI client
    client.leaveRoom(boardId);

    return Response.json({ reply: textResponse, objectsCreated, objectsModified, newFrameIndex, affectedBounds });
  } catch (e: unknown) {
    console.error("AI route error:", e);
    const msg = e instanceof Anthropic.APIError
      ? e.status === 429
        ? "AI rate limit reached. Please try again in a moment."
        : e.status === 401
          ? "Invalid AI API key. Please check ANTHROPIC_API_KEY."
          : `AI error: ${e.message}`
      : "AI processing failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

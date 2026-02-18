import Anthropic from "@anthropic-ai/sdk";
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, boardId, userId, displayName, selectedIds, history } = body as {
      message: string;
      boardId: string;
      userId: string;
      displayName: string;
      selectedIds?: string[];
      history?: { role: "user" | "assistant"; content: string }[];
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

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const aiSecret = process.env.AI_SECRET;
    const partyKitHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST;

    if (!supabaseUrl || !supabaseServiceRoleKey || !aiSecret || !partyKitHost) {
      return Response.json({ error: "Server misconfigured — missing env vars" }, { status: 500 });
    }

    const partyKitBaseUrl = partyKitHost.includes("localhost")
      ? `http://${partyKitHost}`
      : partyKitHost.startsWith("http")
        ? partyKitHost
        : `https://${partyKitHost}`;

    // Resolve board UUID
    const boardUUID = boardId === "default" ? "00000000-0000-0000-0000-000000000000" : boardId;

    // Fetch board state from Supabase
    const stateRes = await fetch(
      `${supabaseUrl}/rest/v1/board_objects?board_id=eq.${boardUUID}&select=*`,
      {
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
      }
    );
    if (!stateRes.ok) {
      return Response.json({ error: "Failed to fetch board state" }, { status: 500 });
    }
    const objects: BoardObject[] = await stateRes.json();

    // Fetch frames from boards table
    let frames: Frame[] = [];
    try {
      const framesRes = await fetch(
        `${supabaseUrl}/rest/v1/boards?id=eq.${boardUUID}&select=frames`,
        {
          headers: {
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
          },
        }
      );
      if (framesRes.ok) {
        const boards = await framesRes.json();
        if (boards.length > 0 && Array.isArray(boards[0].frames)) {
          frames = boards[0].frames;
        }
      }
    } catch {
      // frames fetch is best-effort
    }

    const ctx: ExecutorContext = {
      boardId,
      boardUUID,
      userId,
      displayName,
      objects,
      partyKitBaseUrl,
      aiSecret,
      supabaseUrl,
      supabaseServiceRoleKey,
    };

    // Build user message with board state + selection context
    let userContent = `Current board state:\n${serializeBoardState(objects)}${serializeFrameState(frames)}`;
    if (selectedIds && selectedIds.length > 0) {
      const selectedObjs = objects.filter((o) => selectedIds.includes(o.id));
      if (selectedObjs.length > 0) {
        userContent += `\n\nCurrently selected objects (user has these selected):\n${JSON.stringify(selectedObjs.map((o) => ({ id: o.id, type: o.type, text: o.text })))}`;
      }
    }
    userContent += `\n\nUser request: ${message}`;

    // Build messages with conversation history for multi-turn context
    const messages: Anthropic.MessageParam[] = [];
    if (history && history.length > 0) {
      // Keep last 20 messages to avoid token bloat
      const recent = history.slice(-20);
      for (const msg of recent) {
        messages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
      }
    }
    messages.push({ role: "user", content: userContent });

    let objectsCreated = 0;
    let objectsModified = 0;
    let textResponse = "";

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

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tool of toolUseBlocks) {
        const result = await executeToolCall(tool.name, tool.input as Record<string, unknown>, ctx);
        if (result.objects) objectsCreated += result.objects.length;
        if (["moveObject", "resizeObject", "updateText", "changeColor"].includes(tool.name)) {
          objectsModified++;
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

    return Response.json({ reply: textResponse, objectsCreated, objectsModified });
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

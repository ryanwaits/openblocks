# AI Development Log — CollabBoard

## Tools & Workflow

**Claude Code (Opus 4.6)** — sole development tool. Every line of production code was written through Claude Code across 164 commits over 7 days. Opus handled both planning and execution for the first half of the week. When Sonnet 4.6 dropped mid-week, the workflow shifted: Opus for planning/architecture, Sonnet 4.6 for execution. The speed and quality improvement was notable — Sonnet 4.6 could one-shot detailed plans with near-zero regressions.

**Zed IDE** — used only for environment variable management and minor config tweaks. No code authoring.

**Claude API (Sonnet 4, in-app)** — the production AI agent uses Claude's tool-calling API for natural language board manipulation. This is the product, not a dev tool, but it represents a second AI integration in the stack.

## MCP Usage

No MCP integrations were used. The project didn't require external service integrations beyond what Supabase client libraries and PartyKit provided natively. Claude Code's built-in file system, git, and terminal tools were sufficient for the entire development workflow.

## Effective Prompts

**1. Structured plan mode (via CLAUDE.md instructions)**
```
"Structure plans as sprints with atomic tasks. Each task must be atomic and committable.
Every task includes explicit validation criteria. Before exiting plan mode, spawn a
subagent to review: are tasks truly atomic? Is validation clear? Do sprints produce
demoable output?"
```
Result: This CLAUDE.md instruction shaped every planning session. Having an AI review agent validate plans before execution prevented cascading issues. Plans came out detailed enough that execution was mostly one-shot.

**2. SDK API documentation generation**
```
"Identify all new exports and public functions from the refactored package. Document
the API design from a DX perspective — how to use each function, but also WHY and
WHEN a consumer would reach for it. Include code examples."
```
Result: After each major refactor (Konva→SVG, PartyKit→WebSocket, app code→SDK packages), this prompt generated comprehensive API guides that served as both documentation and design validation. Forced clarity on whether the API surface made sense.

**3. `/done` skill for atomic commits**
```
/done
```
Result: Custom Claude Code skill that analyzes all uncommitted changes, groups them into logical feature commits with conventional commit messages, and executes sequentially. Turned messy working trees into clean, reviewable git history without manual staging.

**4. Full-stack vertical feature implementation**
```
"Build the AI agent for the whiteboard. It needs these tools: createStickyNote,
createShape, moveObject, resizeObject, updateText, changeColor, getBoardState.
The flow is: client POST → /api/ai → Claude tool calls → Supabase persist +
PartyKit broadcast. All users must see results in real-time."
```
Result: One-shot implementation of the full AI agent pipeline — API route, tool schemas, executor functions, Supabase persistence, PartyKit broadcast integration — all wired together and working on first run.

**5. Incremental SDK extraction**
```
"Extract the WebSocket presence/cursor/storage sync logic from the whiteboard app
into reusable packages. Start with shared types, then storage (CRDT), then server,
then client SDK, then React hooks. Each package must have its own tests, build,
and exports. Workspace deps use workspace:*."
```
Result: Clean extraction of a full Liveblocks alternative (`@waits/lively-*`) across 5 packages with 317 tests. The phased approach meant each layer was stable before the next was built on top.

## Code Analysis

- **AI-generated: ~95%** — virtually all production code was authored by Claude Code
- **Hand-written: ~5%** — environment variables, deployment configs, minor Zed edits
- **Methodology**: 164 commits over 7 days, all created through Claude Code sessions. Manual edits were limited to `.env.local` values and occasional config adjustments in Zed.

## Strengths & Limitations

**AI excelled at:**
- **Architecture scaffolding** — designing and implementing the full SDK package structure from scratch
- **Multi-file refactors** — migrating from Konva to SVG, PartyKit to raw WebSockets, app code to SDK packages, all across dozens of files simultaneously
- **Test generation** — 317 tests across 5 packages including real WebSocket integration tests
- **Plan execution** — when given a detailed, validated plan, Sonnet 4.6 could implement entire sprints with minimal iteration
- **API design** — generating clean, composable React hooks and TypeScript APIs

**AI struggled with:**
- **Browser automation speed** — agent-browser tooling works but iteration cycles are slow; less control over the black box compared to direct code manipulation
- **Environment/deploy configuration** — PartyKit deployment config, env var precedence, Vercel workspace builds required multiple iterations
- **Visual debugging** — canvas rendering issues and real-time cursor behavior needed manual observation that AI couldn't perform

## Key Learnings

The single biggest insight: **spend 90% of your time planning**. The quality of Claude Code's output is directly proportional to the detail of the plan. This compounded across three major architectural pivots:

1. First version: Konva + PartyKit (functional but limited)
2. Refactor: SVG + raw WebSockets (better performance, more control)
3. Extraction: Reusable SDK packages (production-grade DX)

Each pivot could have been a debugging nightmare, but detailed plans that considered developer experience, internal API design, AND end-user experience meant Claude mostly one-shot the implementations. The planning→review→execute loop (with an AI review agent validating plans before execution) prevented the compounding issue spiral that happens when you skip planning and start debugging.

The other key pattern: **vertical slices over horizontal layers**. Building one complete feature (cursor sync end-to-end) before starting the next (object sync) gave Claude Code the context it needed to produce correct, integrated code rather than disconnected pieces.

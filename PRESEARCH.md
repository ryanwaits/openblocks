# Pre-Search: Collaborative Whiteboard with AI Agent

## Project Context

One-week sprint building a production-scale collaborative whiteboard (Miro-like) with AI agent integration. Three deadlines: MVP (24hrs), early submission (4 days), final (7 days). MVP is a hard gate — multiplayer must work before anything else.

---

## Phase 1: Constraints

### Scale & Load Profile
- **Launch**: 5-10 users (Gauntlet evaluators)
- **Traffic**: Spiky — evaluators hit during review windows
- **Real-time**: Hard requirement. Cursor sync <50ms, object sync <100ms
- **Cold start**: Low tolerance — app must be responsive immediately
- **Key metric**: 5+ concurrent users on a single board without degradation

### Budget
- $450 for 10-week fellowship (~$45/week, front-loaded for this project)
- Heavy models in development to nail functionality, throttle back for production LLM usage
- All hosting/infra on free tiers at this scale

### Timeline
| Checkpoint | Deadline | Focus |
|------------|----------|-------|
| Pre-Search | Monday | Architecture, planning |
| MVP | Tuesday (24hrs) | Multiplayer infrastructure |
| Early Submission | Friday (4 days) | Full feature set + AI agent |
| Final | Sunday (7 days) | Polish, docs, deployment |

### Compliance
Not applicable. No HIPAA, GDPR, SOC2, or data residency concerns.

### Team
Solo developer. Strong in TypeScript, React, Tailwind, Bun. Familiar with Supabase Realtime and Liveblocks. Canvas rendering experience with raw HTML5 Canvas. Some viewport/pan-zoom experience.

---

## Phase 2: Architecture Decisions

### Canvas Rendering — Konva.js / react-konva

**Decision**: Konva.js via react-konva for all canvas rendering.

**Why**: Konva provides a scene graph with layers, shapes, events, and transforms without being a whiteboard itself. We build the whiteboard features (selection, multi-select, toolbar, pan/zoom) on top of solid rendering primitives. This gives us full ownership of the architecture, a clean component model via react-konva, and a lighter dependency footprint than full whiteboard SDKs.

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **tldraw** | It *is* a whiteboard — using it means skinning someone else's product. Opinionated internals would fight our custom sync logic and AI agent integration. Hard to customize outside its paradigms. |
| **Fabric.js** | Older API, less React-friendly, smaller community momentum. Similar capability to Konva but worse DX for our stack. |
| **Raw HTML5 Canvas** | Maximum control but too much foundational work for a 24-hour MVP. No scene graph means building hit detection, event delegation, and transform math from scratch. |

**What would make us revisit**: If Konva's performance degrades significantly at 500+ objects, we'd consider dropping to raw Canvas for the rendering layer while keeping the same state architecture.

---

### Real-Time Layer — PartyKit (Consolidated)

**Decision**: PartyKit as the sole real-time layer for all WebSocket communication — cursors, object sync, and presence. Supabase Realtime dropped entirely.

**Why**: Initial plan was Supabase Realtime, but research showed its broadcast latency (50-150ms) is borderline for the <50ms cursor sync target. Every major whiteboard tool (Figma, Miro, tldraw) uses dedicated WebSocket infrastructure for real-time data. Rather than running a hybrid setup (Supabase Realtime for objects + PartyKit for cursors), we consolidated to a single real-time system. One connection per client, one reconnection strategy, one system to debug.

PartyKit runs on Cloudflare's edge via Durable Objects. Its room-based model maps 1:1 to whiteboard boards. Deploy is `npx partykit deploy`. The `partysocket` client has built-in reconnection with backoff. Free tier covers our scale.

**Architecture**:
```
Client ←——WebSocket——→ PartyKit Room Server ——writes——→ Supabase Postgres
                                             ←—reads—— (board load)
```

**Data flow by type**:
- **Cursors**: Client → PartyKit broadcast → other clients. Ephemeral, no persistence. Throttled at ~60Hz client-side. This is correct per PRD — cursor positions are transient state that should disappear when a user disconnects, not persist.
- **Object mutations** (create/move/edit/delete): Client → PartyKit broadcast → other clients AND PartyKit writes to Supabase Postgres for durability. Persist on mutation-end (e.g., drag-end, not every frame).
- **Presence** (who's online): Derived from active PartyKit connections via `onConnect`/`onClose`. Ephemeral — no persistence needed.
- **Board load**: Client joins room → PartyKit loads board state from Postgres → hydrates client.
- **AI agent writes**: API route writes to Postgres → sends HTTP message to PartyKit room → PartyKit broadcasts to all clients. Objects trickle in one-by-one for multi-step commands (e.g., SWOT template).

**Sync strategy**:
- **Conflict resolution**: Last-write-wins with timestamps, documented explicitly
- **Throttling**: Broadcast position during drag, persist on drag-end only
- **Cursor interpolation**: Client-side lerp over ~50ms to mask network jitter (pattern used by Figma, Liveblocks, tldraw)
- **Rooms scoped per board**: `board:{id}` — multi-board ready from day one

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **Supabase Realtime** | Initial choice. Broadcast latency 50-150ms fails <50ms cursor target. Would require a second WebSocket layer for cursors anyway, creating two real-time systems to manage. Dropped in favor of consolidating on PartyKit. |
| **Liveblocks** | Purpose-built for this use case. Rejected because it abstracts away sync logic entirely — we'd lose the ability to tune conflict resolution and debug sync issues. Vendor lock-in for the core feature. Expensive at scale ($1/MAU). |
| **Custom WebSocket (ws/Socket.io) on Fly.io** | Lowest possible latency (5-15ms) but requires building rooms, presence, reconnection, health checks, and scaling from scratch. Not worth the operational burden at our scale. Worth reconsidering post-MVP if PartyKit latency becomes a bottleneck — at that point the core sync logic is proven and we'd be migrating transport, not rewriting architecture. |
| **Hybrid (Supabase RT + PartyKit)** | Two real-time systems = two connections per client, two reconnection handlers, two debugging surfaces. Consolidating on PartyKit is simpler and gives better latency for both cursors AND objects. |

**What would make us revisit**: If PartyKit's Durable Object single-region pinning causes latency issues for geographically distributed evaluators, we'd evaluate whether to pin the DO to a central region or add regional relay logic. Unlikely at our scale.

---

### Authentication — Supabase Anonymous Auth + Display Name

**Decision**: Anonymous authentication via Supabase Auth with a display name prompt on entry.

**Why**: The PRD requires "User authentication" as an MVP hard gate, but specifies nothing about method. Anonymous auth creates a real auth session (UUID, JWT, session management) with zero user friction. Evaluators type a name and they're in — no signup flow, no OAuth consent screens, no blocked testers. The auth infrastructure is real, so upgrading to email/password or OAuth later is trivial.

**How it works**:
1. User hits app → "Enter your name" screen
2. Supabase creates anonymous auth session behind the scenes
3. User gets a real `user.id` (UUID) and JWT
4. Display name stored in user metadata
5. Cursors and presence use display name, board objects tied to user ID

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **Google OAuth + email/password** | Overengineered for a sprint project. Adds friction for evaluators who need to test quickly. OAuth consent screens slow down the demo flow. |
| **Cookie/localStorage + IP** | Not real authentication. No session management, no reconnection identity, no user ID for object ownership. Would not defensibly check the "User authentication" MVP box. |
| **Magic links** | Email delivery latency during live evaluation is a risk. Adds unnecessary complexity. |

**What would make us revisit**: If evaluators explicitly flag anonymous auth as insufficient, we can add email/password to the existing Supabase Auth setup in ~20 minutes.

---

### Database — Supabase Postgres

**Decision**: Supabase-managed Postgres for all persistent data.

**Why**: Already in the Supabase ecosystem for auth. Postgres gives us relational integrity, RLS policies for security, and a proven query layer. PartyKit handles all real-time communication; Postgres is the durable source of truth that PartyKit reads from and writes to. The data model is simple enough that we don't need a document store or specialized DB.

**Schema design** (multi-board ready from day one):
- `boards` — board metadata (id, name, created_at, created_by)
- `board_objects` — every canvas object (id, board_id, type, x, y, width, height, color, text, z_index, created_by, updated_at)
- Board ID on every object row, realtime channels scoped to `board:{id}`
- MVP uses a single default board; multi-board is a routing change, not a schema change

**Read/write pattern**:
- Heavy writes during active sessions (object manipulation)
- Heavy reads on board load (fetch all objects for a board)
- Ephemeral data (cursors) never hits the DB

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **SQLite** | Good for embedded/local-first, but adds complexity for a deployed multi-user app. Would need a separate hosting solution and custom sync layer. |
| **Firebase Firestore** | Document model works for this data, but pulls us into a second ecosystem alongside Supabase. One platform > two. |
| **Redis** | Good for ephemeral data and pub/sub, but PartyKit already handles that. Doesn't replace the need for persistent storage. |

---

### State Management — Zustand

**Decision**: Zustand for client-side state orchestration.

**Why**: Three layers of state need coordination: canvas state (Konva), board state (Postgres), and ephemeral state (Realtime broadcast). Zustand's minimal API works outside React (so the sync layer can update state without re-render storms), supports store slicing (cursor updates don't trigger object re-renders), and is ~1kb gzipped.

**State architecture**:
- **Board store**: Board objects, CRUD operations, selection state
- **Presence store**: Cursor positions, online users
- Sync layer reads/writes to stores independently of React render cycle
- Konva components subscribe to relevant slices only

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **React Context + useReducer** | No extra dependency, but high-frequency updates (cursor positions at 60fps) would cause re-render storms across the component tree. |
| **Jotai/Valtio** | Capable but adds same dependency cost as Zustand with less ecosystem familiarity. Zustand's out-of-React usage pattern is a better fit for the sync layer. |

---

### AI Agent — Claude Sonnet via Next.js API Routes

**Decision**: Anthropic Claude (Sonnet for production, heavier models in dev) with tool/function calling, served through Next.js API routes on Vercel.

**Why**: Claude's tool use maps cleanly to board manipulation actions (`createStickyNote`, `moveObject`, etc.). Sonnet is fast and cheap enough for production while being capable enough for structured tool calls. Next.js API routes keep the AI endpoint in the same codebase and deploy target — no separate backend service.

**AI agent architecture** (server-side execution with trickle-in):
- User sends natural language command via chat/command bar
- API route receives command + current board state via `getBoardState()`
- Claude processes command, returns tool calls
- API route executes tool calls: writes to Supabase Postgres + sends HTTP message to PartyKit room
- PartyKit broadcasts each change to all clients — for multi-step commands (e.g., "create SWOT analysis"), objects appear one-by-one as the AI "builds" the template
- All users see AI-generated results in real-time through the same sync channel as manual edits
- Server-side execution is simpler (no client-side tool call interpreter), naturally supports multi-step commands, and the "trickle-in" effect gives good visual feedback

**Cost strategy**:
- Dev: Use Claude Opus/Sonnet 4.5 for prompt development and edge case testing
- Production: Lock in Sonnet for all user-facing AI commands
- Rate limit per user session to prevent cost spikes

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **OpenAI GPT-4** | Comparable function calling capability. Rejected to stay in the Anthropic ecosystem (already using Claude Code for development). No strong technical reason against it. |
| **Supabase Edge Functions** | Deno runtime, cold starts, and weaker debugging story. Since we're already deploying to Vercel with Next.js, API routes are the simpler path. |

---

### Hosting — Vercel

**Decision**: Vercel for frontend hosting and API routes.

**Why**: Native Next.js support, zero-config deploys, edge network for fast loads, and we're already using it for API routes. Free tier covers this project's scale easily.

**Alternatives considered**:
| Option | Why rejected |
|--------|-------------|
| **Firebase Hosting** | Would pull us into a second ecosystem. No benefit over Vercel for Next.js. |
| **Render** | Capable but slower deploys and less Next.js optimization than Vercel. |
| **Self-hosted VPS** | Unnecessary operational burden for a sprint project at this scale. |

---

## Phase 3: Post-Stack Refinement

### Security Priorities
1. **RLS policies on Supabase** — scope all queries to board membership. Without this, any user can read/write any board's data.
2. **AI agent rate limiting** — open endpoint calling Claude is a cost bomb. Rate limit per user session.
3. **API keys server-side only** — Claude keys stay in Next.js API routes, never client-side.
4. **Input sanitization** — display names and sticky note text that render in UI components (not Canvas, which doesn't execute HTML).
5. **Anonymous auth abuse** — Supabase built-in rate limiting on auth endpoint.

### File Structure
```
party/
  board-room.ts               — PartyKit server: cursor broadcast, object sync, presence
src/
  app/
    board/[id]/page.tsx       — board view
    api/ai/route.ts           — AI agent endpoint
    layout.tsx
    page.tsx                  — landing / redirect to default board
  components/
    canvas/                   — Konva canvas, shapes, selection, toolbar
    ui/                       — shadcn components
    presence/                 — cursor overlays, online users list
  lib/
    supabase/                 — client config, types
    sync/                     — PartyKit client hooks, broadcast handlers
    store/                    — Zustand stores (board, presence)
    ai/                       — agent schema, tool definitions, prompts
  types/                      — shared TypeScript types
partykit.json                 — PartyKit config (name, main entry, compat date)
```

### Testing Strategy
- **No unit tests for MVP** — time goes to sync reliability instead
- **Manual multi-browser testing continuously** — two+ windows open during all dev
- **Evaluation scenario checklist** (run before every submission):
  1. 2 users editing simultaneously in different browsers
  2. One user refreshes mid-edit — state persists
  3. Rapid sticky note creation and movement — sync holds
  4. Network throttle in DevTools — graceful disconnect/reconnect
  5. 5+ concurrent users — no degradation

### Naming Conventions
- Files: kebab-case
- Components: PascalCase
- Functions/variables: camelCase
- Types: PascalCase, no `I` prefix
- Zustand stores: `use[Name]Store`
- DB columns: snake_case

### Dev Tooling
- **Claude Code** — primary AI dev tool
- **Cursor** — secondary (satisfies "2+ AI tools" requirement)
- **Chrome DevTools** — network throttling for disconnect testing
- **Supabase Dashboard** — realtime monitoring, data inspection

---

## Full Stack Summary

| Layer | Choice | Why (one line) |
|-------|--------|----------------|
| Canvas | react-konva | Scene graph leverage without whiteboard lock-in |
| Framework | Next.js (App Router) | React + API routes + Vercel deploy in one |
| Styling | Tailwind + shadcn/ui | Fast, consistent UI without custom CSS |
| State | Zustand | Lightweight, works outside React for sync layer |
| Real-time | PartyKit | Single RT layer for cursors + objects, <30ms latency, we own sync logic |
| Auth | Supabase Anonymous Auth | Real sessions, zero friction |
| Database | Supabase Postgres | Durable persistence + RLS + auth ecosystem |
| AI Agent | Claude Sonnet | Strong tool use, cost-effective for structured calls |
| Backend | Next.js API Routes | Same codebase, same deploy, no separate service |
| Hosting | Vercel | Native Next.js, free tier, fast deploys |
| Dev Tools | Claude Code + Cursor | AI-first dev requirement fulfilled |

---

## AI Cost Analysis

### Development & Testing Costs (Actuals)

Tracked via `ccusage` over the 8-day development period (Feb 13–20, 2026). All development was done exclusively through Claude Code.

| Metric | Claude Code | In-App AI (Claude API) | Total |
|--------|-------------|------------------------|-------|
| Input tokens | 572,684 | ~5,000 (testing) | ~578,000 |
| Output tokens | 596,794 | ~2,000 (testing) | ~599,000 |
| Cache creation | 23,596,734 | — | 23,596,734 |
| Cache read | 648,863,757 | — | 648,863,757 |
| Total tokens | 673,629,969 | ~7,000 | ~673,637,000 |
| **Cost** | **$410.36** | **~$2** | **~$412** |

**Daily breakdown**:

| Date | Models Used | Cost |
|------|-------------|------|
| Feb 13 | Opus 4.6, Haiku 4.5 | $18.35 |
| Feb 14 | Opus 4.6, Haiku 4.5, Sonnet 4.5 | $49.28 |
| Feb 15 | Opus 4.6, Haiku 4.5, Sonnet 4.5 | $19.11 |
| Feb 16 | Opus 4.6, Haiku 4.5, Sonnet 4.5 | $68.40 |
| Feb 17 | Opus 4.6, Haiku 4.5, Sonnet 4.5/4.6 | $65.42 |
| Feb 18 | Opus 4.6, Haiku 4.5, Sonnet 4.6 | $70.35 |
| Feb 19 | Opus 4.6, Haiku 4.5, Sonnet 4.6 | $73.74 |
| Feb 20 | Opus 4.6, Haiku 4.5, Sonnet 4.6 | $45.61 |

**Model cost split**: Opus 4.6 (~$367, 89%) was the primary model for planning and execution. Haiku 4.5 (~$13, 3%) handled subagent tasks (plan review, code search). Sonnet 4.5/4.6 (~$30, 7%) was used for execution — Sonnet 4.6 replaced Sonnet 4.5 mid-week when it launched, offering faster execution with equivalent quality.

**Other costs**: Supabase, Vercel, PartyKit — all free tier ($0). No embeddings, vector DB, or fine-tuning costs. No Cursor subscription.

### Production Cost Projections

**Assumptions**:
- 40 AI commands/user/month (24 simple, 16 complex) across 8 sessions
- Simple command: ~1,800 input tokens (800 base + 1,000 avg board context) → ~200 output tokens
- Complex command: ~2,200 input tokens (1,200 base + 1,000 avg board context) → ~800 output tokens
- Board state scaling: ~40 tokens per object, avg ~50 objects mid-session
- Cursor broadcast throttled to 10Hz (industry standard for production collaborative apps)
- Claude Sonnet pricing: $3/M input, $15/M output

**Per-user monthly token consumption**:
- Input: 78,400 tokens (24 × 1,800 simple + 16 × 2,200 complex)
- Output: 17,600 tokens (24 × 200 simple + 16 × 800 complex)
- Per-user LLM cost: ~$0.50/month

**Monthly cost at scale**:

| Cost Category | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **Claude Sonnet (LLM)** | $49.92 | $499.20 | $4,992.00 | $49,920.00 |
| ↳ Input tokens | $23.52 | $235.20 | $2,352.00 | $23,520.00 |
| ↳ Output tokens | $26.40 | $264.00 | $2,640.00 | $26,400.00 |
| **Vercel** | $0 (free) | $0 (free) | $20 (pro) | $20+ (pro) |
| **Supabase** | $0 (free) | $0 (free) | $25 (pro) | $25+ (pro) |
| **PartyKit / Durable Objects** | $5.00 | $48.41 | $438.10 | $4,340.04 |
| | | | | |
| **Total Monthly** | **~$55** | **~$548** | **~$5,475** | **~$54,305** |
| **Per-user cost** | **$0.55** | **$0.55** | **$0.55** | **$0.54** |

**Dominant cost**: LLM is 91-92% of total spend at every tier. Infrastructure is negligible by comparison.

**Free tier thresholds**:
| Service | Free Tier Limit | Exceeded At |
|---|---|---|
| Vercel invocations | 100K/month | ~1,500 users |
| Supabase DB | 500MB | ~20,000 users (month 1) |
| PartyKit Workers | 100K req/day | ~10 concurrent users (cursor messages blow through this) |

PartyKit free tier is insufficient for any real-time app — paid Durable Objects from day one. Vercel and Supabase free tiers carry us to ~1,500 users.

### Cost Optimization Strategies

Ordered by impact, for post-MVP consideration:

1. **Prompt caching** (Anthropic native feature): Cached input tokens cost $0.30/M vs $3/M — 90% discount. System prompt is identical across calls. **Impact: ~60-70% input cost reduction.**

2. **Model routing**: Route simple commands (create, move, color change) to Claude Haiku ($0.25/M input, $1.25/M output). Only route complex/creative commands to Sonnet. **Impact: ~40-60% total LLM cost reduction.**

3. **Board state compression**: Abbreviated format (`{id,type,x,y,w,h,text}`) instead of verbose JSON. Send diffs instead of full state. **Impact: ~20-40% input token reduction.**

4. **Cursor throttling**: 10Hz already applied above. Further: viewport-aware broadcasting (only relay cursors to users viewing same board region). **Impact: reduces PartyKit costs at scale.**

5. **Command batching**: Debounce rapid sequential commands into compound requests. **Impact: ~30-50% fewer API calls.**

**With optimizations 1-3 applied**, per-user LLM cost drops from ~$0.50 to ~$0.10-0.15/month. Total cost at 10K users: ~$1,500-2,000 instead of $5,475.

---

## Build Priority Order

1. **Cursor sync** — two cursors moving across browsers
2. **Object sync** — sticky notes appearing for all users
3. **Conflict handling** — simultaneous edit resolution
4. **State persistence** — survive refresh and reconnect
5. **Board features** — shapes, frames, connectors, transforms
6. **AI commands (basic)** — single-step creation/manipulation
7. **AI commands (complex)** — multi-step template generation

---

## Resolved Questions
- **Real-time latency**: Supabase Realtime (50-150ms) failed <50ms cursor target. Consolidated on PartyKit (~10-30ms same-region).
- **AI agent execution**: Server-side. API route writes to Postgres + notifies PartyKit room via HTTP. Multi-step commands trickle in one object at a time.
- **Cursor persistence**: Not needed. Cursors are ephemeral — disappear on disconnect, reappear on reconnect. PRD persistence requirement applies to board objects only.

## Open Questions
- Does react-konva handle 500+ nodes performantly with frequent re-renders, or do we need to drop to raw Konva for the rendering layer?
- PartyKit Durable Objects pin to one region — are evaluators geographically co-located enough for this to be a non-issue?
- What's the right throttle rate for cursor broadcasts? Research suggests 16ms (60Hz) client-side. Need to validate this doesn't overload PartyKit at 5+ users.

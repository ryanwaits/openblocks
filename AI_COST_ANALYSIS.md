# AI Cost Analysis — CollabBoard

## Development & Testing Costs

All development done via Claude Code over 8 days (Feb 13–20, 2026). Tracked with `ccusage`.

| Metric | Value |
|--------|-------|
| Total tokens consumed | 673.6M |
| Input tokens | 572,684 |
| Output tokens | 596,794 |
| Cache creation tokens | 23.6M |
| Cache read tokens | 648.9M |
| Claude Code cost | **$410.36** |
| In-app AI testing (Sonnet) | ~$2 |
| Infrastructure (Supabase, Vercel, PartyKit) | $0 (free tier) |
| **Total dev spend** | **~$412** |

### Model Breakdown

| Model | Cost | % of Total | Role |
|-------|------|------------|------|
| Claude Opus 4.6 | ~$367 | 89% | Planning, architecture, execution |
| Claude Sonnet 4.5/4.6 | ~$30 | 7% | Fast execution (Sonnet 4.6 from mid-week) |
| Claude Haiku 4.5 | ~$13 | 3% | Subagent tasks (plan review, search) |

### Daily Spend

| Date | Cost | Activity |
|------|------|----------|
| Feb 13 | $18.35 | Pre-search, initial architecture |
| Feb 14 | $49.28 | MVP: canvas, sync, multiplayer |
| Feb 15 | $19.11 | MVP polish, auth, deployment |
| Feb 16 | $68.40 | SDK extraction (types, storage, server) |
| Feb 17 | $65.42 | SDK extraction (client, react hooks) |
| Feb 18 | $70.35 | Whiteboard migration to SDK, AI agent |
| Feb 19 | $73.74 | Follow mode, presence, bug fixes |
| Feb 20 | $45.61 | Final polish, docs, submission prep |

### What $412 Bought

- 164 commits, ~95% AI-generated code
- 5-package SDK (`@waits/lively-*`) with 317 tests
- Full collaborative whiteboard with AI agent (9 tools, 10 templates)
- Complete real-time infrastructure (cursors, presence, sync, persistence)
- Deployed production application

---

## Production Cost Projections

### Assumptions

- 40 AI commands/user/month (24 simple, 16 complex) across 8 sessions
- Simple command: ~1,800 input tokens → ~200 output tokens
- Complex command: ~2,200 input tokens → ~800 output tokens
- Claude Sonnet pricing: $3/M input, $15/M output
- Per-user LLM cost: **~$0.50/month**

### Monthly Cost at Scale

| Cost Category | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **Claude Sonnet (LLM)** | $49.92 | $499.20 | $4,992.00 | $49,920.00 |
| **Vercel** | $0 | $0 | $20 | $20 |
| **Supabase** | $0 | $0 | $25 | $25 |
| **WebSocket infra** | $5 | $48 | $438 | $4,340 |
| **Total Monthly** | **~$55** | **~$548** | **~$5,475** | **~$54,305** |
| **Per-user cost** | **$0.55** | **$0.55** | **$0.55** | **$0.54** |

### Cost Optimization Path

With prompt caching + model routing + board state compression, per-user LLM cost drops from ~$0.50 to ~$0.10–0.15/month. Total at 10K users: ~$1,500–2,000 vs $5,475 unoptimized.

### Key Insight

LLM is 91% of total spend at every tier. Infrastructure is negligible. The path to profitability is prompt engineering and model routing, not infrastructure optimization.

# Nexus — Implementation Plan (24h Hackathon Cut)

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

> ⚠️ **This repo runs Next.js 16 with breaking changes.** Before writing any code, read the relevant guide in `node_modules/next/dist/docs/` (routing, route handlers, server components, middleware). Do not code from memory.

**Goal:** Ship Nexus — personal academic organizer with agentic AI chat — submittable to the Kaggle capstone (Concierge track) by **July 6, 11:59 PM PT**.

**Architecture:** Next.js full-stack app; Supabase (Postgres + Auth, RLS, server-only access); Vercel AI SDK + Gemini for the agent; in-repo MCP server for Google Classroom; Discord and Slack via the owner's own session tokens as in-process tools. Deployed on Vercel. Public read-only demo mode for judges.

**Tech Stack:**

- **Framework:** Next.js (App Router) — already scaffolded
- **UI:** shadcn/ui + Tailwind CSS v4 (dark-first, emerald accent, Geist fonts, Hugeicons)
- **Database/Auth:** Supabase (Postgres + Supabase Auth, single owner)
- **AI Agent:** Vercel AI SDK + `@ai-sdk/google` (Gemini only, key in env; server-validated model allowlist)
- **MCP:** `@modelcontextprotocol/sdk` — Classroom server in-repo, agent connects as MCP client
- **Calendar UI:** custom lightweight grid/list (NO react-big-calendar)
- **Deployment:** Vercel only (no Render)

**Hour budget (~24h):** Phases 0–1: 3h · Phase 2: 4h · Phase 3: 4h · Phase 4: 4h · Phase 5: 2h · Phase 6 (submission assets): 5h · buffer: 2h. If behind after Phase 4, cut Phase 5 features, never Phase 6.

---

## Phase 0: Foundation

### Task 0.1: Next.js init — DONE

### Task 0.2: Supabase schema + clients

**Files:**

- Create: `src/lib/supabase/server.ts` (server client — **no browser data client**)
- Create: `supabase/migrations/001_initial_schema.sql`

**Database Schema:**

```sql
-- Platform connections (google_classroom uses OAuth tokens; discord/slack store user
-- session tokens in access_token — slack keeps its `d` cookie in refresh_token)
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL UNIQUE CHECK (type IN ('google_classroom', 'discord', 'slack')),
  name TEXT NOT NULL,
  external_id TEXT,                -- Classroom course id / Discord/Slack channel id
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('exam', 'quiz', 'assignment', 'study_block', 'other')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  source_platform UUID REFERENCES platforms(id),
  source_external_id TEXT,         -- for dedup of auto-detected events
  is_auto_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (source_platform, source_external_id)
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  is_pinned BOOLEAN DEFAULT false,
  source_platform UUID REFERENCES platforms(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

CREATE TABLE resource_labels (
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, label_id)
);

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  external_id TEXT NOT NULL,       -- platform message/announcement id for dedup
  title TEXT,
  content TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  is_read BOOLEAN DEFAULT false,
  announced_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (platform_id, external_id)
);

-- Audit trail of autonomous agent actions (dashboard "Agent Activity" card)
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL,       -- 'sync' | 'calendar' | 'resource'
  source_id TEXT,                  -- originating announcement id, if any
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: deny everything to anon/authenticated; all access goes through server-side routes
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
-- no policies created = deny all browser access
```

**Steps:**

1. Run migration in Supabase dashboard
2. `server.ts`: server-only DB access with `import 'server-only'` guard so it can never be bundled client-side; falls back to a local mock JSON DB when Supabase env is absent (offline/demo runs)
3. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY` — document in `.env.example`
4. Verify: test API route reads `platforms` table

### Task 0.3: Auth + demo mode + layout

**Files:**

- Create: `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`, export `function proxy(request)`)
- Create: `src/app/login/page.tsx`
- Create: `src/lib/auth.ts` (`getRole()` helper → `'owner' | 'demo'`, cookie-based, cached per request)
- Create: `src/app/layout.tsx`, `src/app/loading.tsx`, `src/components/layout/sidebar.tsx`, `src/components/layout/header.tsx`
- Create: `supabase/seed.sql` (demo data: sample announcements, events, resources, agent actions)

**Steps:**

1. Enable Supabase Auth (email/password) with a single owner account
2. `getRole()`: authenticated owner → full access; unauthenticated → `demo` role. Reads the session from cookies (no auth-server round trip per render); mutations re-verify via `requireOwner()`
3. Demo role: all pages render (read-only), every mutation route returns 403, chat disabled with banner; demo banner in header with login link
4. Sidebar: Dashboard, Calendar, Resources, AI Chat, Options; dark emerald theme; collapsible
5. Verify: logged out → read-only demo with seeded data; logged in → full access

---

## Phase 1: Options + Platform Connections

### Task 1.1: Options page

**Files:**

- Create: `src/app/options/page.tsx`
- Create: `src/components/options/platform-card.tsx`
- Create: `src/app/api/platforms/route.ts`

**Steps:**

1. Three platform cards: Google Classroom (Connect via Google button), Discord (user token + channel ID form), Slack (`xoxc` token + `d` cookie + channel ID form)
2. Show connection status + `last_synced_at`; disconnect button wipes tokens
3. Discord/Slack cards: POST credentials to server, server validates with a test API call before saving; tokens never round-trip back to the browser
4. Verify: Discord/Slack connect with real credentials shows "Connected"

### Task 1.2: Google OAuth (Classroom scopes)

**Files:**

- Create: `src/app/api/auth/google/route.ts` + `src/app/api/auth/google/callback/route.ts`
- Create: `src/lib/auth/google-oauth.ts` (token exchange + refresh + Calendar write helper)

**Steps:**

1. Google Cloud Console: OAuth client, redirect URIs (localhost + Vercel domain), scopes: Classroom read scopes + Calendar write scope; add owner as test user (unverified app is fine)
2. Authorization code flow with `access_type=offline&prompt=consent` (need refresh token)
3. Store tokens in `platforms`; implement refresh-on-expiry helper used by all Google calls
4. After connect: list courses, let user pick one → save as `external_id`
5. Verify: connect flow completes, course picked, tokens stored

---

## Phase 2: MCP Server + Ingestion

### Task 2.1: Google Classroom MCP server (in-repo)

**Files:**

- Create: `mcp/classroom/server.ts` (MCP server via `@modelcontextprotocol/sdk`)
- Create: `mcp/classroom/tools.ts`
- Create: `src/lib/ai/mcp-client.ts` (AI SDK connects to it)

**Tools exposed:** `list_announcements`, `list_assignments`, `list_materials`, `get_class_info`

**Steps:**

1. MCP server with the four tools hitting the Classroom REST API; reads OAuth token via the refresh helper (same process — no network token hand-off)
2. Run in-repo over an in-memory transport bridge spawned by the Next.js backend
3. Verify: script calls `list_announcements` through the MCP client, real Classroom data returns

### Task 2.2: Discord + Slack tools + sync endpoint

**Files:**

- Create: `src/lib/platforms/discord.ts` (fetch channel messages + pins with the user token)
- Create: `src/lib/platforms/slack.ts` (fetch channel history with `xoxc` token + `d` cookie)
- Create: `src/app/api/sync/route.ts`

**Steps:**

1. Discord REST: `GET /channels/{id}/messages?limit=50`, `GET /channels/{id}/pins` with the raw user token in the `Authorization` header (no bot to create, invite, or grant intents to)
2. Slack: `conversations.history` with the `xoxc` browser token + `d` session cookie
3. `/api/sync`: skip if `last_synced_at` < 15 min (unless `?force=1`); else pull Classroom announcements+assignments (via MCP tools) and Discord/Slack messages; upsert `announcements` on `(platform_id, external_id)`; upsert assignment due dates into `events` as `is_auto_detected` on `(source_platform, source_external_id)`; update `last_synced_at`
4. Gemini post-processing: scan new announcements for exam dates and resource links → write detected events to Google Calendar, autosave detected links to Resources, and record each autonomous action in `agent_actions`
5. Dashboard triggers sync fire-and-forget on load (skips the server re-render when nothing changed); "Sync now" button forces
6. Verify: sync twice → no duplicates; assignments appear as events; agent actions logged

---

## Phase 3: AI Agent Chat

### Task 3.1: Chat core

**Files:**

- Create: `src/app/chat/page.tsx`, `src/components/chat/chat-interface.tsx`, `src/components/chat/tool-call-display.tsx`
- Create: `src/app/api/chat/route.ts` (AI SDK `streamText`, Gemini)
- Create: `src/lib/ai/tools.ts`, `src/lib/ai/system-prompt.ts`

**Agent tools:**

| Tool                                                  | Backing                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `summarize_announcements`                             | reads synced `announcements` (+ live MCP fetch when asked)   |
| `get_upcoming_events` / `create_event` / `edit_event` | `events` table + Google Calendar write                       |
| `search_resources` / `add_resource`                   | `resources` table                                            |
| `generate_study_plan`                                 | reads upcoming exams → creates `study_block` events          |
| `set_reminder`                                        | creates reminder event                                       |
| DuckDuckGo web search                                 | zero-dependency HTML-fallback parser                         |
| Classroom MCP tools                                   | attached via MCP client (this is the scored MCP integration) |

**Steps:**

1. `/api/chat`: `streamText` with Gemini (`GEMINI_API_KEY` env), tools above + MCP client tools, multi-step tool calling (depth 8)
2. Mid-conversation model selector: `gemini-3.1-flash-lite` (default) / `gemini-3.5-flash`, validated server-side against an allowlist
3. System prompt: student context, connected platforms, today's date, tool usage guidance
4. Chat UI: streaming messages, visible tool-call chips (judges must SEE agentic behavior)
5. Owner-only (403 in demo mode)
6. Verify: "summarize my announcements" → MCP tool call visible → summary; "create an exam event Friday" → appears in calendar

---

## Phase 4: Dashboard

### Task 4.1: Dashboard page

**Files:**

- Create: `src/app/page.tsx` + `src/components/dashboard/{upcoming-events,todays-schedule,quick-stats,recent-announcements,agent-actions,pinned-resources,sync-on-load}.tsx`
- Create: `src/app/api/dashboard/route.ts`

**Steps:**

1. Server component renders cached data instantly; client triggers `/api/sync` in background, refreshes only when sync did work
2. Widgets: next-7-days exams/quizzes w/ countdown; today's events; stats (days to next exam, unread count); last 5 announcements; **Agent Activity** audit log; pinned resources
3. Responsive grid, skeletons, empty states
4. Verify: real synced data in all widgets; demo mode shows seeded data including agent actions

---

## Phase 5: Calendar + Resources (cuttable if behind)

### Task 5.1: Calendar page

- `src/app/calendar/page.tsx`, `src/components/calendar/{month-grid,event-form}.tsx`, `src/app/api/events/route.ts`
- Custom month grid (CSS grid, 42 cells) + upcoming list; color-coded by type; create/edit dialog
- Verify: manual + agent-created + auto-detected events all render

### Task 5.2: Resources page

- `src/app/resources/page.tsx`, `src/components/resources/{resource-card,resource-form,label-filter}.tsx`, `src/app/api/resources/route.ts`
- Card list, add/edit form with labels, label filter, title/label search, pin toggle
- Verify: add, filter, search, pin → shows on dashboard

---

## Phase 6: Submission Assets (NEVER cut — ~5h)

### Task 6.1: Deploy

1. Secret scan: `git log -p | grep -iE 'api[_-]?key|secret|token'` — nothing committed (hard rubric rule)
2. Vercel: connect repo, set env vars, deploy; update Google OAuth redirect URI to prod domain
3. Seed demo data in prod; verify logged-out URL shows demo mode with **no login required** (rubric requirement)
4. E2E on prod: login → connect platforms → sync → chat with tool calls → dashboard populated

### Task 6.2: README (20 pts)

Problem, solution, architecture diagram (data-flow from spec §8), rubric-concept mapping table, setup instructions (env vars, Supabase migration, Discord/Slack token setup, Google OAuth setup), deploy reproduction steps, PRIVACY.md. Code comments on design/behavior per rubric.

### Task 6.3: Video (≤5 min, YouTube) + Writeup (≤2,500 words)

Video: problem (30s) → why agents (30s) → architecture (60s) → live demo: connect, sync, chat w/ visible MCP tool calls, dashboard incl. Agent Activity (2.5min) → build story incl. **Antigravity workflow on screen** (30s).
Writeup: Kaggle Writeup, Concierge track, cover image, video + project link + repo link attached. **Submit before 11:59 PM PT — drafts don't count.**

---

## Build Order

```
Phase 0 ──► 1 ──► 2 ──► 3 ──► 4 ──► 5 ──► 6
Auth/DB   Options  MCP+  Agent  Dash  Cal/Res  Deploy+
+ demo    +OAuth   Sync  Chat         (cuttable) Writeup+Video
```

**Demo-critical path:** Options → connect Classroom → sync → chat agent calls MCP tools → dashboard. Everything else supports it.

## Verification

- After each phase: `npm run build` clean + manual browser test
- E2E: connect Classroom + Discord + Slack → sync → agent summarizes (MCP call visible) → agent creates event → dashboard + calendar show it → logged-out demo mode works with no login

# Nexus — Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Build Nexus — a personal AI-powered academic organizer that centralizes announcements from Discord, Slack, and Google Classroom into a single web interface with an agentic AI chat.

**Architecture:** Next.js full-stack app with Supabase for persistence, Vercel AI SDK for the agentic chat, remote MCP servers for platform integrations, and shadcn/ui + Tailwind for the UI. Deployed on Vercel.

**Tech Stack:**
- **Framework:** Next.js (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **AI Agent:** Vercel AI SDK (multi-model, tool-calling)
- **State:** React Server Components + React Query
- **Calendar:** react-big-calendar
- **Auth:** Native OAuth per platform (Discord, Slack, Google)
- **Deployment:** Vercel (app) + Render/Cloudflare (MCP servers)
- **Theme:** White / green shades / black

---

## Phase 0: Project Scaffolding

### Task 0.1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json` (via `npx create-next-app`)
- Create: `.env.local` (environment variables template)
- Create: `.env.example` (documented env var reference)
- Create: `.gitignore`

**Steps:**
1. Run `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` 
2. Install core dependencies:
   ```bash
   npm install @supabase/supabase-js @tanstack/react-query ai @ai-sdk/openai @ai-sdk/google react-big-calendar date-fns lucide-react
   ```
3. Install dev dependencies:
   ```bash
   npm install -D @types/react-big-calendar
   ```
4. Initialize shadcn/ui:
   ```bash
   npx -y shadcn@latest init
   ```
5. Create `.env.example` with all required env vars documented
6. Verify: `npm run dev` starts without errors

### Task 0.2: Set Up Supabase

**Files:**
- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client)
- Create: `supabase/migrations/001_initial_schema.sql`

**Database Schema:**

```sql
-- Platform connections
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('discord', 'slack', 'google_classroom')),
  name TEXT NOT NULL,
  channel_url TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('exam', 'quiz', 'assignment', 'study_block', 'other')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  color TEXT,
  google_calendar_id TEXT,
  source_platform UUID REFERENCES platforms(id),
  is_auto_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resources (links only)
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  is_pinned BOOLEAN DEFAULT false,
  source_platform UUID REFERENCES platforms(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Resource labels
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT
);

-- Many-to-many: resources <-> labels
CREATE TABLE resource_labels (
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, label_id)
);

-- Cached announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id),
  title TEXT,
  content TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  is_read BOOLEAN DEFAULT false,
  announced_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- App settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

**Steps:**
1. Create Supabase project at supabase.com
2. Run the migration SQL in Supabase dashboard
3. Create `client.ts` and `server.ts` with Supabase SDK setup
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
5. Verify: Query the `settings` table from a test API route

### Task 0.3: Set Up Design System & Layout

**Files:**
- Create: `src/app/globals.css` (theme tokens — white/green/black palette)
- Create: `src/app/layout.tsx` (root layout with sidebar navigation)
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/providers.tsx` (React Query provider)

**Steps:**
1. Configure Tailwind with custom green/black/white palette
2. Install shadcn components: `button`, `card`, `input`, `dialog`, `badge`, `toast`, `tabs`, `separator`, `avatar`, `scroll-area`
3. Build sidebar with navigation links: Dashboard, Calendar, Resources, AI Chat, Options
4. Build header with app name "Nexus" and status indicators
5. Wrap app in React Query provider
6. Verify: App renders with sidebar navigation, all routes navigable

---

## Phase 1: AI Chat + Options (MVP Core)

> This is the product. Ship this first.

### Task 1.1: Options Page — Platform Connection UI

**Files:**
- Create: `src/app/options/page.tsx`
- Create: `src/components/options/platform-card.tsx`
- Create: `src/components/options/api-key-form.tsx`
- Create: `src/app/api/platforms/route.ts` (CRUD for platform connections)

**Steps:**
1. Build Options page with 3 platform cards (Discord, Slack, Google Classroom)
2. Each card shows: platform icon, name, connection status, connect/disconnect button, channel URL input
3. Build API key configuration form (LLM provider selector + API key input)
4. Store platform configs and API key in Supabase `platforms` and `settings` tables
5. Verify: Can save/load platform configs and API key from database

### Task 1.2: OAuth Flows for Each Platform

**Files:**
- Create: `src/app/api/auth/discord/route.ts` (Discord OAuth2 redirect)
- Create: `src/app/api/auth/discord/callback/route.ts`
- Create: `src/app/api/auth/slack/route.ts` (Slack OAuth redirect)
- Create: `src/app/api/auth/slack/callback/route.ts`
- Create: `src/app/api/auth/google/route.ts` (Google OAuth for Classroom)
- Create: `src/app/api/auth/google/callback/route.ts`
- Create: `src/lib/auth/oauth-helpers.ts` (shared OAuth utilities)

**Steps:**
1. Register OAuth apps on Discord Developer Portal, Slack API, Google Cloud Console
2. Implement OAuth2 authorization code flow for each platform
3. Store tokens securely in Supabase `platforms` table
4. Handle token refresh logic
5. Update connection status on successful auth
6. Verify: Can connect each platform via OAuth and see "Connected" status

### Task 1.3: MCP Server — Google Classroom

**Files:**
- Create: `mcp-servers/google-classroom/index.ts`
- Create: `mcp-servers/google-classroom/tools.ts`
- Create: `mcp-servers/google-classroom/package.json`

**Tools exposed:**
- `list_announcements` — fetch announcements from a class
- `list_assignments` — fetch assignments with due dates
- `list_materials` — fetch course materials and resource links
- `get_class_info` — fetch class details

**Steps:**
1. Build MCP server using `@modelcontextprotocol/sdk`
2. Use Google Classroom API via the stored OAuth token
3. Expose tools for announcements, assignments, materials
4. Deploy to Render (free tier)
5. Verify: MCP server responds to tool calls with real Classroom data

### Task 1.4: MCP Server — Discord

**Files:**
- Create: `mcp-servers/discord/index.ts`
- Create: `mcp-servers/discord/tools.ts`
- Create: `mcp-servers/discord/package.json`

**Tools exposed:**
- `list_messages` — fetch recent messages from a channel
- `list_pinned_messages` — fetch pinned messages
- `search_messages` — search messages by keyword

**Steps:**
1. Build MCP server using `@modelcontextprotocol/sdk`
2. Use Discord API via stored OAuth token
3. Deploy to Render (free tier)
4. Verify: MCP server responds with real Discord channel data

### Task 1.5: MCP Server — Slack

**Files:**
- Create: `mcp-servers/slack/index.ts`
- Create: `mcp-servers/slack/tools.ts`
- Create: `mcp-servers/slack/package.json`

**Tools exposed:**
- `list_messages` — fetch recent messages from a channel
- `list_pinned_messages` — fetch pinned messages
- `search_messages` — search messages by keyword

**Steps:**
1. Build MCP server using `@modelcontextprotocol/sdk`
2. Use Slack Web API via stored OAuth token
3. Deploy to Render (free tier)
4. Verify: MCP server responds with real Slack channel data

### Task 1.6: AI Agent Chat — Core

**Files:**
- Create: `src/app/chat/page.tsx`
- Create: `src/components/chat/chat-interface.tsx`
- Create: `src/components/chat/message-bubble.tsx`
- Create: `src/components/chat/tool-call-display.tsx`
- Create: `src/app/api/chat/route.ts` (Vercel AI SDK streaming endpoint)
- Create: `src/lib/ai/tools.ts` (tool definitions)
- Create: `src/lib/ai/system-prompt.ts`

**Agent Tools:**
| Tool | Description |
|------|-------------|
| `summarize_announcements` | Fetches and summarizes announcements from connected platforms via MCP |
| `create_event` | Creates a calendar event in Supabase + pushes to Google Calendar |
| `edit_event` | Modifies an existing calendar event |
| `search_resources` | Searches saved resource links by title/label |
| `add_resource` | Saves a new resource link |
| `set_reminder` | Creates a study reminder event |
| `generate_study_plan` | Creates a multi-day study plan based on upcoming exams |
| `get_upcoming_events` | Fetches upcoming exams/quizzes/assignments |

**Steps:**
1. Build chat UI with message list, input box, and streaming response display
2. Build tool-call display component (shows when agent uses a tool)
3. Create Vercel AI SDK route with `streamText` and tool definitions
4. Wire tools to MCP server calls and Supabase queries
5. Build system prompt with context about the student's connected platforms
6. Verify: Can chat with agent, agent calls tools, results stream back

### Task 1.7: Google Calendar Push

**Files:**
- Create: `src/lib/google-calendar/push.ts`
- Modify: `src/app/api/auth/google/route.ts` (add Calendar scope)

**Steps:**
1. Add Google Calendar API scope to OAuth flow
2. Implement `pushEvent()` function that creates events via Google Calendar API
3. Call `pushEvent()` whenever a new event is created (from chat or calendar page)
4. Verify: Events created in Nexus appear in Google Calendar

---

## Phase 2: Dashboard

### Task 2.1: Dashboard Page

**Files:**
- Create: `src/app/page.tsx` (dashboard is the landing page)
- Create: `src/components/dashboard/upcoming-events.tsx`
- Create: `src/components/dashboard/todays-schedule.tsx`
- Create: `src/components/dashboard/quick-stats.tsx`
- Create: `src/components/dashboard/pinned-resources.tsx`
- Create: `src/components/dashboard/recent-announcements.tsx`
- Create: `src/components/dashboard/ai-tip.tsx`
- Create: `src/app/api/dashboard/route.ts` (aggregated data endpoint)

**Steps:**
1. Build dashboard API route that aggregates data from all tables
2. Build each widget component with loading states
3. Layout widgets in a responsive grid (primary widgets top, secondary bottom)
4. Upcoming Events: query `events` table for next 7 days, show countdown
5. Today's Schedule: query `events` table for today
6. Quick Stats: compute days-to-next-exam, unread announcements count
7. Pinned Resources: query `resources` where `is_pinned = true`
8. Recent Announcements: query last 5 `announcements`
9. AI Tip: generate a daily tip via LLM on page load (cached for the day)
10. Verify: Dashboard loads with real data from all widgets

---

## Phase 3: Calendar

### Task 3.1: Calendar Page

**Files:**
- Create: `src/app/calendar/page.tsx`
- Create: `src/components/calendar/calendar-view.tsx`
- Create: `src/components/calendar/event-form.tsx`
- Create: `src/components/calendar/event-detail.tsx`
- Create: `src/app/api/events/route.ts` (CRUD for events)

**Steps:**
1. Set up react-big-calendar with monthly/weekly/daily views
2. Fetch events from Supabase and display with color coding by type
3. Build event creation dialog (title, type, date/time, description)
4. Build event detail popover on click
5. On event create/edit: save to Supabase + push to Google Calendar
6. Verify: Can create, view, and edit events; events appear in Google Calendar

---

## Phase 4: Resources

### Task 4.1: Resources Page

**Files:**
- Create: `src/app/resources/page.tsx`
- Create: `src/components/resources/resource-card.tsx`
- Create: `src/components/resources/resource-form.tsx`
- Create: `src/components/resources/label-filter.tsx`
- Create: `src/app/api/resources/route.ts` (CRUD for resources)
- Create: `src/app/api/labels/route.ts` (CRUD for labels)

**Steps:**
1. Build resource list view with cards showing title, URL, labels, pin status
2. Build label filter sidebar/bar to filter by label
3. Build "Add Resource" form (title, URL, description, labels)
4. Implement search across resource titles and labels
5. Pin/unpin toggle that syncs with dashboard
6. Verify: Can add, search, filter, and pin resources

---

## Phase 5: Polish & Deploy

### Task 5.1: UI Polish

**Steps:**
1. Add loading skeletons for all pages
2. Add empty states with helpful messaging
3. Ensure responsive layout works on tablet
4. Add micro-animations and hover effects
5. Finalize the white/green/black color palette across all components
6. Add error boundaries and toast notifications for failures

### Task 5.2: Deployment

**Steps:**
1. Push to GitHub repository
2. Connect repo to Vercel, configure environment variables
3. Deploy MCP servers to Render (one service per platform)
4. Configure OAuth redirect URLs for production domain
5. Verify: Full app works on production URL end-to-end

---

## Build Order Summary

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
Scaffold     AI Chat     Dashboard   Calendar    Resources   Polish
             + Options                                       + Deploy
             (MVP CORE)
```

**MVP ships after Phase 1.** Everything else is additive.

---

## Verification Plan

### After Each Phase
- `npm run build` — must pass with zero errors
- `npm run lint` — must pass with zero warnings
- Manual test of all new features in browser

### End-to-End Verification
1. Connect at least one platform (Google Classroom recommended for easiest testing)
2. Ask AI agent to summarize announcements — verify it calls MCP tools
3. Ask AI agent to create a calendar event — verify it appears in calendar and Google Calendar
4. Add a resource link — verify it appears on Resources page and can be pinned to Dashboard
5. Check Dashboard — verify all widgets populate with real data

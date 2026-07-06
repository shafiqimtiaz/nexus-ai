# Nexus — Project Specification

> A personal AI-powered academic organizer that keeps a student on track by centralizing announcements, calendar events, resources, and an agentic AI chat — all in one web interface.

**Project Context:** Kaggle 5-Day AI Agents Intensive — Vibe Coding Capstone (with Google)
**Track:** Concierge Agents
**Deadline:** July 6, 2026, 11:59 PM PT
**Type:** Hosted web application (single-user personal tool, with a public read-only demo mode for judges)

---

## 1. Product Overview

Nexus connects to a student's academic platforms (Google Classroom via OAuth, Discord via bot token), pulls in announcements and assignments, and presents everything through an organized dashboard. An agentic AI chat (Gemini, via Vercel AI SDK with tool calling and an MCP server) summarizes content, manages the calendar, searches resources, and generates study plans.

### Core Value Proposition
- **One place** for academic announcements across platforms
- **Never miss** an exam, quiz, or deadline
- **AI-powered** study assistance through a tool-calling agent
- **Safe by design** — single authenticated owner, tokens never leave the server (Concierge track requirement)

### Rubric Concepts Demonstrated (need ≥3)
1. **MCP Server** — in-repo Google Classroom MCP server (code)
2. **Antigravity** — plan executed via Antigravity workflow (video)
3. **Security features** — Supabase Auth, RLS, server-only tokens, no keys in repo (code + video)
4. **Deployability** — deployed on Vercel with reproduction docs (video)

---

## 2. Pages & Features

### 2.1 Dashboard (landing page)

| Widget | Priority | Description |
|--------|----------|-------------|
| Upcoming Exams/Quizzes | **Primary** | Next 7 days of exams/quizzes with countdown |
| Today's Schedule | **Primary** | Today's events and study blocks |
| Quick Stats | **Primary** | Days until next exam, unread announcements, upcoming assignments |
| Recent Announcements | **Primary** | Latest synced announcements from connected platforms |
| Pinned Resources | Secondary | User-pinned resource links |

Visiting the dashboard triggers a background sync (see §5 Ingestion).

### 2.2 Calendar

Simple custom list/grid view (no heavy calendar library — hackathon scope).

| Feature | Description |
|---------|-------------|
| Month grid + upcoming list | Lightweight custom view of events by day |
| Event creation | Manually add exams, quizzes, assignments, study blocks |
| Color coding | By event type (exam, quiz, assignment, study block) |
| Agent-created events | Events created through AI chat appear here |

### 2.3 Resources

Curated collection of academic resource **links** (no file uploads).

| Feature | Description |
|---------|-------------|
| Link storage | Save URLs with title, description |
| Labels | User-defined labels for organizing/filtering (e.g., "Math 101") |
| Search | By title or label |
| Pin to Dashboard | Pinned resources surface on the Dashboard |
| Agent-added | AI agent can save resource links it finds in announcements |

### 2.4 AI Agent Chat

Conversational agent with tool calling (Vercel AI SDK + Gemini).

| Capability | Backed by |
|------------|-----------|
| Summarize announcements | Classroom MCP server tools + Discord tool |
| Create/edit calendar events | `create_event` / `edit_event` tools (Supabase) |
| Search/save resources | `search_resources` / `add_resource` tools |
| Detect events from announcements | Agent parses synced announcements, proposes events, creates on confirmation |
| Generate study plans | `generate_study_plan` — creates multi-day study blocks from upcoming exams |
| Set reminders | Creates a `study_block`/reminder-type calendar event (no push notifications) |

### 2.5 Options (Settings)

| Feature | Description |
|---------|-------------|
| Google Classroom | Connect via Google OAuth (authorization code flow); pick class |
| Discord | Paste bot token + channel ID (no OAuth — Discord user OAuth cannot read channel messages; bot is the correct mechanism) |
| Connection status | Per-platform connected indicator + last synced time |
| Disconnect | Removes stored tokens |

LLM configuration is **not** user-facing: Gemini API key lives in a server env var only.

---

## 3. Supported Platforms

| Platform | Connection Method | What It Pulls |
|----------|-------------------|---------------|
| **Google Classroom** | Google OAuth (owner only) | Announcements, assignments + due dates, materials |
| **Discord** | Bot token + channel ID | Channel messages (announcements), pinned messages |

Google Classroom is accessed through an **in-repo MCP server**; Discord through an in-process AI SDK tool. Slack is out of scope (future work).

---

## 4. Authentication, Authorization & Security

| Aspect | Detail |
|--------|--------|
| App login | Supabase Auth, single owner account. Owner logs in for full access. |
| Demo mode | Unauthenticated visitors get a **read-only demo** view with seeded sample data (dashboard/calendar/resources visible, chat and mutations disabled). Satisfies rubric's "publicly accessible, no login" project link without exposing owner data. |
| Database | RLS enabled on all tables; anon role denied. All queries run server-side (service role) — the browser never talks to Supabase directly. |
| Platform tokens | Google OAuth tokens + Discord bot token stored in Supabase, only ever read server-side. Never sent to the frontend. |
| LLM key | Gemini API key in server env var. Not in DB, not in repo, not in client. |
| Repo hygiene | `.env.example` documents vars; no secrets committed (hard rubric requirement). |

---

## 5. Ingestion (how announcements get in)

**Sync on page load, stale-while-revalidate:**
1. Dashboard (or manual "Sync now") calls `/api/sync`.
2. If `last_synced_at` < 15 minutes ago → skip (return cached).
3. Otherwise fetch announcements/assignments from Classroom (via MCP tools) and Discord (via bot API), upsert into `announcements` table (dedup on platform + source id), update `last_synced_at`.
4. Assignments with due dates auto-upsert calendar events (`is_auto_detected = true`).

No cron infrastructure. Data is fresh whenever the user looks.

---

## 6. In Scope (MVP — ships by deadline)

- ✅ Supabase Auth login (owner) + public read-only demo mode with seeded data
- ✅ Google Classroom connect (OAuth) + in-repo Classroom MCP server
- ✅ Discord connect (bot token) + in-process tool
- ✅ Sync-on-load announcement ingestion with dedup + auto-detected assignment events
- ✅ Dashboard with upcoming events, today, stats, recent announcements, pinned resources
- ✅ AI agent chat (Gemini) with tool calling: summarize, events CRUD, resources, study plans
- ✅ Simple calendar view + manual event creation
- ✅ Resources page: links, labels, search, pin
- ✅ Deployed on Vercel; Kaggle writeup + ≤5-min YouTube video + README with architecture diagram

## 7. Out of Scope (documented as future work in writeup)

- ❌ Slack integration
- ❌ Google Calendar push (one-way sync)
- ❌ Multi-model / user-provided LLM keys (Gemini only)
- ❌ Push/email notifications (reminders are calendar events only)
- ❌ Multi-user support
- ❌ File uploads (links only)
- ❌ react-big-calendar / drag-drop calendar UX
- ❌ Offline support

---

## 8. Data Flow

```
┌──────────────────┐          ┌─────────────┐
│ Google Classroom │          │   Discord   │
└────────┬─────────┘          └──────┬──────┘
         │ OAuth token                │ bot token
┌────────▼─────────┐                  │
│ Classroom MCP    │ (in-repo)        │
│ server           │                  │
└────────┬─────────┘                  │
         │                            │
   ┌─────▼────────────────────────────▼───┐
   │        Next.js backend               │
   │  /api/sync   /api/chat   CRUD routes │──► Supabase (Postgres, RLS)
   │  AI agent: Vercel AI SDK + Gemini    │──► Gemini API (env key)
   └─────────────────┬────────────────────┘
                     │ (browser never hits Supabase or platforms directly)
   ┌─────────────────▼────────────────────┐
   │  Web app: owner (full) / demo (RO)   │
   └──────────────────────────────────────┘
```

---

## 9. Non-Functional Requirements

| Requirement | Detail |
|-------------|--------|
| **Hosting** | Vercel (public URL for judges; demo mode requires no login) |
| **Performance** | Dashboard renders cached data immediately; sync happens in background. AI responses stream. |
| **Security** | See §4 — this is also the Concierge track story |
| **Docs** | README: problem, solution, architecture diagram, setup + deploy reproduction steps |
| **Writeup** | ≤2,500 words; video ≤5 min on YouTube; cover image |

---

## 10. Terminology

| Term | Meaning |
|------|---------|
| **MCP Server** | Model Context Protocol server exposing Google Classroom tools to the agent |
| **Resource** | A saved link (URL) to academic material — not an uploaded file |
| **Label** | User-defined tag for organizing resources |
| **Demo mode** | Read-only unauthenticated view with seeded sample data, for judges |
| **Sync** | On-load fetch of platform announcements into the local cache (15-min staleness window) |

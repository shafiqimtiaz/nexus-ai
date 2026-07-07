# Nexus — Project Specification

> A personal AI-powered academic organizer that keeps a student on track by centralizing announcements, calendar events, resources, and an agentic AI chat — all in one web interface.

**Project Context:** Kaggle 5-Day AI Agents Intensive — Vibe Coding Capstone (with Google)
**Track:** Concierge Agents
**Deadline:** July 6, 2026, 11:59 PM PT
**Type:** Hosted web application (single-owner tool, with a public read-only demo mode for guests)

---

## 1. Product Overview

Nexus connects to a student's academic platforms (Google Classroom via OAuth, Discord and Slack via the owner's own session tokens), pulls in announcements and assignments, and presents everything through an organized dashboard. An agentic AI chat (Gemini, via Vercel AI SDK with tool calling and an MCP server) summarizes content, manages the calendar, searches resources, and generates study plans.

### Core Value Proposition

- **One place** for academic announcements across platforms
- **Never miss** an exam, quiz, or deadline
- **AI-powered** study assistance through a tool-calling agent
- **Safe by design** — RLS-locked database, server-only token handling, read-only public demo

### Rubric Concepts Demonstrated (need ≥3)

1. **MCP Server** — in-repo Google Classroom MCP server (code)
2. **Antigravity** — plan executed via Antigravity workflow (video)
3. **Security features** — Supabase Auth, RLS, server-only tokens, no keys in repo (code + video)
4. **Deployability** — deployed on Vercel with reproduction docs (video)
5. **Agent skills** — custom tool suite: calendar CRUD, resources, study planner, web search (code)

---

## 2. Pages & Features

### 2.1 Dashboard (landing page)

| Widget                 | Priority    | Description                                                      |
| ---------------------- | ----------- | ---------------------------------------------------------------- |
| Upcoming Exams/Quizzes | **Primary** | Next 7 days of exams/quizzes with countdown                      |
| Today's Schedule       | **Primary** | Today's events and study blocks                                  |
| Quick Stats            | **Primary** | Days until next exam, unread announcements, upcoming assignments |
| Recent Announcements   | **Primary** | Latest synced announcements from connected platforms             |
| Agent Activity         | **Primary** | Audit log of autonomous concierge actions (sync, calendar, resource) |
| Pinned Resources       | Secondary   | User-pinned resource links                                       |

Visiting the dashboard triggers a background sync (see §5 Ingestion).

### 2.2 Calendar

Simple custom list/grid view (no heavy calendar library — hackathon scope).

| Feature                    | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| Month grid + upcoming list | Lightweight custom view of events by day               |
| Event creation             | Manually add exams, quizzes, assignments, study blocks |
| Color coding               | By event type (exam, quiz, assignment, study block)    |
| Agent-created events       | Events created through AI chat appear here             |

### 2.3 Resources

Curated collection of academic resource **links** (no file uploads).

| Feature          | Description                                                     |
| ---------------- | --------------------------------------------------------------- |
| Link storage     | Save URLs with title, description                               |
| Labels           | User-defined labels for organizing/filtering (e.g., "Math 101") |
| Search           | By title or label                                               |
| Pin to Dashboard | Pinned resources surface on the Dashboard                       |
| Agent-added      | AI agent can save resource links it finds in announcements      |

### 2.4 AI Agent Chat

Conversational agent with tool calling (Vercel AI SDK + Gemini).

| Capability                       | Backed by                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Summarize announcements          | Classroom MCP server tools + Discord/Slack tools                             |
| Create/edit calendar events      | `create_event` / `edit_event` tools (DB) + Google Calendar write             |
| Search/save resources            | `search_resources` / `add_resource` tools                                    |
| Web lookup                       | DuckDuckGo HTML search tool (zero-dependency parser)                         |
| Detect events from announcements | Agent parses synced announcements, proposes events, creates on confirmation  |
| Generate study plans             | `generate_study_plan` — creates multi-day study blocks from upcoming exams   |
| Set reminders                    | Creates a `study_block`/reminder-type calendar event (no push notifications) |

A **mid-conversation model selector** lets the user switch between `gemini-3.1-flash-lite` (default) and `gemini-3.5-flash`; the server validates the choice against an allowlist.

### 2.5 Options (Settings)

| Feature           | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Google Classroom  | Connect via Google OAuth (authorization code flow); pick class                                           |
| Discord           | Paste your own user token + channel ID (no bot to create or invite)                                      |
| Slack             | Paste your `xoxc-` token, `xoxd-` (`d` cookie) value + channel ID                                        |
| Connection status | Per-platform connected indicator + last synced time                                                      |
| Disconnect        | Removes stored tokens                                                                                    |

LLM API keys are **not** user-facing: the Gemini key lives in a server env var only.

---

## 3. Supported Platforms

| Platform             | Connection Method              | What It Pulls                                     |
| -------------------- | ------------------------------ | ------------------------------------------------- |
| **Google Classroom** | Google OAuth (owner only)      | Announcements, assignments + due dates, materials |
| **Discord**          | User token + channel ID        | Channel messages (announcements), pinned messages |
| **Slack**            | `xoxc` token + `d` cookie + channel ID | Channel messages (announcements)          |

Google Classroom is accessed through an **in-repo MCP server**; Discord and Slack through in-process AI SDK tools using the owner's own session tokens.

---

## 4. Authentication, Authorization & Security

| Aspect          | Detail                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| App login       | Supabase Auth. The owner signs in for full access; everyone else is a read-only demo user.                                                                                                                                                       |
| Demo mode       | Unauthenticated visitors get a **read-only demo** view with seeded sample data (dashboard/calendar/resources visible, chat and mutations disabled). Satisfies rubric's "publicly accessible, no login" project link without exposing owner data. |
| Database        | RLS enabled on all tables with no public policies; the browser never talks to Supabase data tables directly. All queries run through server-side Next.js API routes gated by an owner check.                                                     |
| Platform tokens | Google OAuth tokens + Discord/Slack user tokens stored in the `platforms` table, only ever read server-side. Never sent to the frontend.                                                                                                         |
| LLM key         | Gemini API key in server env var. Not in DB, not in repo, not in client.                                                                                                                                                                         |
| Repo hygiene    | `.env.example` documents vars; no secrets committed (hard rubric requirement).                                                                                                                                                                   |

---

## 5. Ingestion (how announcements get in)

**Sync on page load, stale-while-revalidate:**

1. Dashboard (or manual "Sync now") calls `/api/sync`.
2. If `last_synced_at` < 15 minutes ago → skip (return cached).
3. Otherwise fetch announcements/assignments from Classroom (via MCP tools), Discord, and Slack, upsert into `announcements` (dedup on platform + source id), update `last_synced_at`.
4. Assignments with due dates auto-upsert calendar events (`is_auto_detected = true`).
5. A Gemini post-processing step scans new announcements for exam dates and resource links; detected events are written to Google Calendar and detected links saved to Resources, with every autonomous action recorded in the `agent_actions` audit log (surfaced as the dashboard's **Agent Activity** card).

No cron infrastructure. Data is fresh whenever the user looks.

---

## 6. In Scope (MVP — shipped)

- ✅ Supabase Auth owner login + public read-only demo mode with seeded data
- ✅ Google Classroom connect (OAuth) + in-repo Classroom MCP server
- ✅ Discord + Slack connect (user session tokens) + in-process tools
- ✅ Sync-on-load announcement ingestion with dedup + auto-detected assignment events
- ✅ Gemini announcement scanning → Google Calendar writes + autosaved resources + agent activity log
- ✅ Dashboard with upcoming events, today, stats, recent announcements, agent activity, pinned resources
- ✅ AI agent chat (Gemini) with tool calling: summarize, events CRUD, resources, study plans, web search
- ✅ Mid-conversation model selector (server-validated allowlist)
- ✅ Simple calendar view + manual event creation
- ✅ Resources page: links, labels, search, pin
- ✅ Deployed on Vercel; Kaggle writeup + ≤5-min YouTube video + README with architecture diagram

## 7. Out of Scope (documented as future work in writeup)

- ❌ Moodle / Canvas integrations
- ❌ Bidirectional Google Calendar sync (writes are one-way)
- ❌ User-provided LLM keys (Gemini only, server env key)
- ❌ Push/email notifications (reminders are calendar events only)
- ❌ File uploads (links only)
- ❌ react-big-calendar / drag-drop calendar UX
- ❌ Offline support

---

## 8. Data Flow

```
┌──────────────────┐          ┌─────────────────┐
│ Google Classroom │          │ Discord / Slack │
└────────┬─────────┘          └────────┬────────┘
         │ OAuth token                 │ user tokens
┌────────▼─────────┐                   │
│ Classroom MCP    │ (in-repo)         │
│ server           │                   │
└────────┬─────────┘                   │
         │                             │
   ┌─────▼─────────────────────────────▼──┐
   │        Next.js backend               │
   │  /api/sync   /api/chat   CRUD routes │──► Supabase (Postgres, RLS)
   │  AI agent: Vercel AI SDK + Gemini    │──► Gemini API (env key)
   │  Google Calendar writes (OAuth)      │──► Google Calendar v3 API
   └─────────────────┬────────────────────┘
                     │ (browser never hits Supabase or platforms directly)
   ┌─────────────────▼────────────────────┐
   │  Web app: owner (full) / demo (RO)   │
   └──────────────────────────────────────┘
```

---

## 9. Non-Functional Requirements

| Requirement     | Detail                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| **Hosting**     | Vercel (public URL for judges; demo mode requires no login)                                 |
| **Performance** | Session read from cookies (no auth round-trip per render); instant `loading.tsx` feedback on navigation; sync happens in background; AI responses stream. |
| **Security**    | See §4 — this is also the Concierge track story                                             |
| **Docs**        | README: problem, solution, architecture diagram, setup + deploy reproduction steps; PRIVACY.md |
| **Writeup**     | ≤2,500 words; video ≤5 min on YouTube; cover image                                          |

---

## 10. Terminology

| Term               | Meaning                                                                                |
| ------------------ | --------------------------------------------------------------------------------------- |
| **MCP Server**     | Model Context Protocol server exposing Google Classroom tools to the agent             |
| **Resource**       | A saved link (URL) to academic material — not an uploaded file                         |
| **Label**          | User-defined tag for organizing resources                                              |
| **Demo mode**      | Read-only unauthenticated view with seeded sample data, for judges                     |
| **Sync**           | On-load fetch of platform announcements into the local cache (15-min staleness window) |
| **Agent Activity** | Dashboard audit log of actions the agent took autonomously during sync                 |

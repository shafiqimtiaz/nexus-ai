<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Nexus AI — Agent Guide

## Hard Rules

### ✅ Always
- **Hugeicons** for icons: `import { HugeiconsIcon } from "@hugeicons/react"` + icon from `@hugeicons/core-free-icons`. Only inline SVG if Hugeicons lacks the icon.
- **Tailwind v4** for all styling (no inline styles).
- **requireOwner()** as first call in every write API route handler.
- **createServerClient()** for server-side DB queries (auto-selects mock vs real Supabase).
- Return `{error: string}` with appropriate status code from API routes — never throw.

### ⚠️ Ask First
- Adding new npm dependencies.
- Schema changes / migrations.
- Changing auth or RLS logic.

### 🚫 Never
- Use `@lucide/react` despite what `components.json` says.
- Import from outside `src/` (except `mcp/`, `supabase/`, `tests/`).
- Hardcode generated IDs in data migrations.
- Bypass the mock DB path — real Supabase is only for production deploy.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI Library | @base-ui/react 1.6 + shadcn inlined |
| Icons | @hugeicons/react + @hugeicons/core-free-icons |
| Styling | Tailwind CSS v4 (`@theme` in globals.css, no tailwind.config.js) |
| DB | Supabase Postgres (or mock file DB when env vars absent) |
| Server DB client | `src/lib/supabase/server.ts` → `createServerClient()` |
| Browser DB client | `@supabase/ssr` → `createClient()` |
| State / Fetching | @tanstack/react-query 5 |
| AI SDK | @ai-sdk/google — model: `gemini-2.5-flash` |
| Schema | zod 4 |
| Auth | Supabase Auth + Google OAuth (roles: `owner` / `demo`) |
| Theme | next-themes |

## Commands

```
npm run dev        # Next.js dev server
npm run build      # Production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm test           # Node built-in test runner (tests/*.test.ts)
npm run format     # Prettier
```

## Directory Map

```
src/
├── app/                  # App Router — pages + API routes
│   ├── api/*/route.ts    # REST endpoints (auth, chat, events, platforms, etc.)
│   ├── layout.tsx        # Root layout: Sidebar + Header + ChatWidget
│   └── page.tsx          # Dashboard (server component, data fetcher)
├── components/
│   ├── ui/               # shadcn base components (button, dialog, etc.)
│   ├── layout/           # sidebar.tsx, header.tsx
│   ├── dashboard/        # Dashboard widgets (todays-schedule, upcoming-events, etc.)
│   ├── calendar/         # calendar-view, event-form, day-events-dialog
│   ├── chat/             # chat-interface, chat-widget, markdown, tool-call-display
│   ├── options/          # Settings: platform-card, ai-rules-card
│   └── resources/        # resource-card, resource-form, resources-view
├── lib/
│   ├── supabase/         # server.ts, client.ts, auth-client.ts, mock-db.ts
│   ├── ai/               # tools.ts, mcp-client.ts, system-prompt.ts
│   ├── events/helpers.ts # normalizeEventTitle, shiftEndForNewStart, etc.
│   ├── platforms/        # discord.ts, slack.ts
│   ├── dashboard.ts      # getDashboardData() aggregates homepage data
│   ├── auth.ts           # getRole(), requireOwner()
│   └── auth/google-oauth.ts
├── lib/supabase/demo-seed.ts # Date-relative seed data for the mock DB
├── providers.tsx          # QueryClient + ThemeProvider + Toaster
└── proxy.ts              # Middleware (currently passthrough)
mcp/classroom/            # In-repo Google Classroom MCP Server
supabase/migrations/      # SQL migrations (012 applied)
tests/                    # Node built-in test runner
```

## Conventions

- **Kebab-case** for file names (already the convention).
- **~300 line soft limit** per file — split into modules when exceeded.
- **Feature-first grouping** for new directories (e.g. `events/`, `announcements/`).
- **Named exports** for components and utilities.
- **cn()** from `@/lib/utils` for class merging (tailwind-merge + clsx).
- **CVA** for component variant definitions.

## AI Tools

The chat AI has 9 local tools (defined in `src/lib/ai/tools.ts`):
- `get_upcoming_events`, `create_event`, `edit_event`, `cancel_event`
- `search_resource`, `add_resource`, `edit_resource`
- `generate_study_plan`, `set_reminder`, `summarize_announcements`, `online_search`

Plus Classroom MCP tools served via in-memory transport from `mcp/classroom/server.ts`.

## API Key Fallback Chain

`DB platforms record` → `GOOGLE_GENERATIVE_AI_API_KEY` env → `GEMINI_API_KEY` env

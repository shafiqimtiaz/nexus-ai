# Announcement → Calendar CRUD, Date Reliability & Sync Hardening — Design

Date: 2026-07-12
Status: Approved scope, pending spec review

## Problem

The concierge pipeline (Slack/Discord/Google Classroom announcements → Gemini extraction → calendar events) is unreliable:

1. **Wrong dates**: extraction prompt gives Gemini neither the announcement posting date nor the current date. Relative phrases ("Wednesday", "today") resolve to hallucinated dates. Confirmed in prod DB: announcement posted 2026-07-06 produced an event on 2026-01-21; a June 2 "view scripts today" announcement produced a Sept 1 event.
2. **Stale announcements**: months-old announcements (last semester) still generate calendar events.
3. **No cancellation/update handling**: "quiz cancelled" / "quiz moved to Friday" announcements are ignored; events are only ever created.
4. **Quiz details invisible**: upcoming events list rows are not clickable; description, platform, and source announcement are unreachable.
5. **Duplicate events keep recurring** despite three dedup fixes — root causes are id-mapping bugs in the Google Calendar round-trip (findings R2, R3 below), not dedup logic.
6. Assorted sync reliability and security gaps (below).

## Scope

### A. Schema (one migration)

- `events.status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled'))`.
- `events.gcal_event_id TEXT` — Google Calendar mapping decoupled from origin `source_external_id` (see §E). Backfill from existing `gcal:`-prefixed `source_external_id` values.
- Mirror in `supabase/migrations/` and mock DB seed/types.

### B. Extraction date correctness (`src/app/api/sync/route.ts`)

- **Date anchoring**: extraction prompt includes `Announcement posted: {announced_at ISO}` and `Current date: {now ISO}`. Instruct: resolve all relative dates against the posting date; output full ISO 8601 **with UTC offset** (fixes naive-timestamp drift, finding R7).
- **Staleness gate (code, not LLM)**: `const STALE_ANNOUNCEMENT_DAYS = 30`. If `announced_at` older than threshold → skip event extraction for that announcement entirely (announcement itself still stored/summarized).
- **Past-date guard (code)**: after extraction, drop events with `start_time < now`, EXCEPT `assignment` type from non-stale announcements (overdue work stays visible — preserves intent of commit 9d6113a).
- **Date validity guard**: reject non-parseable `start_time` (e.g. "TBD") for all event types including assignments (fixes dashboard `RangeError` crash, finding R9).

### C. Full CRUD from announcements (`src/app/api/sync/route.ts`)

Extraction schema per event becomes `{action: "create"|"update"|"cancel", title, event_type, start_time, end_time?, description?}`.

- `create` → existing insert + dedup path.
- `update` (postponed/rescheduled/changed) → match existing event by normalized title + event_type (reuse `normalizeEventTitle`); update `start_time`/`end_time`/`description`. If matched event has a `gcal:` id, patch Google Calendar too.
- `cancel` → match same way; set `status='cancelled'` (soft cancel); delete the Google Calendar copy if mapped; log to `agent_actions`.
- No match on update/cancel → log to `agent_actions`, no-op. Never phantom-create from an update/cancel action.

### D. Concierge chat agent (`src/lib/ai/tools.ts`, `src/lib/ai/system-prompt.ts`)

- New `cancel_event` tool: soft cancel + Google Calendar delete if mapped.
- `get_upcoming_events` and dashboard queries filter `status != 'cancelled'`.
- System prompt: document cancellation ability and announcement-date awareness.
- Fix `summarize_announcements`: apply platform filter in the DB query before limit (finding R6).

### E. Google Calendar round-trip integrity (findings R1, R2, R3, R8)

- **R1 — mass-delete guard**: `listGoogleCalendarEvents` must distinguish "empty" from "error" (throw or return null on failure); deletion pass runs only on a confirmed-successful, fully-paginated listing (`nextPageToken` loop, not 250-cap).
- **R2 — edit_event id clobber**: when editing an event whose `source_external_id` is not `gcal:`-prefixed (classroom/auto ids), never overwrite `source_external_id`/`source_platform` with the new gcal id. Store the gcal mapping without destroying the origin id (dedicated `gcal_event_id` column on `events` in the same migration; all gcal push/patch/delete paths read it).
- **R3 — discarded gcal id**: extraction's `writeToGoogleCalendar` must persist the returned Google event id (into `gcal_event_id`), so the next sync's import pass recognizes the copy instead of re-importing it as a new event.
- **R8 — PATCH drift**: when updating `start_time`, always send a consistent `end` (shift end by same delta, or default duration); surface gcal API errors to the caller instead of `console.error` swallow.
- **Acceptance**: full round-trip verified — create local → appears in gcal once; edit local → gcal updates; cancel → gcal copy removed; gcal outage during sync → zero local deletions; re-sync after all of the above → zero duplicates.

### F. Sync robustness (findings R4, R5)

- **R4**: wrap per-announcement Gemini call in try/catch inside the loop; one failure skips that announcement only. Sync response includes an `errors` count/field instead of silent success.
- **R5**: write the processed marker (`agent_actions.source_id`) whenever extraction completed for an announcement — including when all extracted items already existed — so announcements are not re-sent to Gemini every sync and student edits are not silently reverted by the re-processing overwrite.

### G. UI — quiz/event details

- `upcoming-events.tsx`: rows clickable → detail modal (reuse `exams-modal` pattern): description, end time, platform badge, source announcement link, auto-detected flag.
- Cancelled events: excluded from "upcoming"; shown struck-through on calendar view.

### H. Security quick wins

- Add `requireOwner()` to mutating routes: `events`, `resources`, `settings`, `labels` (POST/PATCH/DELETE).
- Markdown renderer (`src/components/chat/markdown.tsx`): allowlist `http:`/`https:` link schemes; drop `javascript:`/`data:` hrefs.
- `nexus_logged_in` cookie set `httpOnly` where server-set.

### I. Data cleanup (one-off, after fix ships)

- Delete/fix bad auto-detected rows in prod: "Online Makeup Class" (2026-01-21) and mis-dated "Final Exam Script Review"; remove any past-dated auto-detected non-assignment events.

## Out of scope (tracked, deliberate)

- Prompt-injection hardening of agent tool loop (needs its own design: confirmation gates, content sanitization, tool allowlisting).
- Token encryption at rest.
- Review/approval queue for auto-detected events; undo for agent actions.
- Course/semester data model; recurring events; study-plan conflict detection.
- User timezone modeling (R10) and concurrent-sync locking / mock-DB atomic writes (R11), unread flag in mock mode (R12).

## Testing

- Unit tests for pure helpers: staleness gate, past-date/validity guard, event matching (title+type), gcal end-shift math.
- Integration (manual + scripted): re-run sync on existing prod-like announcements → no past-dated non-assignment events, no duplicates; simulate cancellation and reschedule announcements → event soft-cancelled / moved; gcal round-trip acceptance checks in §E.
- UI: quiz row opens modal with description, platform, source link; cancelled event struck-through.

## Key decisions

- Staleness threshold: 30 days, single constant (`STALE_ANNOUNCEMENT_DAYS`).
- Soft cancel (status column), not hard delete — reversible, auditable.
- Single-pass extraction with `action` field, not a two-stage intent classifier — fewer LLM calls, same accuracy at this scale.
- New `gcal_event_id` column decouples Google Calendar mapping from origin `source_external_id` — eliminates the id-clobber class of duplicate bugs.

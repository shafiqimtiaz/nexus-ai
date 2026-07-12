# Announcement CRUD, Date Reliability & Sync Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make announcement→calendar handling reliable: date-anchored extraction with full create/update/cancel CRUD, staleness gates, export-only Google Calendar mirror via a dedicated `gcal_event_id`, clickable event details, and security quick wins.

**Architecture:** Next.js App Router (v16), server routes use `createServerClient()` (real Supabase OR mock file DB — code must work with both). Sync pipeline in `src/app/api/sync/route.ts` calls Gemini per announcement. Chat concierge tools in `src/lib/ai/tools.ts`. Google Calendar becomes a one-way (export-only) mirror; the gcal import/delete passes are removed. Spec: `docs/superpowers/specs/2026-07-12-announcement-crud-reliability-design.md`.

**Tech Stack:** TypeScript strict, Supabase JS, Vercel AI SDK (`ai` + `@ai-sdk/google` only — never `@ai-sdk/openai`), zod, date-fns, Tailwind. Tests: Node 22 built-in `node:test` with `--experimental-strip-types` (no new dependencies — `package.json` is OFF-LIMITS).

**Conventions:** Conventional Commits, NO `Co-Authored-By` trailer ever. Do not touch `package.json`, `.env*`, Docker files. After each task: `npm run lint` must pass.

**Verify loop for every task:** `npm run lint` and (where a test exists) `node --experimental-strip-types --test tests/*.test.ts`.

---

### Task 1: Pure helpers module (TDD)

New dependency-free helpers used by sync + tools + routes. No `@/` imports inside the helpers file so tests run under plain `node --experimental-strip-types`.

**Files:**
- Create: `src/lib/events/helpers.ts`
- Create: `tests/event-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/event-helpers.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STALE_ANNOUNCEMENT_DAYS,
  isStaleAnnouncement,
  keepExtractedEvent,
  normalizeEventTitle,
  isValidDate,
  shiftEndForNewStart,
} from "../src/lib/events/helpers.ts";

const NOW = new Date("2026-07-12T12:00:00Z");

test("isStaleAnnouncement: older than threshold is stale", () => {
  assert.equal(isStaleAnnouncement("2026-06-01T00:00:00Z", NOW), true);
});

test("isStaleAnnouncement: recent announcement is not stale", () => {
  assert.equal(isStaleAnnouncement("2026-07-10T00:00:00Z", NOW), false);
});

test("isStaleAnnouncement: null/invalid dates are not stale (fail open)", () => {
  assert.equal(isStaleAnnouncement(null, NOW), false);
  assert.equal(isStaleAnnouncement("garbage", NOW), false);
});

test("STALE_ANNOUNCEMENT_DAYS is 30", () => {
  assert.equal(STALE_ANNOUNCEMENT_DAYS, 30);
});

test("keepExtractedEvent: drops past non-assignment events", () => {
  assert.equal(
    keepExtractedEvent({ title: "Quiz 1", event_type: "quiz", start_time: "2026-01-21T20:00:00Z" }, NOW),
    false
  );
});

test("keepExtractedEvent: keeps future events", () => {
  assert.equal(
    keepExtractedEvent({ title: "Quiz 2", event_type: "quiz", start_time: "2026-07-18T09:00:00Z" }, NOW),
    true
  );
});

test("keepExtractedEvent: keeps past assignments (overdue work)", () => {
  assert.equal(
    keepExtractedEvent({ title: "HW 1", event_type: "assignment", start_time: "2026-07-01T23:59:00Z" }, NOW),
    true
  );
});

test("keepExtractedEvent: drops invalid dates for ALL types including assignments", () => {
  assert.equal(keepExtractedEvent({ title: "HW", event_type: "assignment", start_time: "TBD" }, NOW), false);
  assert.equal(keepExtractedEvent({ title: "HW", event_type: "assignment" }, NOW), false);
});

test("keepExtractedEvent: cancel action needs no date", () => {
  assert.equal(keepExtractedEvent({ action: "cancel", title: "Quiz 2", event_type: "quiz" }, NOW), true);
});

test("normalizeEventTitle: strips subtitle after colon/dash, lowercases", () => {
  assert.equal(normalizeEventTitle("Quiz 2: Clipping Algorithms"), "quiz 2");
  assert.equal(normalizeEventTitle("Quiz 2 — details"), "quiz 2");
  assert.equal(normalizeEventTitle("  QUIZ   2  "), "quiz 2");
  assert.equal(normalizeEventTitle(null), "");
});

test("isValidDate", () => {
  assert.equal(isValidDate("2026-07-18T09:00:00Z"), true);
  assert.equal(isValidDate("TBD"), false);
  assert.equal(isValidDate(undefined), false);
});

test("shiftEndForNewStart: preserves original duration", () => {
  const end = shiftEndForNewStart("2026-07-18T09:00:00Z", "2026-07-18T10:30:00Z", "2026-07-20T14:00:00Z");
  assert.equal(new Date(end).getTime(), new Date("2026-07-20T15:30:00Z").getTime());
});

test("shiftEndForNewStart: defaults to 1h when no prior end", () => {
  const end = shiftEndForNewStart("2026-07-18T09:00:00Z", null, "2026-07-20T14:00:00Z");
  assert.equal(new Date(end).getTime(), new Date("2026-07-20T15:00:00Z").getTime());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test tests/event-helpers.test.ts`
Expected: FAIL — `Cannot find module '.../src/lib/events/helpers.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/events/helpers.ts
export const STALE_ANNOUNCEMENT_DAYS = 30;

export type ExtractedEvent = {
  action?: "create" | "update" | "cancel";
  title: string;
  description?: string;
  event_type?: string;
  start_time?: string;
  end_time?: string;
};

export function isValidDate(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

export function isStaleAnnouncement(announcedAt: string | null, now: Date): boolean {
  if (!announcedAt) return false;
  const t = new Date(announcedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > STALE_ANNOUNCEMENT_DAYS * 24 * 60 * 60 * 1000;
}

// Past assignments stay visible as overdue work; past quizzes/exams/other are noise.
export function keepExtractedEvent(e: ExtractedEvent, now: Date): boolean {
  if (e.action === "cancel") return true;
  if (!isValidDate(e.start_time)) return false;
  if (e.event_type === "assignment") return true;
  return new Date(e.start_time as string).getTime() > now.getTime();
}

export function normalizeEventTitle(title: string | null): string {
  if (!title) return "";
  return title
    .replace(/[:–—].*$/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function shiftEndForNewStart(
  oldStart: string | null,
  oldEnd: string | null,
  newStart: string
): string {
  const newStartMs = new Date(newStart).getTime();
  const oldStartMs = oldStart ? new Date(oldStart).getTime() : NaN;
  const oldEndMs = oldEnd ? new Date(oldEnd).getTime() : NaN;
  const duration =
    !Number.isNaN(oldStartMs) && !Number.isNaN(oldEndMs) && oldEndMs > oldStartMs
      ? oldEndMs - oldStartMs
      : 60 * 60 * 1000;
  return new Date(newStartMs + duration).toISOString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test tests/event-helpers.test.ts`
Expected: all tests pass. Also run `npm run lint` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/events/helpers.ts tests/event-helpers.test.ts
git commit -m "feat(events): pure helpers for staleness, date guards, title matching"
```

---

### Task 2: Migration 012 — `events.status` + `gcal_event_id`; mock DB `neq`

History note: `gcal_event_id` existed (005) and was dropped (007) as "never reliably populated". This plan re-adds it AND populates it on every push path (Tasks 3–6), which is what was missing. Do not change the existing `events_auto_dedup_idx` from 011.

**Files:**
- Create: `supabase/migrations/012_event_status_and_gcal_id.sql`
- Modify: `src/lib/supabase/mock-db.ts` (add `neq` after `eq`, ~line 278)

- [ ] **Step 1: Write the migration**

```sql
-- 012_event_status_and_gcal_id.sql
-- Soft-cancel support: cancellation announcements set status='cancelled'
-- instead of deleting (reversible, auditable).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled'));

-- Re-adds gcal_event_id (dropped in 007 as dead). Root cause of recurring
-- duplicates: push paths overwrote source_platform/source_external_id (the
-- dedup identity) with the gcal id. Now the gcal mapping lives here and every
-- writeToGoogleCalendar call persists the returned id (export-only mirror).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

-- Backfill from legacy "gcal:<id>" identities.
UPDATE events
  SET gcal_event_id = substring(source_external_id from 6)
  WHERE source_external_id LIKE 'gcal:%' AND gcal_event_id IS NULL;
```

- [ ] **Step 2: Add `neq` to the mock query builder**

In `src/lib/supabase/mock-db.ts`, directly after the `eq` method (line ~278):

```ts
  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }
```

(Mock rows have no `status` column → `undefined !== "cancelled"` → they pass `.neq("status","cancelled")` filters. No seed change needed.)

- [ ] **Step 3: Verify**

Run: `npm run lint` — clean. Do NOT apply the migration to the live DB yet (final task does that).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_event_status_and_gcal_id.sql src/lib/supabase/mock-db.ts
git commit -m "feat(db): events.status soft-cancel + gcal_event_id mapping; mock neq"
```

---

### Task 3: google-oauth — end-time drift fix + `eventGcalId` helper; delete list import

**Files:**
- Modify: `src/lib/auth/google-oauth.ts`

- [ ] **Step 1: Add `eventGcalId` helper** (after `parseGcalId`, ~line 169)

```ts
export function eventGcalId(row: {
  gcal_event_id?: string | null;
  source_external_id?: string | null;
}): string | null {
  return row.gcal_event_id ?? parseGcalId(row.source_external_id);
}
```

- [ ] **Step 2: Fix `updateGoogleCalendarEvent` PATCH drift** (R8)

Google rejects a PATCH whose new `start` ≥ existing `end` (HTTP 400) — currently the end is deliberately omitted when only start changes (line 239-240), so the event silently never moves in gcal. Replace the body-building block (lines 236-243):

```ts
    if (fields.startTime !== undefined) {
      const { start, end } = eventTimes(fields.startTime, fields.endTime);
      body.start = start;
      body.end = end; // always send a consistent end with a new start (Google 400s otherwise)
    } else if (fields.endTime !== undefined) {
      body.end = { dateTime: fields.endTime };
    }
```

(Callers that move an event pass a duration-shifted `endTime` via `shiftEndForNewStart`; `eventTimes` falls back to start+1h when none given.)

- [ ] **Step 3: Delete `listGoogleCalendarEvents` and `GoogleCalendarEvent`** (lines 281-338)

Export-only mirror: the gcal→local import is removed (Task 5 removes its only caller). Delete the `GoogleCalendarEvent` interface and `listGoogleCalendarEvents` function entirely. Keep `gcalExternalId`/`parseGcalId` (legacy ids still resolved).

Note: do this step in the same commit as Task 5 if lint complains about the unused export ordering — otherwise proceed.

- [ ] **Step 4: Verify + commit**

Run: `npm run lint` (if it fails only because sync/route.ts still imports `listGoogleCalendarEvents`, defer the deletion of Step 3 to Task 5's commit and commit Steps 1-2 now).

```bash
git add src/lib/auth/google-oauth.ts
git commit -m "fix(gcal): always send end with new start; add eventGcalId resolver"
```

---

### Task 4: tools.ts — stop clobbering identity; use `gcal_event_id`

Root cause of recurring duplicate quizzes (R2): `pushEventToGoogle` overwrites `source_platform`/`source_external_id` (the dedup identity) with the gcal id.

**Files:**
- Modify: `src/lib/ai/tools.ts`

- [ ] **Step 1: Rewrite `pushEventToGoogle`** (lines 29-50)

```ts
async function pushEventToGoogle(
  db: ReturnType<typeof createServerClient>,
  eventId: string,
  title: string,
  startTime: string,
  endTime?: string | null,
  description?: string | null
): Promise<void> {
  const googleId = await writeToGoogleCalendar(
    title,
    startTime,
    endTime ?? undefined,
    description ?? undefined
  );
  if (googleId) {
    await db.from("events").update({ gcal_event_id: googleId }).eq("id", eventId);
  }
}
```

Remove now-unused imports `getGooglePlatformId` and `gcalExternalId` from the import block (lines 5-11); add `eventGcalId` and `deleteGoogleCalendarEvent`:

```ts
import {
  writeToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  eventGcalId,
  parseGcalId,
} from "@/lib/auth/google-oauth";
```

Also import the shared helper at the top:

```ts
import { shiftEndForNewStart } from "@/lib/events/helpers";
```

(If `parseGcalId` ends up unused after these edits, remove it from the import too.)

- [ ] **Step 2: Fix `edit_event`** (lines 137-178)

Fetch the row BEFORE updating (need old start/end for duration shift and the gcal mapping), and never clobber identity. Replace the whole `execute`:

```ts
      execute: async ({ id, ...fields }) => {
        const db = createServerClient();
        const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
        if (Object.keys(patch).length === 0) {
          return fail("edit_event", "no fields provided to update");
        }

        const { data: before } = await db
          .from("events")
          .select("id, start_time, end_time, gcal_event_id, source_external_id")
          .eq("id", id)
          .maybeSingle();
        if (!before) return fail("edit_event", "event not found");

        const { data, error } = await db
          .from("events")
          .update(patch)
          .eq("id", id)
          .select(EVENT_COLUMNS)
          .single();

        if (error) return fail("edit_event", error.message);

        const gid = eventGcalId(before);
        if (gid) {
          const newStart = patch.start_time as string | undefined;
          await updateGoogleCalendarEvent(gid, {
            title: patch.title as string | undefined,
            startTime: newStart,
            endTime:
              (patch.end_time as string | undefined) ??
              (newStart ? shiftEndForNewStart(before.start_time, before.end_time, newStart) : undefined),
            description: patch.description as string | undefined,
          });
        } else {
          await pushEventToGoogle(db, id, data.title, data.start_time, data.end_time, data.description);
        }

        return { updated: data };
      },
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint`

```bash
git add src/lib/ai/tools.ts
git commit -m "fix(tools): stop clobbering event identity with gcal id on edit/push"
```

---

### Task 5: Sync route — export-only Google Calendar (delete import/delete passes)

Removes R1 (a gcal outage or >250-event window mass-deletes local events) and R3 (pushed copies re-imported as duplicates) by removing the import/delete mirror entirely. Confirmed with user: gcal→Nexus import is not wanted.

**Files:**
- Modify: `src/app/api/sync/route.ts`

- [ ] **Step 1: Replace `syncGoogleCalendar` (lines 160-261) with an export-only backstop**

Delete the `IMPORT_WINDOW_PAST_MS`/`IMPORT_WINDOW_FUTURE_MS` constants and the whole `syncGoogleCalendar` function. Add:

```ts
// Export-only mirror: push user-created events (no platform identity, no gcal
// mapping yet) to Google Calendar. Nexus is the source of truth; nothing is
// imported back and nothing local is ever deleted because of Google.
async function pushLocalEventsToGoogle(db: ReturnType<typeof createServerClient>): Promise<number> {
  let pushed = 0;
  const { data: rows } = await db
    .from("events")
    .select("id, title, start_time, end_time, description, source_external_id, gcal_event_id")
    .neq("status", "cancelled");
  for (const r of (rows ?? []) as any[]) {
    if (r.source_external_id || r.gcal_event_id || !r.start_time) continue;
    const googleId = await writeToGoogleCalendar(
      r.title,
      r.start_time,
      r.end_time ?? undefined,
      r.description ?? undefined
    );
    if (googleId) {
      await db.from("events").update({ gcal_event_id: googleId }).eq("id", r.id);
      pushed++;
    }
  }
  return pushed;
}
```

- [ ] **Step 2: Update `syncClassroom`** (line 267)

Replace `const calendarEvents = await syncGoogleCalendar(db, platform.id);` with:

```ts
  const calendarEvents = await pushLocalEventsToGoogle(db);
```

- [ ] **Step 3: Fix imports** (lines 10-15)

```ts
import { writeToGoogleCalendar, deleteGoogleCalendarEvent } from "@/lib/auth/google-oauth";
```

(`listGoogleCalendarEvents`, `gcalExternalId`, `parseGcalId` no longer used here; `deleteGoogleCalendarEvent` is used by Task 6. If Task 3 Step 3 was deferred, delete `listGoogleCalendarEvents` + `GoogleCalendarEvent` from `google-oauth.ts` now.)

Also delete the now-unused local `classifyEventType`… **NO — keep it**: it is still used by the extraction path (line 569). Only remove what this task orphaned.

- [ ] **Step 4: Verify + commit**

Run: `npm run lint`

```bash
git add src/app/api/sync/route.ts src/lib/auth/google-oauth.ts
git commit -m "feat(sync): export-only Google Calendar mirror, remove import/delete passes"
```

---

### Task 6: Sync route — anchored extraction with create/update/cancel CRUD

The core fix. Extraction gets date anchors + action field; code-level staleness/past-date gates; per-announcement error isolation (R4); always-write processed marker (R5); persist gcal id on create (R3).

**Files:**
- Modify: `src/app/api/sync/route.ts`

- [ ] **Step 1: Import helpers; delete local duplicates**

Add import:

```ts
import {
  STALE_ANNOUNCEMENT_DAYS,
  isStaleAnnouncement,
  keepExtractedEvent,
  normalizeEventTitle,
  isValidDate,
  shiftEndForNewStart,
} from "@/lib/events/helpers";
```

Also add `updateGoogleCalendarEvent` to the google-oauth import. Delete the local `normalizeEventTitle` (lines 78-85) and `isFutureDate` (lines 99-104) functions — the helper versions replace them.

- [ ] **Step 2: Replace the extraction prompt** (lines 477-510)

```ts
          const nowIso = new Date().toISOString();
          const prompt = `You are the autonomous Nexus AI Concierge Agent. Read this university announcement in FULL and extract EVERYTHING useful for a student's academic organizer.

Announcement posted at: ${ann.announced_at ?? "unknown"}
Current date: ${nowIso}

Announcement content:
"${ann.content}"

Extract ALL of the following — be exhaustive, never stop after the first match:
- summary: A short, easy-to-read summary (2–4 sentences, plain language, no markdown) of the announcement's key points so a student can skim it at a glance. Lead with what matters most. Preserve concrete details (rooms, times, dates, names).
- title: A concise, human-readable headline for the whole announcement (max ~8 words), plain text only — no markdown, quotes, or emoji.
- events: EVERY deadline or scheduled occurrence — every quiz, exam, midterm, final, assignment/homework/project submission, office hour, review session, or meeting. Assignment submission deadlines MUST use event_type "assignment"; quizzes "quiz"; exams/midterms/finals "exam"; other scheduled items "other". If a date/time range is given, set end_time too.
  Each event carries an "action":
  - "create": a newly announced deadline or occurrence.
  - "update": the announcement MOVES or CHANGES an already-known event (words like "moved to", "postponed", "rescheduled", "new date", "changed to"). Use the event's original name as title and the NEW date/time as start_time.
  - "cancel": the announcement CANCELS an event ("cancelled", "called off", "will not take place", "no quiz this week"). Use the cancelled event's name as title; start_time may be an empty string.
- resources: EVERY distinct URL (Google Docs, Drive, Forms, PDFs, slides, syllabus, repo, video, website) as a resource. Use the link's visible label as the title when present; otherwise infer a short title from context. Add a one-line description of what the link is.
- key_dates: An array of {label, date} for ANY standalone important dates mentioned even if they don't become calendar events (e.g. "Reading due", "Drop deadline"). Use ISO 8601 dates. Empty array if none.

Date rules (CRITICAL):
- Resolve ALL relative dates ("today", "tomorrow", "Wednesday", "next week") against the ANNOUNCEMENT POSTED date above — NOT the current date. An announcement saying "quiz on Wednesday" means the Wednesday right after it was posted.
- start_time and end_time MUST be full ISO 8601 WITH an explicit UTC offset (e.g. "2026-07-15T23:59:00+06:00" or "2026-07-15T17:59:00Z"). Never emit a naive timestamp.
- If only a date is given, use 23:59 in the announcement's local timezone; if the timezone is unknown, use the announcement posted time's offset.

Rules:
- A single announcement often bundles MULTIPLE items (e.g. a quiz AND an assignment, plus several links). Capture EVERY one as its own array entry.
- Respond ONLY with a valid JSON object matching this TypeScript type:
{
  summary: string;
  title: string;
  events: Array<{
    action: "create" | "update" | "cancel";
    title: string;
    description: string;
    event_type: "exam" | "quiz" | "assignment" | "other";
    start_time: string; // ISO 8601 with offset; empty string only for action "cancel"
    end_time: string;   // ISO 8601 with offset, or empty string when not stated.
  }>;
  resources: Array<{
    title: string;
    url: string;
    description: string;
  }>;
  key_dates: Array<{ label: string; date: string }>;
}
- Use empty arrays when there are no events, resources, or key_dates.
- Do not add markdown backticks or any wrapper — return raw JSON string.`;
```

- [ ] **Step 3: Staleness gate + per-announcement error isolation**

Immediately after the `if (existingAction) continue;` (line 475), add the stale gate:

```ts
          if (isStaleAnnouncement(ann.announced_at, new Date())) {
            try {
              await db.from("agent_actions").insert({
                title: "Skipped stale announcement",
                description: `Announcement posted ${ann.announced_at} is older than ${STALE_ANNOUNCEMENT_DAYS} days — no events scheduled from it.`,
                action_type: "sync",
                source_id: ann.id,
              });
            } catch {}
            continue;
          }
```

Then wrap the `generateText` call AND everything after it (through the end of the per-announcement body, i.e. the current inner `try { const result = JSON.parse(...) ... } catch {}` block, lines 512-691) in one try/catch so a Gemini rate-limit on announcement #2 no longer kills announcements #3-12 (R4):

Declare the counter ONCE, just inside the outer `try {` at line 445 (so the final `return` can read it):

```ts
  let aiErrors = 0;
```

Wait — the `return Response.json(...)` at line 736 is OUTSIDE that try block, so declare it at function scope instead: put `let aiErrors = 0;` right after `const synced: SyncResult[] = [];` (line 394). Then wrap each announcement's processing:

```ts
          try {
            const { text } = await generateText({
              model: googleProvider("gemini-flash-lite-latest"),
              prompt,
            });
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(cleanText);
            // ... entire existing processing body (patched below) ...
          } catch {
            aiErrors++;
            continue;
          }
```

(The old inner `try { JSON.parse ... } catch {}` merges into this single block — remove the now-redundant nesting.) Change the final response (line 736) to:

```ts
  return Response.json({ synced, aiErrors });
```

- [ ] **Step 4: Replace the past-date filter with the helper** (lines 545-557)

```ts
            const events = rawEvents
              .filter((e) => e && typeof e.title === "string" && keepExtractedEvent(e, new Date()))
              .map((e) => {
                const endRaw = typeof e.end_time === "string" ? e.end_time.trim() : "";
                const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
                const startMs = new Date(e.start_time).getTime();
                const end_time = !Number.isNaN(endMs) && endMs > startMs ? endRaw : null;
                return { ...e, end_time };
              });
```

- [ ] **Step 5: Action-aware event loop** (replace lines 562-634)

```ts
            for (let i = 0; i < events.length; i++) {
              const ev = events[i];
              const action = ev.action === "update" || ev.action === "cancel" ? ev.action : "create";
              const eventTitle = ev.title;
              const eventStart = ev.start_time;
              const eventType =
                ev.event_type && ev.event_type !== "other"
                  ? ev.event_type
                  : classifyEventType(eventTitle);

              if (action === "cancel" || action === "update") {
                const { data: candidates } = await db
                  .from("events")
                  .select("id, title, start_time, end_time, gcal_event_id, source_external_id")
                  .eq("event_type", eventType)
                  .neq("status", "cancelled")
                  .gte("start_time", new Date().toISOString());
                const target = (candidates ?? []).find(
                  (c: any) => normalizeEventTitle(c.title) === normalizeEventTitle(eventTitle)
                );
                if (!target) {
                  // Never phantom-create from an update/cancel; just log.
                  scheduled.push(`could not find a matching ${eventType} for ${action} "${eventTitle}"`);
                  continue;
                }
                const gid = eventGcalId(target);
                if (action === "cancel") {
                  await db.from("events").update({ status: "cancelled" }).eq("id", target.id);
                  if (gid) await deleteGoogleCalendarEvent(gid);
                  scheduled.push(`cancelled ${eventType} "${target.title}"`);
                } else {
                  const patch: Record<string, unknown> = { description: ev.description };
                  if (isValidDate(eventStart)) patch.start_time = eventStart;
                  if (ev.end_time) patch.end_time = ev.end_time;
                  await db.from("events").update(patch).eq("id", target.id);
                  if (gid && patch.start_time) {
                    await updateGoogleCalendarEvent(gid, {
                      startTime: eventStart,
                      endTime:
                        ev.end_time ?? shiftEndForNewStart(target.start_time, target.end_time, eventStart),
                      description: ev.description,
                    });
                  }
                  scheduled.push(
                    `rescheduled ${eventType} "${target.title}" to ${new Date(
                      (patch.start_time as string) ?? target.start_time
                    ).toLocaleDateString()}`
                  );
                }
                continue;
              }

              const autoExternalId = `auto-${ann.id}-${i}`;

              const { data: existingByAuto } = await db
                .from("events")
                .select(EVENT_COLS_FULL)
                .eq("source_platform", ann.platform_id)
                .eq("source_external_id", autoExternalId)
                .maybeSingle();

              const { data: contentCandidates } = existingByAuto
                ? { data: [] }
                : await db
                    .from("events")
                    .select(EVENT_COLS_FULL)
                    .eq("start_time", eventStart)
                    .eq("event_type", eventType);
              const existingByContent = (contentCandidates ?? []).find(
                (c: any) => normalizeEventTitle(c.title) === normalizeEventTitle(eventTitle)
              );

              const existing = existingByAuto ?? existingByContent;

              if (existing) {
                await db
                  .from("events")
                  .update({
                    description: ev.description,
                    event_type: eventType,
                    end_time: ev.end_time ?? null,
                  })
                  .eq("id", existing.id);
              } else {
                const { data: inserted, error: evError } = await db
                  .from("events")
                  .insert({
                    title: eventTitle,
                    description: ev.description,
                    event_type: eventType,
                    start_time: eventStart,
                    end_time: ev.end_time ?? null,
                    source_platform: ann.platform_id,
                    source_external_id: autoExternalId,
                    is_auto_detected: true,
                  })
                  .select("id")
                  .single();
                if (evError || !inserted) continue;

                try {
                  const googleId = await writeToGoogleCalendar(
                    eventTitle,
                    eventStart,
                    ev.end_time ?? undefined,
                    ev.description
                  );
                  if (googleId) {
                    await db.from("events").update({ gcal_event_id: googleId }).eq("id", inserted.id);
                  }
                } catch {}
                scheduled.push(
                  `${eventType} "${eventTitle}" on ${new Date(eventStart).toLocaleDateString()}`
                );
              }
            }
```

Add `eventGcalId` to the google-oauth import.

- [ ] **Step 6: Always write the processed marker** (R5)

Replace the final "no actionable" condition (line 683: `if (events.length === 0 && rawResources.length === 0 && rawKeyDates.length === 0)`) with:

```ts
            if (scheduled.length === 0 && !savedResource) {
              try {
                await db.from("agent_actions").insert({
                  title: "Concierge Announcement Scan",
                  description: `Processed announcement "${ann.content.slice(0, 50)}...". Nothing new to schedule or save.`,
                  action_type: "sync",
                  source_id: ann.id,
                });
              } catch {}
            }
```

(The try/catch matters: `agent_actions_dedup_idx` from migration 005 is unique on (user_id, source_id, action_type).) Now every processed announcement gets ≥1 `agent_actions` row → the `existingAction` check (line 468) makes reprocessing (and silent reversion of student edits) impossible.

- [ ] **Step 7: Verify + commit**

Run: `npm run lint`. Manual check in demo mode: `npm run dev`, then `curl -X POST "http://localhost:3000/api/sync?force=1"` — response contains `aiErrors` field.

```bash
git add src/app/api/sync/route.ts
git commit -m "feat(sync): date-anchored extraction with create/update/cancel actions, stale gate, error isolation"
```

---

### Task 7: Concierge chat — `cancel_event` tool, cancelled filter, platform filter fix

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Modify: `src/lib/ai/system-prompt.ts`

- [ ] **Step 1: Filter cancelled from `get_upcoming_events`**

After `.lte("start_time", until.toISOString())` (line 75) add:

```ts
          .neq("status", "cancelled")
```

- [ ] **Step 2: Add `cancel_event` tool** (after `edit_event`)

```ts
    cancel_event: tool({
      description:
        "Cancel an event by id — use when the student says a quiz/exam/class was cancelled or asks to remove an event. The event is kept as status 'cancelled' (reversible) and its Google Calendar copy is deleted. Get the id from get_upcoming_events first.",
      inputSchema: z.object({
        id: z.string().describe("The event id to cancel."),
      }),
      execute: async ({ id }) => {
        const db = createServerClient();
        const { data: row } = await db
          .from("events")
          .select("id, title, gcal_event_id, source_external_id")
          .eq("id", id)
          .maybeSingle();
        if (!row) return fail("cancel_event", "event not found");

        const { data, error } = await db
          .from("events")
          .update({ status: "cancelled" })
          .eq("id", id)
          .select(EVENT_COLUMNS)
          .single();
        if (error) return fail("cancel_event", error.message);

        const gid = eventGcalId(row);
        if (gid) await deleteGoogleCalendarEvent(gid);

        return { cancelled: data };
      },
    }),
```

- [ ] **Step 3: Fix `summarize_announcements` platform filter** (R6 — filter in query, before limit)

Replace the execute body (lines 353-378):

```ts
      execute: async ({ limit, platform }) => {
        const db = createServerClient();
        const platformById = await getPlatformTypeMap(db);

        let query = db
          .from("announcements")
          .select("id, title, content, ai_summary, author, source_url, announced_at, platform_id")
          .order("announced_at", { ascending: false, nullsFirst: false })
          .limit(limit ?? 10);

        if (platform) {
          const ids = [...platformById.entries()]
            .filter(([, type]) => type === platform)
            .map(([id]) => id);
          if (ids.length === 0) return { count: 0, announcements: [] };
          query = query.in("platform_id", ids);
        }

        const { data, error } = await query;
        if (error) return fail("summarize_announcements", error.message);

        const announcements = (data ?? []).map((a: any) => {
          const { platform_id, ...rest } = a;
          return {
            ...rest,
            summary: a.ai_summary ?? null,
            platform: platform_id ? (platformById.get(platform_id) ?? null) : null,
          };
        });

        return { count: announcements.length, announcements };
      },
```

- [ ] **Step 4: System prompt** — in `src/lib/ai/system-prompt.ts`, after the get_upcoming_events rule (line 11), add:

```
- To cancel an event (a cancelled quiz/class, or on request), call cancel_event
  with the event id. Cancelled events are kept but hidden from upcoming lists.
- Announcements carry an announced_at date. When reasoning about dates from an
  announcement, resolve relative wording against that posting date.
```

- [ ] **Step 5: Verify + commit**

Run: `npm run lint`

```bash
git add src/lib/ai/tools.ts src/lib/ai/system-prompt.ts
git commit -m "feat(agent): cancel_event tool, hide cancelled events, platform filter before limit"
```

---

### Task 8: Events API route — requireOwner + gcal mapping + status

**Files:**
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Imports + columns**

```ts
import { requireOwner } from "@/lib/auth";
import { shiftEndForNewStart } from "@/lib/events/helpers";
```

Change google-oauth import: drop `getGooglePlatformId` and `gcalExternalId`, add `eventGcalId`. Update columns:

```ts
const SELECT_COLUMNS =
  "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, gcal_event_id, is_auto_detected, status, created_at";
```

- [ ] **Step 2: Add owner guard to POST, PATCH, DELETE** — first lines of each handler:

```ts
  const denied = await requireOwner();
  if (denied) return denied;
```

(GET stays open — demo mode reads.)

- [ ] **Step 3: POST — persist gcal id without clobbering identity** (replace lines 81-96)

```ts
  const googleId = await writeToGoogleCalendar(
    body.title.trim(),
    body.start_time,
    body.end_time,
    body.description
  );
  if (googleId) {
    await db.from("events").update({ gcal_event_id: googleId }).eq("id", data.id);
    data.gcal_event_id = googleId;
  }
```

- [ ] **Step 4: PATCH — select the row BEFORE updating, resolve mapping via helper, shift end, no clobber**

First, right after the `updates` validation (after line 129 `if (Object.keys(updates).length === 0) ...`), fetch the pre-update row (the original start/end are needed to preserve the event's duration when it moves):

```ts
  const db = createServerClient();
  const { data: before } = await db
    .from("events")
    .select("start_time, end_time, gcal_event_id, source_external_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!before) {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }
```

(This replaces the existing `const db = createServerClient();` at line 131.) Then replace the gcal block (lines 143-169) with:

```ts
  const gid = eventGcalId(before);
  if (gid) {
    const newStart = "start_time" in updates ? (updates.start_time as string) : undefined;
    await updateGoogleCalendarEvent(gid, {
      title: "title" in updates ? (updates.title as string) : undefined,
      startTime: newStart,
      endTime:
        "end_time" in updates
          ? ((updates.end_time as string | null) ?? undefined)
          : newStart
            ? shiftEndForNewStart(before.start_time, before.end_time, newStart)
            : undefined,
      description:
        "description" in updates
          ? ((updates.description as string | null) ?? undefined)
          : undefined,
    });
  } else {
    const googleId = await writeToGoogleCalendar(
      data.title,
      data.start_time,
      data.end_time ?? undefined,
      data.description ?? undefined
    );
    if (googleId) {
      await db.from("events").update({ gcal_event_id: googleId }).eq("id", data.id);
    }
  }
```

- [ ] **Step 5: DELETE — resolve via helper** (replace lines 183-196)

```ts
  const { data: row } = await db
    .from("events")
    .select("source_external_id, gcal_event_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db.from("events").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const gid = row ? eventGcalId(row) : null;
  if (gid) {
    await deleteGoogleCalendarEvent(gid);
  }
```

- [ ] **Step 6: Verify + commit**

Run: `npm run lint`

```bash
git add src/app/api/events/route.ts
git commit -m "fix(api): owner guard on event mutations; gcal mapping via gcal_event_id"
```

---

### Task 9: Dashboard data — hide cancelled, enrich upcoming events

**Files:**
- Modify: `src/lib/dashboard.ts`

- [ ] **Step 1: Types** — extend `DashboardEvent`:

```ts
export type DashboardEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  source_platform: string | null;
  platform?: string | null;
  is_auto_detected?: boolean;
  source_url?: string | null;
};
```

- [ ] **Step 2: Queries** — add `.neq("status", "cancelled")` to the five event queries (upcoming, today, nextExam, assignmentsCount, assignmentEvents). Change the upcoming query select to include detail fields:

```ts
    db
      .from("events")
      .select(
        "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, is_auto_detected"
      )
      .gte("start_time", nowIso)
      .lte("start_time", in7Days)
      .neq("status", "cancelled")
      .in("event_type", ["exam", "quiz"])
      .order("start_time", { ascending: true })
      .limit(10),
```

Same enriched select for the `nextExamRes` query (it gets merged into `upcoming`).

- [ ] **Step 3: Map platform + source announcement URL for upcoming events**

After `platformById` (line 133), add:

```ts
  const AUTO_ID_RE =
    /^auto-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const annIdOf = (sid: unknown): string | null => {
    const m = typeof sid === "string" ? sid.match(AUTO_ID_RE) : null;
    return m ? m[1] : null;
  };

  const rawUpcoming = [...((upcomingRes.data ?? []) as any[])];
  const nextExamRow = (nextExamRes.data ?? null) as any;
  if (nextExamRow && !rawUpcoming.some((e) => e.id === nextExamRow.id)) {
    rawUpcoming.push(nextExamRow);
    rawUpcoming.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }

  const annIds = rawUpcoming
    .map((e) => annIdOf(e.source_external_id))
    .filter((x): x is string => x !== null);
  const annUrlById = new Map<string, string | null>();
  if (annIds.length > 0) {
    const { data: annRows } = await db
      .from("announcements")
      .select("id, source_url")
      .in("id", annIds);
    for (const a of (annRows ?? []) as any[]) annUrlById.set(a.id, a.source_url ?? null);
  }

  const upcoming: DashboardEvent[] = rawUpcoming.map((e) => {
    const { source_external_id, ...rest } = e;
    const annId = annIdOf(source_external_id);
    return {
      ...rest,
      platform: e.source_platform
        ? (platformById.get(e.source_platform)?.type ?? null)
        : null,
      source_url: annId ? (annUrlById.get(annId) ?? null) : null,
    };
  });
```

This REPLACES the old `upcoming`/`nextExam` merge block (lines 140-145) — delete it. The `return` keeps using `upcomingEvents: upcoming`.

- [ ] **Step 4: Verify + commit**

Run: `npm run lint`; `npm run dev` → dashboard renders, upcoming card populated.

```bash
git add src/lib/dashboard.ts
git commit -m "feat(dashboard): exclude cancelled events; enrich upcoming with platform and source link"
```

---

### Task 10: UI — clickable upcoming rows + event detail modal

**Files:**
- Create: `src/components/dashboard/event-detail-modal.tsx`
- Modify: `src/components/dashboard/upcoming-events.tsx`

- [ ] **Step 1: Create the detail modal**

```tsx
// src/components/dashboard/event-detail-modal.tsx
"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EventBadge } from "@/components/dashboard/event-badge";
import { PlatformPill } from "@/components/dashboard/platform-pill";
import type { DashboardEvent } from "@/lib/dashboard";

export function EventDetailModal({
  event,
  onOpenChange,
}: {
  event: DashboardEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!event) return null;
  const start = new Date(event.start_time);
  const end = event.end_time ? new Date(event.end_time) : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg !duration-0 data-open:animate-none data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EventBadge type={event.event_type} />
            <span className="min-w-0 truncate">{event.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div>
            <div className="font-medium">{format(start, "EEE, MMM d, yyyy 'at' p")}</div>
            <div className="text-xs text-primary">
              {formatDistanceToNow(start, { addSuffix: true })}
            </div>
          </div>

          {end && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Ends: </span>
              {format(end, "EEE, MMM d, yyyy 'at' p")}
            </div>
          )}

          {event.description && (
            <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {event.platform && <PlatformPill platform={event.platform} />}
            {event.is_auto_detected && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Auto-detected
              </span>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                View original announcement
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Make upcoming rows clickable** — replace `src/components/dashboard/upcoming-events.tsx` entirely:

```tsx
"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventBadge } from "@/components/dashboard/event-badge";
import { EventDetailModal } from "@/components/dashboard/event-detail-modal";
import type { DashboardEvent } from "@/lib/dashboard";

export function UpcomingEvents({
  events,
  className,
}: {
  events: DashboardEvent[];
  className?: string;
}) {
  const [selected, setSelected] = useState<DashboardEvent | null>(null);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Calendar03Icon} className="h-4 w-4 text-primary" />
          Upcoming exams &amp; quizzes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No exams or quizzes in the next 7 days. You&apos;re clear.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const start = new Date(event.start_time);
              return (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelected(event)}
                    className="flex w-full items-center justify-between gap-4 rounded text-left transition-colors hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <EventBadge type={event.event_type} />
                        <span className="truncate font-medium">{event.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(start, "EEE, MMM d · p")}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium text-primary">
                      {formatDistanceToNow(start, { addSuffix: true })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <EventDetailModal event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </Card>
  );
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint`; `npm run dev` → click a quiz row on the dashboard → modal shows description, platform pill, auto-detected badge, source link (for auto events).

```bash
git add src/components/dashboard/event-detail-modal.tsx src/components/dashboard/upcoming-events.tsx
git commit -m "feat(ui): clickable upcoming events with detail modal"
```

---

### Task 11: Calendar view — cancelled shown struck-through

**Files:**
- Modify: `src/components/calendar/calendar-view.tsx`

- [ ] **Step 1: Type** — add to `CalendarEvent` (line 28-39):

```ts
  status?: "confirmed" | "cancelled";
```

(Task 8 already added `status` to the API's `SELECT_COLUMNS`.)

- [ ] **Step 2: Strike through cancelled pills** — in the month-grid pill `className` (line 216-220), add the conditional:

```tsx
                            className={cn(
                              "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs",
                              PILL_CLASS[ev.event_type] ?? PILL_CLASS.other,
                              ev.status === "cancelled" && "line-through opacity-50",
                              canEdit && "cursor-pointer"
                            )}
```

- [ ] **Step 3: Hide cancelled from the "Upcoming" side list** — change the `upcoming` memo (line 108-111):

```ts
  const upcoming = useMemo(() => {
    const now = Date.now();
    return allEvents
      .filter((ev) => ev.status !== "cancelled" && new Date(ev.start_time).getTime() >= now)
      .slice(0, 10);
  }, [allEvents]);
```

- [ ] **Step 4: Verify + commit**

Run: `npm run lint`

```bash
git add src/components/calendar/calendar-view.tsx
git commit -m "feat(calendar): render cancelled events struck-through, hide from upcoming"
```

---

### Task 12: Security quick wins

**Files:**
- Modify: `src/app/api/resources/route.ts`, `src/app/api/settings/route.ts`, `src/app/api/labels/route.ts`
- Modify: `src/components/chat/markdown.tsx`
- Modify: `src/app/api/auth/google/callback/route.ts`, `src/app/api/auth/callback/route.ts`

- [ ] **Step 1: Owner guard on mutating routes**

In each of `resources/route.ts` (POST/PATCH/DELETE), `settings/route.ts` (POST), `labels/route.ts` (POST), add as the first lines of the handler:

```ts
  const denied = await requireOwner();
  if (denied) return denied;
```

with import `import { requireOwner } from "@/lib/auth";`. GET handlers stay open.

- [ ] **Step 2: Markdown link scheme allowlist** — in `src/components/chat/markdown.tsx`, add before `renderInline`:

```ts
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}
```

and change the link branch (lines 31-43):

```tsx
    } else if (match[7] !== undefined) {
      const href = safeHref(match[8]);
      if (href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            {match[7]}
          </a>
        );
      } else {
        nodes.push(<Fragment key={key}>{match[7]}</Fragment>);
      }
    }
```

- [ ] **Step 3: HttpOnly session cookie (server-set paths only)**

`src/app/api/auth/google/callback/route.ts` (line 75-79) and `src/app/api/auth/callback/route.ts` (line 13-17): add `httpOnly: true` to the cookie options object:

```ts
      {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        httpOnly: true,
      }
```

(Do NOT touch `src/lib/supabase/auth-client.ts` — its demo-mode cookie writes stay as-is.)

- [ ] **Step 4: Verify + commit**

Run: `npm run lint`. Manual: in demo mode (no login), `curl -X POST http://localhost:3000/api/resources -H 'content-type: application/json' -d '{"title":"x","url":"https://x.y"}'` → `403 {"error":"Demo mode is read-only"}`.

```bash
git add src/app/api/resources/route.ts src/app/api/settings/route.ts src/app/api/labels/route.ts src/components/chat/markdown.tsx src/app/api/auth/google/callback/route.ts src/app/api/auth/callback/route.ts
git commit -m "fix(security): owner guard on mutating routes, markdown href allowlist, httpOnly session cookie"
```

---

### Task 13: Verification, live migration, prod data cleanup

- [ ] **Step 1: Full local verification**

```bash
npm run lint
node --experimental-strip-types --test tests/*.test.ts
npm run build
```

All three must pass.

- [ ] **Step 2: Apply migration to the live Supabase project**

Use the `supabase-na` MCP `apply_migration` tool with name `event_status_and_gcal_id` and the exact SQL from Task 2. Verify with `list_tables`: `events` now has `status` and `gcal_event_id`.

- [ ] **Step 3: Prod data cleanup** (via `supabase-na` `execute_sql`)

```sql
-- Known-bad extraction: "Final Exam Script Review" scheduled Sept 1 from a
-- June 2 "view scripts today" announcement.
DELETE FROM events WHERE id = '7ea6a55b-4d4d-4252-9f92-650bb35e6463';

-- Past-dated auto-detected non-assignments (e.g. "Online Makeup Class" on
-- 2026-01-21 hallucinated from a July 6 announcement).
DELETE FROM events
WHERE is_auto_detected = true
  AND event_type <> 'assignment'
  AND start_time < now();

-- Allow the fixed pipeline to re-extract the makeup-class announcement with
-- the new date-anchored prompt.
DELETE FROM agent_actions WHERE source_id = '57a04e5e-752a-46d6-b282-7b209f06331a';
```

- [ ] **Step 4: End-to-end acceptance (manual, against dev server + live services)**

1. `POST /api/sync?force=1` → response has `synced` + `aiErrors: 0`; re-extracted makeup-class event lands on the correct July date (announced 2026-07-06, "Wednesday" → 2026-07-08 window), NOT January.
2. No event exists with `start_time < now()` and `event_type != 'assignment'` and `is_auto_detected = true` (SQL check).
3. Chat: "cancel quiz 2" → agent calls `cancel_event`; event vanishes from dashboard upcoming; calendar shows it struck-through; its Google Calendar copy is gone.
4. Chat: create event → appears in Google Calendar once; edit its time → the SAME gcal event moves; run `POST /api/sync?force=1` twice → no duplicates appear (`SELECT title, count(*) FROM events GROUP BY title HAVING count(*) > 1` is empty).
5. Dashboard: click a quiz row → detail modal shows description, platform pill, source-announcement link.
6. Post (or simulate) a Slack/Discord announcement "Quiz 2 has been postponed to <future date>" → after sync, existing Quiz 2 event moved, no new event created.

- [ ] **Step 5: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "chore: verification fixes for announcement CRUD reliability"
```

---

## Task → Spec traceability

| Spec § | Task |
|---|---|
| A schema | 2 |
| B date anchoring/gates | 1, 6 |
| C CRUD actions | 6 |
| D concierge tools | 7 |
| E export-only gcal (R1,R2,R3,R8) | 3, 4, 5, 6, 8 |
| F sync robustness (R4,R5) | 6 |
| G quiz details UI | 9, 10, 11 |
| H security | 8 (events guard), 12 |
| I data cleanup | 13 |
| R6 platform filter | 7 |
| R9 TBD-date crash | 1, 6 |

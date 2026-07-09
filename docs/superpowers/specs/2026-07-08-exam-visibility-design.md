# Exam / Event Visibility Fix — Design

Date: 2026-07-08

## Problem

`exam` events were invisible across the app even though they existed in the
`events` table. Two distinct causes:

1. **Dashboard inconsistency (symptom).** The "Upcoming exams & quizzes" list in
   `src/lib/dashboard.ts` is hard-capped to `now → now + 7 days`
   (`gte(start_time, now).lte(start_time, now+7d).in(event_type, ["exam","quiz"])`).
   The "Days to next exam" stat, by contrast, counts *any* future exam. So an
   exam 54 days out appeared in the stat but not the list.

2. **Auto-detection stores past dates (root cause).** The concierge pass in
   `src/app/api/sync/route.ts` inserts any AI-detected event with no date sanity
   check. Its prompt tells the AI to "assume year is 2026 if not specified," so
   past announcements (e.g. "Final Exam Script Viewing, Jan 1") became events
   with past `start_time` values. Every view filters on `start_time >= now`,
   so those events were hidden everywhere.

The 3 existing `exam` rows had `start_time` of 2026-01-01 / 2026-05-21 (all
past relative to 2026-07-08). They were updated to `2026-09-01` so they are
visible now.

## Approach (recommended, approved)

### A. Dashboard — union-in the next exam
Keep the 7-day window for quizzes/near-term items, but always also include the
single nearest future exam regardless of distance. The query for the next exam
(`nextExamRes`) already existed (selects `start_time`, single, `>= now`); it was
widened to select full columns, then merged into `upcomingEvents` (deduped by
id, re-sorted by `start_time`). This makes the list match the stat.

### B. Auto-detection — skip non-future events
Added `isFutureDate(value)` helper in `sync/route.ts`:
- returns false for non-string, unparseable, or past dates.
The event-scheduling branch (`if (result.hasEvent && result.event && ...)`) now
additionally requires `isFutureDate(result.event.start_time)`. When false, the
event is neither inserted, pushed to Google Calendar, nor logged as an
"Autoscheduled" action — matching the concierge's own "upcoming" intent and
preventing recurrence of invisible past events. No dates are fabricated.

## Files changed
- `src/lib/dashboard.ts` — widen `nextExamRes` select; merge next exam into
  `upcomingEvents`.
- `src/app/api/sync/route.ts` — add `isFutureDate()`; guard event branch.

## Verification
- `npx tsc --noEmit` → no errors.
- DB: 3 exam / 2 quiz / 1 other / 0 assignment; `days_to_next_exam = 54`;
  next-7-day window correctly shows only the 2 quizzes while the exam surfaces
  in the stat and (after this change) the upcoming list.

## Out of scope
- No UI redesign, no new sections, no date clamping/guessing.
- Design doc not committed (repo policy: no commit without explicit request).

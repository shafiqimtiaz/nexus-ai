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

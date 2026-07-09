-- 007_drop_gcal_event_id.sql
-- Removes events.gcal_event_id. It was never reliably populated: calendar-synced
-- rows already carry the Google id in source_external_id ("gcal:<id>"), and
-- concierge rows only set it when writeToGoogleCalendar succeeded. The concierge
-- now pushes to Google only on first creation, so the column is dead.

ALTER TABLE events
  DROP COLUMN IF EXISTS gcal_event_id;

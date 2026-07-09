-- The previous title-based dedup (events_auto_dedup_idx) was too strict: the
-- concierge's AI emits slightly different titles ("...Review" vs "...Viewing")
-- for the SAME underlying event, so duplicates slipped past it. The stable
-- signal is the event CONTENT, not the title.
--
-- Replace the index with a content-based key: the same (description, start_time,
-- event_type) for an auto-detected row is the same event. Empty/null
-- descriptions are excluded so distinct events without a description are never
-- wrongly merged.

DROP INDEX IF EXISTS events_auto_dedup_idx;

-- Clean up pre-existing content duplicates (keep the earliest row per group).
DELETE FROM events a
USING events b
WHERE a.id <> b.id
  AND a.is_auto_detected = true
  AND b.is_auto_detected = true
  AND a.description = b.description
  AND a.start_time = b.start_time
  AND a.event_type = b.event_type
  AND a.description IS NOT NULL
  AND a.description <> ''
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS events_auto_dedup_idx
  ON events (description, start_time, event_type)
  WHERE is_auto_detected = true
    AND description IS NOT NULL
    AND description <> '';

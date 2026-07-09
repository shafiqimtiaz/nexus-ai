-- 006_dedup_events.sql
-- Remove duplicate events created by the old concierge bug.
-- Keeps the earliest-created row per (title, start_time) group.

WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, start_time
      ORDER BY created_at ASC
    ) AS rn
  FROM events
  WHERE title IS NOT NULL
    AND start_time IS NOT NULL
)
DELETE FROM events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

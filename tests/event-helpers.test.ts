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

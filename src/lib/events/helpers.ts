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

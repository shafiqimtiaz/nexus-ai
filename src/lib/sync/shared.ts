import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type SyncResult = {
  type: string;
  announcements: number;
  events: number;
  skipped?: boolean;
  error?: string;
  authExpired?: boolean;
};

export function isAuthFailure(type: string, message: string): boolean {
  if (type === "discord") return /\((401|403)\)/.test(message);
  if (type === "slack")
    return /(invalid_auth|not_authed|account_inactive|token_revoked|token_expired)/.test(message);
  return false;
}

export interface PlatformRow {
  id: string;
  type: "google_classroom" | "discord" | "slack";
  external_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  last_synced_at: string | null;
}

export function parseChannelIds(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function deriveTitle(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 60) : null;
}

export function sanitizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[*_`#>~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["'"''\s]+|["'"''\s]+$/g, "")
    .trim();
  return cleaned ? cleaned.slice(0, 80) : null;
}

export function sanitizeSummary(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^["'"''\s]+|["'"''\s]+$/g, "")
    .trim();
  return cleaned ? cleaned.slice(0, 500) : null;
}

export function classifyEventType(title: string | null): "exam" | "quiz" | "assignment" | "other" {
  const t = (title ?? "").toLowerCase();
  if (/\b(exam|midterm|final)\b/.test(t)) return "exam";
  if (/\bquiz\b/.test(t)) return "quiz";
  if (/\b(assignment|homework|project)\b/.test(t)) return "assignment";
  return "other";
}

export function sanitizeContent(raw: string): string {
  return raw.replace(/<@[!&]?\d+>/g, "").trim();
}

export async function upsertAnnouncements(
  db: ReturnType<typeof createServerClient>,
  rows: Array<{
    platform_id: string;
    external_id: string;
    title: string | null;
    content: string;
    author?: string | null;
    source_url: string;
    announced_at: string | null;
  }>
): Promise<number> {
  if (rows.length === 0) return 0;

  const platformId = rows[0].platform_id;
  const { data: existingRows } = await db
    .from("announcements")
    .select("id, external_id, title, ai_summary")
    .eq("platform_id", platformId);
  const existingByExternal = new Map<
    string,
    { id: string; title: string | null; ai_summary: string | null }
  >((existingRows ?? []).map((r) => [r.external_id, r]));

  const toInsert: typeof rows = [];
  const toUpdate: ({ id: string } & Record<string, unknown>)[] = [];
  for (const row of rows) {
    const existing = existingByExternal.get(row.external_id);
    if (!existing) {
      toInsert.push(row);
    } else {
      toUpdate.push({
        id: existing.id,
        content: row.content,
        author: row.author ?? null,
        source_url: row.source_url,
        announced_at: row.announced_at,
        title: existing.title ?? row.title,
        ai_summary: existing.ai_summary,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await db.from("announcements").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  for (const row of toUpdate) {
    const { error } = await db.from("announcements").update(row).eq("id", row.id);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

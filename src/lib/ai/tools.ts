import "server-only";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/auth";
import {
  writeToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  eventGcalId,
} from "@/lib/auth/google-oauth";
import { shiftEndForNewStart } from "@/lib/events/helpers";

const EVENT_TYPES = ["exam", "quiz", "assignment", "study_block", "other"] as const;

const EVENT_COLUMNS =
  "id, title, description, event_type, start_time, end_time, is_auto_detected, status";
const RESOURCE_COLUMNS = "id, title, url, description, is_pinned";

function fail(context: string, message: string) {
  return { error: `${context}: ${message}` };
}

// Mutating tools are owner-only: demo sessions (no auth) get a read-only refusal.
async function denyIfDemo(context: string): Promise<{ error: string } | null> {
  return (await getRole()) === "owner" ? null : fail(context, "demo mode is read-only");
}

async function getPlatformTypeMap(
  db: ReturnType<typeof createServerClient>
): Promise<Map<string, string>> {
  const { data } = await db.from("platforms").select("id, type");
  return new Map((data ?? []).map((p: any) => [p.id, p.type]));
}

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

export function getLocalTools(): Record<string, Tool> {
  return {
    get_upcoming_events: tool({
      description:
        "List upcoming events (exams, quizzes, assignments, study blocks) that start within the next N days, soonest first. Each event includes the `platform` it was detected/synced from (e.g. 'google_classroom', 'discord') or null if created locally. Use this to answer 'what's due', 'what's coming up', or 'what exams do I have', and to tell the student which platform an item came from.",
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("How many days ahead to look. Defaults to 7."),
      }),
      execute: async ({ days }) => {
        const db = createServerClient();
        const windowDays = days ?? 7;
        const now = new Date();
        const until = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

        const { data, error } = await db
          .from("events")
          .select(`${EVENT_COLUMNS}, source_platform`)
          .gte("start_time", now.toISOString())
          .lte("start_time", until.toISOString())
          .neq("status", "cancelled")
          .order("start_time", { ascending: true });

        if (error) return fail("get_upcoming_events", error.message);

        const platformById = await getPlatformTypeMap(db);
        const events = (data ?? []).map((e: any) => {
          const { source_platform, ...rest } = e;
          return {
            ...rest,
            platform: source_platform ? (platformById.get(source_platform) ?? null) : null,
          };
        });

        return { count: events.length, events };
      },
    }),

    create_event: tool({
      description:
        "Create a single calendar event (exam, quiz, assignment, study block, or other). Use when the student asks to add or schedule something.",
      inputSchema: z.object({
        title: z.string().describe("Short title of the event."),
        event_type: z.enum(EVENT_TYPES),
        start_time: z.string().describe("Start time as an ISO 8601 datetime."),
        end_time: z.string().optional().describe("Optional end time as an ISO 8601 datetime."),
        description: z.string().optional(),
      }),
      execute: async ({ title, event_type, start_time, end_time, description }) => {
        const denied = await denyIfDemo("create_event");
        if (denied) return denied;
        const db = createServerClient();
        const { data, error } = await db
          .from("events")
          .insert({
            title,
            event_type,
            start_time,
            end_time: end_time ?? null,
            description: description ?? null,
            is_auto_detected: false,
          })
          .select(EVENT_COLUMNS)
          .single();

        if (error) return fail("create_event", error.message);

        await pushEventToGoogle(db, data.id, title, start_time, end_time, description);

        return { created: data };
      },
    }),

    edit_event: tool({
      description:
        "Update an existing event by id. Only the fields you pass are changed. Get the id from get_upcoming_events first.",
      inputSchema: z.object({
        id: z.string().describe("The event id to update."),
        title: z.string().optional(),
        event_type: z.enum(EVENT_TYPES).optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        description: z.string().optional(),
      }),
      execute: async ({ id, ...fields }) => {
        const denied = await denyIfDemo("edit_event");
        if (denied) return denied;
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
              (newStart
                ? shiftEndForNewStart(before.start_time, before.end_time, newStart)
                : undefined),
            description: patch.description as string | undefined,
          });
        } else {
          await pushEventToGoogle(
            db,
            id,
            data.title,
            data.start_time,
            data.end_time,
            data.description
          );
        }

        return { updated: data };
      },
    }),

    cancel_event: tool({
      description:
        "Cancel an event by id — use when the student says a quiz/exam/class was cancelled or asks to remove an event. The event is kept as status 'cancelled' (reversible) and its Google Calendar copy is deleted. Get the id from get_upcoming_events first.",
      inputSchema: z.object({
        id: z.string().describe("The event id to cancel."),
      }),
      execute: async ({ id }) => {
        const denied = await denyIfDemo("cancel_event");
        if (denied) return denied;
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

    search_resources: tool({
      description:
        "Search saved resources (links, notes, files) by a keyword matched case-insensitively against title and description.",
      inputSchema: z.object({
        query: z.string().describe("Keyword to search for."),
      }),
      execute: async ({ query }) => {
        const db = createServerClient();
        const cleanQ = query.replace(/[()\\.,:"]/g, "");
        const pattern = `%${cleanQ}%`;
        let reqQuery = db.from("resources").select(RESOURCE_COLUMNS);
        if (cleanQ) {
          reqQuery = reqQuery.or(`title.ilike.${pattern},description.ilike.${pattern}`);
        }
        const { data, error } = await reqQuery.order("is_pinned", { ascending: false });

        if (error) return fail("search_resources", error.message);
        return { count: data?.length ?? 0, resources: data ?? [] };
      },
    }),

    add_resource: tool({
      description:
        "Save a new resource (a link the student wants to keep). Use when they share a URL or ask to bookmark something.",
      inputSchema: z.object({
        title: z.string(),
        url: z.string().describe("The resource URL."),
        description: z.string().optional(),
      }),
      execute: async ({ title, url, description }) => {
        const denied = await denyIfDemo("add_resource");
        if (denied) return denied;
        const db = createServerClient();
        const { data, error } = await db
          .from("resources")
          .insert({ title, url, description: description ?? null })
          .select(RESOURCE_COLUMNS)
          .single();

        if (error) return fail("add_resource", error.message);
        return { created: data };
      },
    }),

    edit_resource: tool({
      description:
        "Update an existing resource by id. Only the fields you pass are changed. Get the id from search_resources first.",
      inputSchema: z.object({
        id: z.string().describe("The resource id to update."),
        title: z.string().optional(),
        url: z.string().optional().describe("The resource URL."),
        description: z.string().optional(),
      }),
      execute: async ({ id, ...fields }) => {
        const denied = await denyIfDemo("edit_resource");
        if (denied) return denied;
        const db = createServerClient();
        const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
        if (Object.keys(patch).length === 0) {
          return fail("edit_resource", "no fields provided to update");
        }

        const { data, error } = await db
          .from("resources")
          .update(patch)
          .eq("id", id)
          .select(RESOURCE_COLUMNS)
          .single();

        if (error) return fail("edit_resource", error.message);
        return { updated: data };
      },
    }),

    generate_study_plan: tool({
      description:
        "Create a study plan for an exam by generating several 'study_block' events evenly spaced between now and the exam date. Use when the student asks you to plan or schedule studying for an exam.",
      inputSchema: z.object({
        exam_title: z.string().describe("The exam these study blocks are for."),
        exam_date: z.string().describe("The exam date/time as ISO 8601."),
        sessions: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Number of study sessions to create. Defaults to 3."),
      }),
      execute: async ({ exam_title, exam_date, sessions }) => {
        const denied = await denyIfDemo("generate_study_plan");
        if (denied) return denied;
        const db = createServerClient();
        const count = sessions ?? 3;
        const now = Date.now();
        const examMs = new Date(exam_date).getTime();

        if (Number.isNaN(examMs)) return fail("generate_study_plan", "invalid exam_date");
        if (examMs <= now) {
          return fail("generate_study_plan", "exam_date must be in the future");
        }

        const interval = examMs - now;
        const rows = Array.from({ length: count }, (_, i) => {
          const at = new Date(now + (interval * (i + 1)) / (count + 1));
          const end = new Date(at.getTime() + 60 * 60 * 1000);
          return {
            title: `Study: ${exam_title} (session ${i + 1}/${count})`,
            event_type: "study_block" as const,
            start_time: at.toISOString(),
            end_time: end.toISOString(),
            description: `Auto-generated study session for ${exam_title}.`,
            is_auto_detected: false,
          };
        });

        const { data, error } = await db.from("events").insert(rows).select(EVENT_COLUMNS);

        if (error) return fail("generate_study_plan", error.message);

        for (const created of data ?? []) {
          await pushEventToGoogle(
            db,
            created.id,
            created.title,
            created.start_time,
            created.end_time,
            created.description
          );
        }

        return { created_count: data?.length ?? 0, study_blocks: data ?? [] };
      },
    }),

    set_reminder: tool({
      description:
        "Set a reminder at a specific time. Creates a study_block event titled as the reminder.",
      inputSchema: z.object({
        title: z.string().describe("What to be reminded about."),
        remind_at: z.string().describe("When to remind, as ISO 8601."),
      }),
      execute: async ({ title, remind_at }) => {
        const denied = await denyIfDemo("set_reminder");
        if (denied) return denied;
        const db = createServerClient();
        const { data, error } = await db
          .from("events")
          .insert({
            title: `Reminder: ${title}`,
            event_type: "study_block",
            start_time: remind_at,
            is_auto_detected: false,
          })
          .select(EVENT_COLUMNS)
          .single();

        if (error) return fail("set_reminder", error.message);

        await pushEventToGoogle(db, data.id, `Reminder: ${title}`, remind_at);

        return { created: data };
      },
    }),

    summarize_announcements: tool({
      description:
        "Fetch recent announcements from connected platforms (from the local cache). Each announcement includes the `platform` it came from (e.g. 'google_classroom', 'discord'). Returns their text so YOU can summarize it in your reply. Use when the student asks what's new or to summarize announcements, and mention which platform each update came from when relevant.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Max announcements to fetch. Defaults to 10."),
        platform: z
          .string()
          .optional()
          .describe(
            "Optional platform type to filter by (e.g. 'google_classroom', 'discord', 'slack'). Omit to fetch from all platforms."
          ),
      }),
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
    }),

    online_search: tool({
      description:
        "Search the web for up-to-date information, news, programming documentation, or academic answers that are not in the local database. Use when the student asks about general knowledge, current events, or coding concepts.",
      inputSchema: z.object({
        query: z.string().describe("The search query to look up on the web."),
      }),
      execute: async ({ query }) => {
        const results = await performWebSearch(query);
        return { count: results.length, results };
      },
    }),
  };
}

async function performWebSearch(query: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      }
    );
    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed with status ${response.status}`);
    }
    const html = await response.text();

    const results: { title: string; url: string; snippet: string }[] = [];
    const titleMatches = [
      ...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
    ];
    const snippetMatches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];

    const count = Math.min(titleMatches.length, snippetMatches.length, 5);
    for (let i = 0; i < count; i++) {
      const titleMatch = titleMatches[i];
      const snippetMatch = snippetMatches[i];

      let rawUrl = titleMatch[1];
      let title = titleMatch[2].replace(/<[^>]*>/g, "").trim();
      let snippet = snippetMatch[1].replace(/<[^>]*>/g, "").trim();

      let cleanUrl = rawUrl;
      if (rawUrl.includes("uddg=")) {
        const uddgIndex = rawUrl.indexOf("uddg=");
        const encodedUrl = rawUrl.substring(uddgIndex + 5).split("&")[0];
        cleanUrl = decodeURIComponent(encodedUrl);
      } else if (rawUrl.startsWith("//")) {
        cleanUrl = "https:" + rawUrl;
      }

      results.push({
        title,
        url: cleanUrl,
        snippet,
      });
    }

    return results;
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

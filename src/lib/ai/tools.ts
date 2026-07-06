import "server-only";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

// Local (DB-backed) AI SDK tools for the Nexus agent. Every tool uses the
// service-role Supabase client and returns compact, JSON-serializable data so
// the model (and the tool-call UI) stays readable. Descriptions are written for
// the LLM: they say what the tool does and when to reach for it.

const EVENT_TYPES = [
  "exam",
  "quiz",
  "assignment",
  "study_block",
  "other",
] as const;

// Columns worth handing back to the model. Token columns / internal noise stay out.
const EVENT_COLUMNS =
  "id, title, description, event_type, start_time, end_time, is_auto_detected";
const RESOURCE_COLUMNS = "id, title, url, description, is_pinned";

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

export function getLocalTools(): Record<string, Tool> {
  return {
    get_upcoming_events: tool({
      description:
        "List upcoming events (exams, quizzes, assignments, study blocks) that start within the next N days, soonest first. Use this to answer 'what's due', 'what's coming up', or 'what exams do I have'.",
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
          .select(EVENT_COLUMNS)
          .gte("start_time", now.toISOString())
          .lte("start_time", until.toISOString())
          .order("start_time", { ascending: true });

        if (error) fail("get_upcoming_events", error.message);
        return { count: data?.length ?? 0, events: data ?? [] };
      },
    }),

    create_event: tool({
      description:
        "Create a single calendar event (exam, quiz, assignment, study block, or other). Use when the student asks to add or schedule something.",
      inputSchema: z.object({
        title: z.string().describe("Short title of the event."),
        event_type: z.enum(EVENT_TYPES),
        start_time: z.string().describe("Start time as an ISO 8601 datetime."),
        end_time: z
          .string()
          .optional()
          .describe("Optional end time as an ISO 8601 datetime."),
        description: z.string().optional(),
      }),
      execute: async ({ title, event_type, start_time, end_time, description }) => {
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

        if (error) fail("create_event", error.message);
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
        const db = createServerClient();
        const patch = Object.fromEntries(
          Object.entries(fields).filter(([, v]) => v !== undefined)
        );
        if (Object.keys(patch).length === 0) {
          fail("edit_event", "no fields provided to update");
        }

        const { data, error } = await db
          .from("events")
          .update(patch)
          .eq("id", id)
          .select(EVENT_COLUMNS)
          .single();

        if (error) fail("edit_event", error.message);
        return { updated: data };
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

        if (error) fail("search_resources", error.message);
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
        const db = createServerClient();
        const { data, error } = await db
          .from("resources")
          .insert({ title, url, description: description ?? null })
          .select(RESOURCE_COLUMNS)
          .single();

        if (error) fail("add_resource", error.message);
        return { created: data };
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
        const db = createServerClient();
        const count = sessions ?? 3;
        const now = Date.now();
        const examMs = new Date(exam_date).getTime();

        if (Number.isNaN(examMs)) fail("generate_study_plan", "invalid exam_date");
        if (examMs <= now) {
          fail("generate_study_plan", "exam_date must be in the future");
        }

        // Even spacing: place sessions at fractions of the interval before the
        // exam, e.g. for 3 sessions at 1/4, 2/4, 3/4 of the way to the exam.
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

        const { data, error } = await db
          .from("events")
          .insert(rows)
          .select(EVENT_COLUMNS);

        if (error) fail("generate_study_plan", error.message);
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

        if (error) fail("set_reminder", error.message);
        return { created: data };
      },
    }),

    summarize_announcements: tool({
      description:
        "Fetch recent announcements from connected platforms (from the local cache). Returns their text so YOU can summarize it in your reply. Use when the student asks what's new or to summarize announcements.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Max announcements to fetch. Defaults to 10."),
      }),
      execute: async ({ limit }) => {
        const db = createServerClient();
        const { data, error } = await db
          .from("announcements")
          .select("id, title, content, author, source_url, announced_at")
          .order("announced_at", { ascending: false, nullsFirst: false })
          .limit(limit ?? 10);

        if (error) fail("summarize_announcements", error.message);
        return { count: data?.length ?? 0, announcements: data ?? [] };
      },
    }),
  };
}

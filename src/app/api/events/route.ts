import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import type { EventType } from "@/lib/dashboard";

// Full event row exposed to the calendar. Nothing sensitive lives on the events
// table, so every column is safe to return.
const SELECT_COLUMNS =
  "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, is_auto_detected, created_at";

const EVENT_TYPES: readonly EventType[] = [
  "exam",
  "quiz",
  "assignment",
  "study_block",
  "other",
];

function isEventType(value: unknown): value is EventType {
  return (
    typeof value === "string" &&
    (EVENT_TYPES as readonly string[]).includes(value)
  );
}

// GET /api/events — both roles. With ?from=ISO&to=ISO returns events whose
// start_time falls in that window (the visible month grid). Without a range,
// returns recent + upcoming events with a sane cap for the "Upcoming" list.
export async function GET(request: NextRequest) {
  const db = createServerClient();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  let query = db
    .from("events")
    .select(SELECT_COLUMNS)
    .order("start_time", { ascending: true });

  if (from && to) {
    query = query.gte("start_time", from).lte("start_time", to);
  } else {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    query = query.gte("start_time", since.toISOString()).limit(200);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ events: data ?? [] });
}

// POST /api/events — owner only. Creates a manual event.
export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    !isEventType(body.event_type) ||
    typeof body.start_time !== "string"
  ) {
    return Response.json(
      { error: "title, event_type, and start_time are required." },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("events")
    .insert({
      title: body.title.trim(),
      event_type: body.event_type,
      start_time: body.start_time,
      end_time: body.end_time ?? null,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      is_auto_detected: false,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ event: data });
}

// PATCH /api/events — owner only. Updates the given fields on one event by id.
export async function PATCH(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return Response.json({ error: "An event id is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (isEventType(body.event_type)) {
    updates.event_type = body.event_type;
  }
  if (typeof body.start_time === "string") {
    updates.start_time = body.start_time;
  }
  if ("end_time" in body) {
    updates.end_time = body.end_time ?? null;
  }
  if ("description" in body) {
    updates.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: "No valid fields to update." },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("events")
    .update(updates)
    .eq("id", body.id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ event: data });
}

// DELETE /api/events — owner only. Accepts ?id= or a JSON body { id }.
export async function DELETE(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = body?.id ?? request.nextUrl.searchParams.get("id");
  if (typeof id !== "string" || !id) {
    return Response.json({ error: "An event id is required." }, { status: 400 });
  }

  const db = createServerClient();
  const { error } = await db.from("events").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

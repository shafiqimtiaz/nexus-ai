import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { EventType } from "@/lib/dashboard";
import { requireOwner } from "@/lib/auth";
import { shiftEndForNewStart } from "@/lib/events/helpers";
import {
  writeToGoogleCalendar,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  eventGcalId,
} from "@/lib/auth/google-oauth";

const SELECT_COLUMNS =
  "id, title, description, event_type, start_time, end_time, source_platform, source_external_id, gcal_event_id, is_auto_detected, status, created_at";

const EVENT_TYPES: readonly EventType[] = ["exam", "quiz", "assignment", "study_block", "other"];

function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const db = createServerClient();
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  let query = db.from("events").select(SELECT_COLUMNS).order("start_time", { ascending: true });

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

  const googleId = await writeToGoogleCalendar(
    body.title.trim(),
    body.start_time,
    body.end_time,
    body.description
  );
  if (googleId) {
    await db.from("events").update({ gcal_event_id: googleId }).eq("id", data.id);
    data.gcal_event_id = googleId;
  }

  return Response.json({ event: data });
}

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
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const db = createServerClient();
  const { data: before } = await db
    .from("events")
    .select("start_time, end_time, gcal_event_id, source_external_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!before) {
    return Response.json({ error: "Event not found." }, { status: 404 });
  }

  const { data, error } = await db
    .from("events")
    .update(updates)
    .eq("id", body.id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const gid = eventGcalId(before);
  if (gid) {
    const newStart = "start_time" in updates ? (updates.start_time as string) : undefined;
    await updateGoogleCalendarEvent(gid, {
      title: "title" in updates ? (updates.title as string) : undefined,
      startTime: newStart,
      endTime:
        "end_time" in updates
          ? ((updates.end_time as string | null) ?? undefined)
          : newStart
            ? shiftEndForNewStart(before.start_time, before.end_time, newStart)
            : undefined,
      description:
        "description" in updates
          ? ((updates.description as string | null) ?? undefined)
          : undefined,
    });
  } else {
    const googleId = await writeToGoogleCalendar(
      data.title,
      data.start_time,
      data.end_time ?? undefined,
      data.description ?? undefined
    );
    if (googleId) {
      await db.from("events").update({ gcal_event_id: googleId }).eq("id", data.id);
    }
  }

  return Response.json({ event: data });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = body?.id ?? request.nextUrl.searchParams.get("id");
  if (typeof id !== "string" || !id) {
    return Response.json({ error: "An event id is required." }, { status: 400 });
  }

  const db = createServerClient();

  const { data: row } = await db
    .from("events")
    .select("source_external_id, gcal_event_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await db.from("events").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const gid = row ? eventGcalId(row) : null;
  if (gid) {
    await deleteGoogleCalendarEvent(gid);
  }

  return Response.json({ ok: true });
}

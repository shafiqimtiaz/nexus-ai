import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";

// Nested join: each resource carries its labels through the resource_labels
// junction table. `labels:resource_labels(label:labels(...))` aliases the
// junction rows to `labels`, each wrapping the joined label object.
const SELECT =
  "id, title, url, description, is_pinned, source_platform, created_at, labels:resource_labels(label:labels(id, name, color))";

type RawLabel = { id: string; name: string; color: string | null };

type RawRow = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  is_pinned: boolean;
  source_platform: string | null;
  created_at: string;
  labels: { label: RawLabel | null }[] | null;
};

export type ResourceWithLabels = Omit<RawRow, "labels"> & {
  labels: RawLabel[];
};

// Collapse the nested `[{ label: {...} }]` shape into a flat `labels: [{...}]`
// array, dropping any null joins defensively.
function flatten(rows: RawRow[]): ResourceWithLabels[] {
  return rows.map((row) => {
    const { labels, ...rest } = row;
    return {
      ...rest,
      labels: (labels ?? [])
        .map((rl) => rl.label)
        .filter((l): l is RawLabel => l !== null),
    };
  });
}

async function fetchOne(
  db: SupabaseClient,
  id: string
): Promise<ResourceWithLabels | null> {
  const { data } = await db.from("resources").select(SELECT).eq("id", id).single();
  return data ? flatten([data as unknown as RawRow])[0] : null;
}

// GET /api/resources — both roles. Returns every resource with its labels.
// ?q= does a case-insensitive match on title/description; ?label= restricts to
// resources carrying that label id (the full label list is still returned).
export async function GET(request: NextRequest) {
  const db = createServerClient();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const label = request.nextUrl.searchParams.get("label");

  let query = db
    .from("resources")
    .select(SELECT)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (q) {
    // Sanitize to prevent PostgREST query parsing errors (e.g. if query contains commas/parens)
    const cleanQ = q.replace(/[()\\.,:"]/g, "");
    if (cleanQ) {
      const term = `%${cleanQ}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }
  }

  if (label) {
    const { data: links, error: linkErr } = await db
      .from("resource_labels")
      .select("resource_id")
      .eq("label_id", label);
    if (linkErr) {
      return Response.json({ error: linkErr.message }, { status: 500 });
    }
    const ids = (links ?? []).map((l) => l.resource_id as string);
    if (ids.length === 0) {
      return Response.json({ resources: [] });
    }
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ resources: flatten((data ?? []) as unknown as RawRow[]) });
}

// POST /api/resources — owner only. Inserts the resource then its label links.
export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    typeof body.url !== "string" ||
    !body.url.trim()
  ) {
    return Response.json(
      { error: "title and url are required." },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { data: created, error } = await db
    .from("resources")
    .insert({
      title: body.title.trim(),
      url: body.url.trim(),
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      is_pinned: typeof body.is_pinned === "boolean" ? body.is_pinned : false,
    })
    .select("id")
    .single();

  if (error || !created) {
    return Response.json(
      { error: error?.message ?? "Could not create resource." },
      { status: 500 }
    );
  }

  const labelIds = Array.isArray(body.labelIds)
    ? body.labelIds.filter((x: unknown): x is string => typeof x === "string")
    : [];
  if (labelIds.length > 0) {
    const { error: linkErr } = await db
      .from("resource_labels")
      .insert(
        labelIds.map((label_id: string) => ({
          resource_id: created.id,
          label_id,
        }))
      );
    if (linkErr) {
      return Response.json({ error: linkErr.message }, { status: 500 });
    }
  }

  return Response.json({ resource: await fetchOne(db, created.id as string) });
}

// PATCH /api/resources — owner only. Updates given fields; when labelIds is
// present, replaces the whole label set. Also supports a bare { id, is_pinned }
// pin toggle (which feeds the dashboard's pinned list).
export async function PATCH(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return Response.json(
      { error: "A resource id is required." },
      { status: 400 }
    );
  }

  const db = createServerClient();

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) {
    updates.title = body.title.trim();
  }
  if (typeof body.url === "string" && body.url.trim()) {
    updates.url = body.url.trim();
  }
  if ("description" in body) {
    updates.description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
  }
  if (typeof body.is_pinned === "boolean") {
    updates.is_pinned = body.is_pinned;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await db
      .from("resources")
      .update(updates)
      .eq("id", body.id);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.labelIds)) {
    const labelIds = body.labelIds.filter(
      (x: unknown): x is string => typeof x === "string"
    );
    const { error: delErr } = await db
      .from("resource_labels")
      .delete()
      .eq("resource_id", body.id);
    if (delErr) {
      return Response.json({ error: delErr.message }, { status: 500 });
    }
    if (labelIds.length > 0) {
      const { error: insErr } = await db
        .from("resource_labels")
        .insert(
          labelIds.map((label_id: string) => ({
            resource_id: body.id,
            label_id,
          }))
        );
      if (insErr) {
        return Response.json({ error: insErr.message }, { status: 500 });
      }
    }
  }

  return Response.json({ resource: await fetchOne(db, body.id) });
}

// DELETE /api/resources — owner only. Accepts ?id= or { id }. Label links are
// removed by the ON DELETE CASCADE on resource_labels.
export async function DELETE(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const id = body?.id ?? request.nextUrl.searchParams.get("id");
  if (typeof id !== "string" || !id) {
    return Response.json(
      { error: "A resource id is required." },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { error } = await db.from("resources").delete().eq("id", id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";

const SELECT = "id, name, color";

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db.from("labels").select(SELECT).order("name", { ascending: true });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ labels: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "A label name is required." }, { status: 400 });
  }

  const name = body.name.trim();
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : null;

  const db = createServerClient();
  const { data, error } = await db.from("labels").insert({ name, color }).select(SELECT).single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await db.from("labels").select(SELECT).eq("name", name).single();
      if (existing) {
        return Response.json({ label: existing });
      }
      return Response.json({ error: "Label already exists." }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ label: data });
}

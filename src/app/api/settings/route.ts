import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { BASE_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { requireOwner } from "@/lib/auth";

const AI_RULES_KEY = "ai_rules";

export async function GET() {
  const db = createServerClient();
  const { data } = await db
    .from("app_settings")
    .select("key, value")
    .eq("key", AI_RULES_KEY)
    .maybeSingle();

  return Response.json({
    aiRules: data?.value ?? "",
    basePrompt: BASE_SYSTEM_PROMPT,
  });
}

// select-then-update/insert instead of upsert for mock DB compatibility
export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const value = typeof body?.aiRules === "string" ? body.aiRules : "";

  const db = createServerClient();
  const { data: existing } = await db
    .from("app_settings")
    .select("id")
    .eq("key", AI_RULES_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("app_settings").update({ value }).eq("key", AI_RULES_KEY);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await db.from("app_settings").insert({ key: AI_RULES_KEY, value });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ aiRules: value });
}

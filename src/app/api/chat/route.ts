import { NextRequest } from "next/server";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { google, createGoogle } from "@ai-sdk/google";
import { requireOwner } from "@/lib/auth";
import { getLocalTools } from "@/lib/ai/tools";
import { getClassroomTools } from "@/lib/ai/mcp-client";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createServerClient } from "@/lib/supabase/server";

// The chat agent. Owner-only: it mutates the DB (creates/edits events, saves
// resources) and burns LLM tokens, so demo users are rejected before any model
// call. Multi-step (stopWhen: stepCountIs(8)) so the model can call tools and
// then answer in the same turn. Streams back the AI SDK UI message protocol.

const ALLOWED_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
];

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const messages = body?.messages as ModelMessage[] | undefined;
  const requestedModel = body?.model as string | undefined;

  const modelName =
    requestedModel && ALLOWED_MODELS.includes(requestedModel)
      ? requestedModel
      : "gemini-flash-lite-latest";

  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const tools = { ...getLocalTools(), ...(await getClassroomTools()) };

  // Load custom Gemini API key from database if configured, fallback to environment key.
  const db = createServerClient();
  const [geminiRes, rulesRes] = await Promise.all([
    db.from("platforms").select("access_token, is_connected").eq("type", "gemini").maybeSingle(),
    db.from("app_settings").select("value").eq("key", "ai_rules").maybeSingle(),
  ]);
  const geminiPlatform = geminiRes.data;
  const customRules = rulesRes.data?.value as string | undefined;

  const apiKey =
    geminiPlatform?.is_connected && geminiPlatform?.access_token
      ? geminiPlatform.access_token
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  const googleProvider = createGoogle({
    apiKey,
  });

  const result = streamText({
    model: googleProvider(modelName),
    system: buildSystemPrompt(customRules),
    messages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}

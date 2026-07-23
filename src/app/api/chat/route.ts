import { NextRequest } from "next/server";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { google, createGoogle } from "@ai-sdk/google";
import { getRole } from "@/lib/auth";
import { getLocalTools } from "@/lib/ai/tools";
import { getClassroomTools } from "@/lib/ai/mcp-client";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
];

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

export async function POST(request: NextRequest) {
  const role = await getRole();
  const demoKey = request.headers.get("x-gemini-key")?.trim() || undefined;

  if (role !== "owner" && !demoKey) {
    return Response.json(
      { error: "Add your own Gemini API key to test the agent in demo mode." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const messages = body?.messages as ModelMessage[] | undefined;
  const requestedModel = body?.model as string | undefined;

  const modelName =
    requestedModel && ALLOWED_MODELS.includes(requestedModel)
      ? requestedModel
      : "gemini-flash-latest";

  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const tools = { ...getLocalTools(), ...(await getClassroomTools()) };

  const db = createServerClient();
  const [geminiRes, rulesRes] = await Promise.all([
    db.from("platforms").select("access_token, is_connected").eq("type", "gemini").maybeSingle(),
    db.from("app_settings").select("value").eq("key", "ai_rules").maybeSingle(),
  ]);
  const geminiPlatform = geminiRes.data;
  const customRules = rulesRes.data?.value as string | undefined;

  const apiKey =
    demoKey ??
    (geminiPlatform?.is_connected && geminiPlatform?.access_token
      ? geminiPlatform.access_token
      : process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);

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

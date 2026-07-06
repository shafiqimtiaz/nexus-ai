import { NextRequest } from "next/server";
import { streamText, stepCountIs, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { requireOwner } from "@/lib/auth";
import { getLocalTools } from "@/lib/ai/tools";
import { getClassroomTools } from "@/lib/ai/mcp-client";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

// The chat agent. Owner-only: it mutates the DB (creates/edits events, saves
// resources) and burns LLM tokens, so demo users are rejected before any model
// call. Multi-step (stopWhen: stepCountIs(8)) so the model can call tools and
// then answer in the same turn. Streams back the AI SDK UI message protocol.

// Single model constant — swap here to change the model everywhere.
const MODEL = "gemini-2.5-flash";

export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const messages = body?.messages as ModelMessage[] | undefined;

  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }

  const tools = { ...getLocalTools(), ...(await getClassroomTools()) };

  const result = streamText({
    model: google(MODEL),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}

import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";

// Columns safe to expose to the browser. Token columns are deliberately omitted
// so access_token / refresh_token never leave the server.
const SAFE_COLUMNS =
  "id, type, name, external_id, is_connected, last_synced_at";

const PLATFORM_TYPES = ["google_classroom", "discord"] as const;
type PlatformType = (typeof PLATFORM_TYPES)[number];

const DISCORD_API = "https://discord.com/api/v10";

function isPlatformType(value: unknown): value is PlatformType {
  return (
    typeof value === "string" &&
    (PLATFORM_TYPES as readonly string[]).includes(value)
  );
}

export async function GET() {
  const db = createServerClient();
  const { data, error } = await db
    .from("platforms")
    .select(SAFE_COLUMNS)
    .order("type", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ platforms: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || !isPlatformType(body.type)) {
    return Response.json(
      { error: "A valid platform type is required." },
      { status: 400 }
    );
  }

  const type: PlatformType = body.type;
  const externalId: string | undefined = body.external_id ?? undefined;
  const accessToken: string | undefined = body.access_token ?? undefined;
  let name: string | undefined = body.name ?? undefined;

  // Discord connect flow: validate the bot token against the channel before
  // persisting anything.
  if (type === "discord") {
    if (!externalId || !accessToken) {
      return Response.json(
        { error: "A Discord channel ID and bot token are required." },
        { status: 400 }
      );
    }

    const discordRes = await fetch(
      `${DISCORD_API}/channels/${externalId}`,
      { headers: { Authorization: `Bot ${accessToken}` } }
    ).catch(() => null);

    if (!discordRes || !discordRes.ok) {
      return Response.json(
        {
          error:
            "Could not reach that Discord channel with this bot token. Check the token and channel ID, and that the bot is in the server.",
        },
        { status: 400 }
      );
    }

    const channel = await discordRes.json().catch(() => null);
    name = channel?.name ?? name ?? "Discord";
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("platforms")
    .upsert(
      {
        type,
        name,
        external_id: externalId,
        access_token: accessToken,
        is_connected: true,
      },
      { onConflict: "type" }
    )
    .select(SAFE_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ platform: data });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const type = body?.type ?? request.nextUrl.searchParams.get("type");

  if (!isPlatformType(type)) {
    return Response.json(
      { error: "A valid platform type is required." },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { data, error } = await db
    .from("platforms")
    .update({
      access_token: null,
      refresh_token: null,
      is_connected: false,
    })
    .eq("type", type)
    .select(SAFE_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ platform: data });
}

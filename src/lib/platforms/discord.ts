import "server-only";

// Minimal Discord bot-token message fetch. SERVER ONLY — the bot token is a
// secret and must never reach the browser. Returns small, cache-friendly shapes
// (never the raw Discord message blob) and throws a clear Error on any non-2xx
// so the sync caller can catch and skip Discord without aborting other platforms.

const DISCORD_API = "https://discord.com/api/v10";

export interface DiscordMessage {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  url: string;
}

// Discord's message object — only the fields we surface.
interface RawDiscordMessage {
  id: string;
  content?: string;
  timestamp?: string;
  author?: { username?: string };
}

function normalizeMessage(
  raw: RawDiscordMessage,
  channelId: string
): DiscordMessage {
  return {
    id: raw.id,
    content: raw.content ?? "",
    author: raw.author?.username ?? "",
    timestamp: raw.timestamp ?? "",
    url: `https://discord.com/channels/@me/${channelId}/${raw.id}`,
  };
}

async function discordGet(
  token: string,
  path: string
): Promise<RawDiscordMessage[]> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}` },
  });

  if (!res.ok) {
    // Deliberately does not include the token or response body — just status.
    throw new Error(`Discord API error (${res.status}) for ${path}`);
  }

  return (await res.json()) as RawDiscordMessage[];
}

// Recent channel messages, newest first. Skips messages with empty content
// (bot embeds, attachment-only posts, system messages).
export async function fetchChannelMessages(
  token: string,
  channelId: string,
  limit = 50
): Promise<DiscordMessage[]> {
  const raw = await discordGet(
    token,
    `/channels/${channelId}/messages?limit=${limit}`
  );

  return raw
    .map((m) => normalizeMessage(m, channelId))
    .filter((m) => m.content.trim().length > 0);
}

// Pinned messages for a channel. Same shape and same empty-content filter.
export async function fetchPinnedMessages(
  token: string,
  channelId: string
): Promise<DiscordMessage[]> {
  const raw = await discordGet(token, `/channels/${channelId}/pins`);

  return raw
    .map((m) => normalizeMessage(m, channelId))
    .filter((m) => m.content.trim().length > 0);
}

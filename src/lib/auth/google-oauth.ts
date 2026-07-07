import "server-only";
import { createServerClient } from "@/lib/supabase/server";

// Google OAuth 2.0 authorization-code flow for connecting Google Classroom.
// Server-only: reads client secret from env and touches token columns that must
// never reach the browser.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Space-separated OAuth scopes: read-only Classroom + basic identity.
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");

// Shared between the initiation and callback routes for the CSRF state cookie.
export const OAUTH_STATE_COOKIE = "google_oauth_state";

// Refresh a little before the real expiry to avoid handing out a token that
// dies mid-request.
const EXPIRY_SKEW_MS = 60_000;

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// Build the authorization URL the owner is redirected to. `access_type=offline`
// + `prompt=consent` force Google to return a refresh_token every time.
export async function getAuthUrl(state: string, requestUrl: string): Promise<string> {
  const db = createServerClient();
  const { data } = await db.from("platforms").select().eq("type", "google_oauth").maybeSingle();

  const clientId = data?.external_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const defaultRedirect = new URL("/api/auth/google/callback", requestUrl).toString();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || defaultRedirect;

  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange the authorization code for tokens.
export async function exchangeCode(code: string, requestUrl: string): Promise<TokenResponse> {
  const db = createServerClient();
  const { data } = await db.from("platforms").select().eq("type", "google_oauth").maybeSingle();

  const clientId = data?.external_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = data?.access_token || process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const defaultRedirect = new URL("/api/auth/google/callback", requestUrl).toString();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || defaultRedirect;

  const body = new URLSearchParams({
    code,
    client_id: clientId!,
    client_secret: clientSecret!,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }

  return (await res.json()) as TokenResponse;
}

// Exchange a stored refresh_token for a fresh access_token. Google usually does
// NOT return a new refresh_token here — the caller keeps the existing one.
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const db = createServerClient();
  const { data } = await db.from("platforms").select().eq("type", "google_oauth").maybeSingle();

  const clientId = data?.external_id || process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = data?.access_token || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  const body = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status})`);
  }

  return (await res.json()) as RefreshResponse;
}

// Reusable entry point for later Classroom API calls (e.g. the MCP server).
// Returns a currently-valid access token, refreshing and persisting it first if
// the stored one is expired or within EXPIRY_SKEW_MS of expiring.
export async function getValidClassroomToken(): Promise<string> {
  const db = createServerClient();

  const { data, error } = await db
    .from("platforms")
    .select("access_token, refresh_token, token_expires_at, is_connected")
    .eq("type", "google_classroom")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google Classroom platform: ${error.message}`);
  }

  if (!data || !data.is_connected || !data.access_token) {
    throw new Error("Google Classroom is not connected.");
  }

  const expiresAtMs = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;

  // Still comfortably valid — return the stored token as-is.
  if (expiresAtMs - Date.now() > EXPIRY_SKEW_MS) {
    return data.access_token;
  }

  if (!data.refresh_token) {
    throw new Error(
      "Google Classroom token expired and no refresh token is stored. Reconnect the platform."
    );
  }

  const refreshed = await refreshAccessToken(data.refresh_token);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  const { error: updateError } = await db
    .from("platforms")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: tokenExpiresAt,
    })
    .eq("type", "google_classroom");

  if (updateError) {
    throw new Error(`Failed to persist refreshed Google Classroom token: ${updateError.message}`);
  }

  return refreshed.access_token;
}

// Base URL for the connected user's primary calendar.
const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Calendar-synced events are tagged in events.source_external_id with this prefix
// so reconcile/delete-detection only ever touch calendar rows — never Classroom
// coursework, which shares the same source_platform.
export const GCAL_PREFIX = "gcal:";

export function gcalExternalId(googleId: string): string {
  return GCAL_PREFIX + googleId;
}

// Returns the raw Google event id if externalId is a calendar marker, else null.
export function parseGcalId(externalId: string | null | undefined): string | null {
  return externalId && externalId.startsWith(GCAL_PREFIX)
    ? externalId.slice(GCAL_PREFIX.length)
    : null;
}

// The platforms row id for the Google connection — used as source_platform on
// calendar-synced events. Null when Google was never connected.
export async function getGooglePlatformId(): Promise<string | null> {
  const db = createServerClient();
  const { data } = await db
    .from("platforms")
    .select("id")
    .eq("type", "google_classroom")
    .maybeSingle();
  return data?.id ?? null;
}

function eventTimes(startTime: string, endTime?: string) {
  return {
    start: { dateTime: startTime },
    end: {
      dateTime:
        endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    },
  };
}

// Create an event on the connected primary calendar. Returns the created Google
// event id (persisted locally so the row can later be updated/deleted on
// Google), or null if not connected / the API failed.
export async function writeToGoogleCalendar(
  title: string,
  startTime: string,
  endTime?: string,
  description?: string
): Promise<string | null> {
  try {
    const accessToken = await getValidClassroomToken();

    const response = await fetch(CALENDAR_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: description || "Created via Nexus AI",
        ...eventTimes(startTime, endTime),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API error:", errText);
      return null;
    }

    const created = (await response.json().catch(() => null)) as { id?: string } | null;
    return created?.id ?? null;
  } catch (error) {
    // Fail silently if not connected or API error
    console.warn("Failed to write to Google Calendar (maybe not connected):", error);
    return null;
  }
}

// Patch an existing Google event. Only the fields passed are changed.
export async function updateGoogleCalendarEvent(
  googleId: string,
  fields: { title?: string; startTime?: string; endTime?: string; description?: string }
): Promise<void> {
  try {
    const accessToken = await getValidClassroomToken();

    const body: Record<string, unknown> = {};
    if (fields.title !== undefined) body.summary = fields.title;
    if (fields.description !== undefined) body.description = fields.description;
    if (fields.startTime !== undefined) {
      const { start, end } = eventTimes(fields.startTime, fields.endTime);
      body.start = start;
      // Only overwrite end when a start was given; otherwise leave Google's end.
      if (fields.endTime !== undefined) body.end = end;
    } else if (fields.endTime !== undefined) {
      body.end = { dateTime: fields.endTime };
    }

    if (Object.keys(body).length === 0) return;

    const response = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(googleId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("Google Calendar update error:", await response.text());
    }
  } catch (error) {
    console.warn("Failed to update Google Calendar event:", error);
  }
}

// Delete a Google event. 404/410 mean it's already gone — treated as success.
export async function deleteGoogleCalendarEvent(googleId: string): Promise<void> {
  try {
    const accessToken = await getValidClassroomToken();

    const response = await fetch(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(googleId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok && response.status !== 404 && response.status !== 410) {
      console.error("Google Calendar delete error:", await response.text());
    }
  } catch (error) {
    console.warn("Failed to delete Google Calendar event:", error);
  }
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
}

// List events on the primary calendar within [timeMin, timeMax]. singleEvents
// expands recurring series into instances. Returns [] if not connected.
export async function listGoogleCalendarEvents(
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  try {
    const accessToken = await getValidClassroomToken();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      showDeleted: "false",
      orderBy: "startTime",
      maxResults: "250",
    });

    const response = await fetch(`${CALENDAR_EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error("Google Calendar list error:", await response.text());
      return [];
    }

    const data = (await response.json().catch(() => null)) as {
      items?: Array<{
        id: string;
        status?: string;
        summary?: string;
        description?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    } | null;

    return (data?.items ?? [])
      .filter((item) => item.status !== "cancelled" && item.id)
      .map((item) => ({
        id: item.id,
        summary: item.summary || "(no title)",
        description: item.description ?? null,
        startTime: item.start?.dateTime ?? item.start?.date ?? null,
        endTime: item.end?.dateTime ?? item.end?.date ?? null,
      }));
  } catch (error) {
    console.warn("Failed to list Google Calendar events:", error);
    return [];
  }
}

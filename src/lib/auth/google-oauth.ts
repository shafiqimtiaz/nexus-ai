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

export async function writeToGoogleCalendar(
  title: string,
  startTime: string,
  endTime?: string,
  description?: string
): Promise<void> {
  try {
    const accessToken = await getValidClassroomToken();

    const start = { dateTime: startTime };
    const end = {
      dateTime:
        endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    };

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          description: description || "Created via Nexus AI",
          start,
          end,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google Calendar API error:", errText);
    }
  } catch (error) {
    // Fail silently if not connected or API error
    console.warn("Failed to write to Google Calendar (maybe not connected):", error);
  }
}

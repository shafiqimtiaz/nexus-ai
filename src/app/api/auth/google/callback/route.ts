import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { exchangeCode, OAUTH_STATE_COOKIE } from "@/lib/auth/google-oauth";

const CLASSROOM_COURSES_URL =
  "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE";

// GET /api/auth/google/callback — Google redirects here with ?code & ?state.
// Verifies CSRF state, exchanges the code, picks a Classroom course, and
// persists the tokens. Tokens are never placed in the redirect URL.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const optionsUrl = (query: string) =>
    new URL(`/options?${query}`, request.url);

  const c = await cookies();
  const storedState = c.get(OAUTH_STATE_COOKIE)?.value;
  const state = params.get("state");

  // Single-use: clear the state cookie no matter how this request resolves.
  c.delete(OAUTH_STATE_COOKIE);

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(optionsUrl("error=state"));
  }

  const denied = await requireOwner();
  if (denied) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = params.get("code");
  if (!code) {
    // e.g. user hit "Cancel" — Google returns ?error=access_denied.
    return NextResponse.redirect(optionsUrl("error=denied"));
  }

  try {
    const tokens = await exchangeCode(code, request.url);

    const coursesRes = await fetch(CLASSROOM_COURSES_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!coursesRes.ok) {
      return NextResponse.redirect(optionsUrl("error=courses"));
    }

    const coursesData = (await coursesRes.json()) as {
      courses?: Array<{ id: string; name?: string }>;
    };

    // TODO: let user choose course — MVP grabs the first active course.
    const course = coursesData.courses?.[0];
    if (!course) {
      return NextResponse.redirect(optionsUrl("error=nocourse"));
    }

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const db = createServerClient();
    const { error } = await db.from("platforms").upsert(
      {
        type: "google_classroom",
        name: course.name ?? "Google Classroom",
        external_id: String(course.id),
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        is_connected: true,
        // Google omits refresh_token on re-consent sometimes; keep the stored
        // one instead of overwriting it with null.
        ...(tokens.refresh_token
          ? { refresh_token: tokens.refresh_token }
          : {}),
      },
      { onConflict: "type" }
    );

    if (error) {
      return NextResponse.redirect(optionsUrl("error=save"));
    }

    return NextResponse.redirect(optionsUrl("connected=classroom"));
  } catch {
    return NextResponse.redirect(optionsUrl("error=oauth"));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireOwner } from "@/lib/auth";
import { getAuthUrl, OAUTH_STATE_COOKIE } from "@/lib/auth/google-oauth";

// GET /api/auth/google — owner-only. Starts the Google OAuth flow: mints a CSRF
// state value, stashes it in an httpOnly cookie, and redirects to Google's
// consent screen. A demo user is bounced to /login rather than getting raw 403
// JSON (this is a navigation route).
export async function GET(request: NextRequest) {
  const denied = await requireOwner();
  if (denied) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomUUID();

  const c = await cookies();
  c.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  });

  return NextResponse.redirect(getAuthUrl(state));
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthUrl, OAUTH_STATE_COOKIE } from "@/lib/auth/google-oauth";

// GET /api/auth/google — Starts the Google OAuth flow.
// Unlocked so users can log in and connect Classroom via Google.
export async function GET(request: NextRequest) {
  try {
    const state = crypto.randomUUID();

    const c = await cookies();
    c.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes to complete consent
    });

    const authUrl = await getAuthUrl(state, request.url);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error occurred" },
      { status: 500 }
    );
  }
}

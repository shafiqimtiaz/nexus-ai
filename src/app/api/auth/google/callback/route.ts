import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { exchangeCode, OAUTH_STATE_COOKIE } from "@/lib/auth/google-oauth";

const CLASSROOM_COURSES_URL = "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const optionsUrl = (query: string) => new URL(`/options?${query}`, request.url);

  const c = await cookies();
  const storedState = c.get(OAUTH_STATE_COOKIE)?.value;
  const state = params.get("state");

  c.delete(OAUTH_STATE_COOKIE);

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(optionsUrl("error=state"));
  }

  const code = params.get("code");
  if (!code) {
    return NextResponse.redirect(optionsUrl("error=denied"));
  }

  try {
    const tokens = await exchangeCode(code, request.url);

    const coursesRes = await fetch(CLASSROOM_COURSES_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!coursesRes.ok) {
      return Response.json(
        { error: "Failed to fetch courses from Google Classroom API", status: coursesRes.status },
        { status: 500 }
      );
    }

    const coursesData = (await coursesRes.json().catch(() => ({}))) as {
      courses?: Array<{ id: string; name?: string }>;
    };

    const course = coursesData.courses?.[0];
    const courseName = course?.name ?? "Google Account";
    const courseId = course ? String(course.id) : "google_user";

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const db = createServerClient();
    const { error } = await db.from("platforms").upsert(
      {
        type: "google_classroom",
        name: courseName,
        external_id: courseId,
        access_token: tokens.access_token,
        token_expires_at: tokenExpiresAt,
        is_connected: true,
        // Google omits refresh_token on re-consent
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      },
      { onConflict: "user_id,type" }
    );

    if (error) {
      return Response.json(
        {
          error: "Failed to save Google Classroom credentials to database",
          details: error.message,
        },
        { status: 500 }
      );
    }

    c.set("nexus_logged_in", "true", {
      path: "/",
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
    });

    return NextResponse.redirect(optionsUrl("connected=classroom"));
  } catch (error: any) {
    return Response.json(
      { error: error.message || "Unknown OAuth error occurred" },
      { status: 500 }
    );
  }
}

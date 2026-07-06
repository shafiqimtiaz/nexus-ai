import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-client";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.set("nexus_logged_in", "true", {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return response;
    }
  }

  // Return the user to login with a failure parameter
  return NextResponse.redirect(new URL("/login?error=oauth_callback_failed", request.url));
}

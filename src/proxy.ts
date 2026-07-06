import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Next 16: the middleware convention is renamed to `proxy`. This refreshes the
// Supabase session on navigation (calling getUser() rotates the auth cookies)
// and passes the request through. It never blocks: demo users have no session,
// so getUser() simply returns null and we continue.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Touch the session so refreshed cookies get written to the response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on all paths except static assets, image optimization, favicon, and
  // the auth API routes (which manage cookies themselves).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

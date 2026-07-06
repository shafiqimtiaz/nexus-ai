import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Auth-only Supabase client. Wired to Next 16's async `cookies()` using the
// getAll/setAll adapter (the old get/set/remove adapter is gone in @supabase/ssr).
// Uses the ANON key — NEVER the service role key — because this client reads and
// writes the user's session cookie. All DB data access goes through the
// service-role client in `./server.ts` instead.
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component where cookies are
            // read-only. The session is refreshed by proxy.ts instead, so this
            // is safe to ignore.
          }
        },
      },
    }
  );
}

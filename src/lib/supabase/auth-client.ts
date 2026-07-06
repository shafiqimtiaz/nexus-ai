import "server-only";
import { cookies } from "next/headers";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";

// Mock/Real Auth Client helper. 
// Uses cookies to manage state, and connects to Supabase if configured.
export async function createAuthClient() {
  const cookieStore = await cookies();

  // If Supabase keys are configured, use the real Supabase auth client
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createSupabaseServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
  }

  // Fallback to Mock Auth Client for offline/local-only runs
  return {
    auth: {
      async getUser() {
        const loggedIn = cookieStore.get("nexus_logged_in")?.value === "true";
        return {
          data: {
            user: loggedIn ? { email: "owner@nexus.edu", id: "owner-user-id" } : null,
          },
          error: null,
        };
      },
      async signInWithPassword({ email, password }: any) {
        cookieStore.set("nexus_logged_in", "true", { path: "/" });
        return {
          data: {
            user: { email: "owner@nexus.edu", id: "owner-user-id" },
          },
          error: null,
        };
      },
      async signUp({ email, password }: any) {
        cookieStore.set("nexus_logged_in", "true", { path: "/" });
        return {
          data: {
            user: { email: "owner@nexus.edu", id: "owner-user-id" },
          },
          error: null,
        };
      },
      async signOut() {
        cookieStore.delete("nexus_logged_in");
        return { error: null };
      },
    },
  } as any;
}

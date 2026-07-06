import "server-only";
import { cookies } from "next/headers";

// Mock Auth Client using cookies to manage state without Supabase Auth.
export async function createAuthClient() {
  const cookieStore = await cookies();

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
      async signOut() {
        cookieStore.delete("nexus_logged_in");
        return { error: null };
      },
    },
  } as any;
}

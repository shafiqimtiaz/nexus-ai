import "server-only";
import { createAuthClient } from "@/lib/supabase/auth-client";

export type Role = "owner" | "demo";

// Owner = valid Supabase Auth session; anyone else = read-only demo.
export async function getRole(): Promise<Role> {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? "owner" : "demo";
}

// Mutation route handlers call this first and early-return the Response if
// non-null. Demo users get a 403; owners get null (proceed).
export async function requireOwner(): Promise<Response | null> {
  const role = await getRole();
  if (role === "demo") {
    return Response.json(
      { error: "Demo mode is read-only" },
      { status: 403 }
    );
  }
  return null;
}

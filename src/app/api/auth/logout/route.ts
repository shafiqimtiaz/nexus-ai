import { createAuthClient } from "@/lib/supabase/auth-client";

export async function POST() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}

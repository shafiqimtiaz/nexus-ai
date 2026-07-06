import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role Supabase client. SERVER ONLY — the service role key bypasses RLS
// and must never reach the browser. `import "server-only"` above guarantees this
// module fails the build if it is ever imported into client code.
export function createServerClient() {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

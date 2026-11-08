import "server-only";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MockSupabaseQueryBuilder } from "./mock-db";

// A query builder whose chained calls are recorded and replayed once the real client is known.
type Chainable = { [key: string | symbol]: (...args: unknown[]) => Chainable };

export function createServerClient(): SupabaseClient {
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // If Supabase keys are not set, fall back to mock database immediately
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !anonKey) {
    return {
      from(table: string) {
        return new MockSupabaseQueryBuilder(table);
      },
    } as unknown as SupabaseClient;
  }

  return {
    from(table: string) {
      const calls: { prop: string | symbol; args: unknown[] }[] = [];

      const builderProxy: Chainable = new Proxy({} as Chainable, {
        get(_target, prop) {
          // If the caller awaits the promise, resolve the client dynamically
          if (prop === "then") {
            return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
              (async () => {
                try {
                  const cookieStore = await cookies();
                  // Check if there is an active Supabase session cookie
                  const hasSession = cookieStore.getAll().some((c) => c.name.startsWith("sb-"));

                  let client: Chainable;
                  if (hasSession) {
                    client = createSupabaseServerClient(
                      process.env.NEXT_PUBLIC_SUPABASE_URL!,
                      anonKey!,
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
                    ).from(table) as unknown as Chainable;
                  } else {
                    client = new MockSupabaseQueryBuilder(table) as unknown as Chainable;
                  }

                  // Replay all the chained method calls on the resolved client
                  let current = client;
                  for (const call of calls) {
                    current = current[call.prop](...call.args);
                  }

                  const result = await current;
                  resolve(result);
                } catch (err) {
                  reject(err);
                }
              })();
            };
          }

          // Otherwise, collect the method call and return the proxy again for chaining
          return (...args: unknown[]) => {
            calls.push({ prop, args });
            return builderProxy;
          };
        },
      });

      return builderProxy;
    },
  } as unknown as SupabaseClient;
}

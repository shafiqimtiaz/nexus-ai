import "server-only";
import { MockSupabaseQueryBuilder } from "./mock-db";

export function createServerClient() {
  return {
    from(table: string) {
      return new MockSupabaseQueryBuilder(table);
    }
  } as any;
}

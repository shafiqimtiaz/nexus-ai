import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16: Simplified proxy bypass to avoid requiring Supabase keys during bootstrap.
// Session and role gating are managed dynamically in route handlers and pages.
export async function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

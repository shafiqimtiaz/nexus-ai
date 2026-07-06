import { getDashboardData } from "@/lib/dashboard";

// GET /api/dashboard — one aggregated payload for the dashboard. No owner guard:
// demo reads the seeded data just like the owner. Shares getDashboardData() with
// the page so there is no HTTP self-fetch.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDashboardData();
  return Response.json(data);
}

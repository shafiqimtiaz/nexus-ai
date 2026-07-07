import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 10;

// GET /api/announcements?page=0&pageSize=10&platform=google_classroom&unreadOnly=true
// Both owner and demo roles — read-only.
export async function GET(request: NextRequest) {
  const db = createServerClient();
  const sp = request.nextUrl.searchParams;

  const page = Math.max(0, parseInt(sp.get("page") ?? "0", 10) || 0);
  const pageSize = Math.max(1, Math.min(50, parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  const platform = sp.get("platform")?.trim() || null;
  const unreadOnly = sp.get("unreadOnly") === "true";

  let query = db
    .from("announcements")
    .select("id, title, content, author, source_url, announced_at, platform_id")
    .order("announced_at", { ascending: false });

  if (platform) {
    // We'll filter after fetching since mock-db might not support joins.
    // Fetch platform IDs matching the type first.
    const { data: platforms } = await db.from("platforms").select("id").eq("type", platform);
    const platformIds = (platforms ?? []).map((p: any) => p.id as string);
    if (platformIds.length > 0) {
      query = query.in("platform_id", platformIds);
    } else {
      return Response.json({ items: [], total: 0, page, pageSize });
    }
  }

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  let { data: allData, error } = await query;

  // Fallback for mock-db which doesn't chain .in after .order properly
  if (!allData && error) {
    // Try without the .in filter
    const fallback = db
      .from("announcements")
      .select("id, title, content, author, source_url, announced_at, platform_id")
      .order("announced_at", { ascending: false });
    const fbResult = await fallback;
    allData = fbResult.data;
    error = fbResult.error;
  }

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  let items = (allData ?? []) as any[];

  // Client-side filter for platform if mock-db didn't support .in chaining
  if (platform) {
    const { data: platforms } = await db.from("platforms").select("id").eq("type", platform);
    const platformIds = new Set((platforms ?? []).map((p: any) => p.id as string));
    items = items.filter((item) => platformIds.has(item.platform_id));
  }

  if (unreadOnly) {
    items = items.filter((item) => item.is_read === false);
  }

  const total = items.length;
  const offset = page * pageSize;
  const paged = items.slice(offset, offset + pageSize);

  // Map platform_id → platform name/type
  const allPlatformIds = [...new Set(paged.map((a: any) => a.platform_id).filter(Boolean))];
  const { data: platformData } = allPlatformIds.length > 0
    ? await db.from("platforms").select("id, name, type").in("id", allPlatformIds)
    : { data: [] };
  const platformMap = new Map<string, { name: string | null; type: string | null }>(
    (platformData ?? []).map((p: any) => [p.id, { name: p.name, type: p.type }])
  );

  const result = paged.map((item: any) => {
    const plat = item.platform_id ? platformMap.get(item.platform_id) : null;
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      author: item.author,
      source_url: item.source_url,
      announced_at: item.announced_at,
      channel: plat?.name ?? null,
      platform: plat?.type ?? null,
    };
  });

  return Response.json({ items: result, total, page, pageSize });
}

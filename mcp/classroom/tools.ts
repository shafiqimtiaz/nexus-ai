import "server-only";
import { getValidClassroomToken } from "@/lib/auth/google-oauth";
import { createServerClient } from "@/lib/supabase/server";

// Plain Google Classroom logic used by the MCP server. Each function fetches
// exactly what it needs and returns a small, LLM-friendly shape — never the raw
// Classroom API blob. Server-only: these read the service-role DB and a live
// access token.

const CLASSROOM_API = "https://classroom.googleapis.com/v1";

// A valid access token plus the connected course id, resolved together so each
// tool call touches the DB once.
async function classroomContext(): Promise<{ token: string; courseId: string }> {
  const token = await getValidClassroomToken();

  const db = createServerClient();
  const { data, error } = await db
    .from("platforms")
    .select("external_id")
    .eq("type", "google_classroom")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google Classroom course: ${error.message}`);
  }
  if (!data?.external_id) {
    throw new Error("No Google Classroom course is connected.");
  }

  return { token, courseId: String(data.external_id) };
}

async function classroomGet<T>(
  path: string,
  token: string,
  query?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${CLASSROOM_API}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Google Classroom API error (${res.status}) for ${path}`);
  }

  return (await res.json()) as T;
}

// Convert Classroom's split date/time into an ISO string (UTC). Returns null
// when no due date is set.
function toIsoDueDate(
  dueDate?: { year?: number; month?: number; day?: number },
  dueTime?: { hours?: number; minutes?: number; seconds?: number }
): string | null {
  if (!dueDate?.year || !dueDate.month || !dueDate.day) return null;
  return new Date(
    Date.UTC(
      dueDate.year,
      dueDate.month - 1,
      dueDate.day,
      dueTime?.hours ?? 0,
      dueTime?.minutes ?? 0,
      dueTime?.seconds ?? 0
    )
  ).toISOString();
}

export interface AnnouncementSummary {
  id: string;
  text: string;
  createdAt: string;
  url: string;
}

export async function listAnnouncements(
  limit = 10
): Promise<AnnouncementSummary[]> {
  const { token, courseId } = await classroomContext();
  const data = await classroomGet<{
    announcements?: Array<{
      id: string;
      text?: string;
      creationTime?: string;
      alternateLink?: string;
    }>;
  }>(`/courses/${courseId}/announcements`, token, { pageSize: limit });

  return (data.announcements ?? []).slice(0, limit).map((a) => ({
    id: a.id,
    text: a.text ?? "",
    createdAt: a.creationTime ?? "",
    url: a.alternateLink ?? "",
  }));
}

export interface AssignmentSummary {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  url: string;
}

export async function listAssignments(
  limit = 10
): Promise<AssignmentSummary[]> {
  const { token, courseId } = await classroomContext();
  const data = await classroomGet<{
    courseWork?: Array<{
      id: string;
      title?: string;
      description?: string;
      dueDate?: { year?: number; month?: number; day?: number };
      dueTime?: { hours?: number; minutes?: number; seconds?: number };
      alternateLink?: string;
    }>;
  }>(`/courses/${courseId}/courseWork`, token, { pageSize: limit });

  return (data.courseWork ?? []).slice(0, limit).map((w) => ({
    id: w.id,
    title: w.title ?? "",
    description: w.description ?? "",
    dueDate: toIsoDueDate(w.dueDate, w.dueTime),
    url: w.alternateLink ?? "",
  }));
}

export interface MaterialSummary {
  id: string;
  title: string;
  description: string;
  url: string;
}

export async function listMaterials(limit = 10): Promise<MaterialSummary[]> {
  const { token, courseId } = await classroomContext();
  const data = await classroomGet<{
    courseWorkMaterial?: Array<{
      id: string;
      title?: string;
      description?: string;
      alternateLink?: string;
    }>;
  }>(`/courses/${courseId}/courseWorkMaterials`, token, { pageSize: limit });

  return (data.courseWorkMaterial ?? []).slice(0, limit).map((m) => ({
    id: m.id,
    title: m.title ?? "",
    description: m.description ?? "",
    url: m.alternateLink ?? "",
  }));
}

export interface ClassInfo {
  id: string;
  name: string;
  section: string;
  room: string;
}

export async function getClassInfo(): Promise<ClassInfo> {
  const { token, courseId } = await classroomContext();
  const data = await classroomGet<{
    id?: string;
    name?: string;
    section?: string;
    room?: string;
  }>(`/courses/${courseId}`, token);

  return {
    id: data.id ?? courseId,
    name: data.name ?? "",
    section: data.section ?? "",
    room: data.room ?? "",
  };
}

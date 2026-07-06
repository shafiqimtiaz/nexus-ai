import { getRole } from "@/lib/auth";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata = {
  title: "Calendar — Nexus",
};

// Only reads the role (cookies) server-side; all event data is fetched from the
// client via react-query, so no build-time prerender of DB data.
export default async function CalendarPage() {
  const role = await getRole();
  return <CalendarView role={role} />;
}

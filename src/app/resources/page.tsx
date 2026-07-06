import { getRole } from "@/lib/auth";
import { ResourcesView } from "@/components/resources/resources-view";

export const metadata = {
  title: "Resources — Nexus",
};

// Reads the role (cookies) server-side; all resource/label data is fetched from
// the client via react-query, so nothing DB-backed is prerendered at build time.
export default async function ResourcesPage() {
  const role = await getRole();
  return <ResourcesView role={role} />;
}

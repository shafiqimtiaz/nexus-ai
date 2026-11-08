import { getRole } from "@/lib/auth";
import { ResourcesView } from "@/components/resources/resources-view";

export const metadata = {
  title: "Library — Nexus",
};

export default async function ResourcesPage() {
  const role = await getRole();
  return <ResourcesView role={role} />;
}

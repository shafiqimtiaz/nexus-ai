import { getRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { PlatformCard } from "@/components/options/platform-card";
import { AiRulesCard } from "@/components/options/ai-rules-card";

export const metadata = {
  title: "Settings — Nexus",
};

export default async function OptionsPage() {
  const role = await getRole();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Connections and rules"
        description="Connect the platforms Nexus pulls your coursework from, and teach the agent how you like to work."
      />

      <div className="space-y-4">
        <AiRulesCard />
        <PlatformCard
          type="gemini"
          displayName="Google Gemini"
          description="Configure your Gemini API key to power the AI Chat Assistant."
          role={role}
        />
        <PlatformCard
          type="google_classroom"
          displayName="Google Classroom"
          description="Sync your courses, assignments, and due dates."
          role={role}
        />
        <PlatformCard
          type="discord"
          displayName="Discord"
          description="Sync announcements and coursework from a channel you can access."
          role={role}
        />
        <PlatformCard
          type="slack"
          displayName="Slack"
          description="Sync announcements and coursework from your workspace channels."
          role={role}
        />
      </div>
    </div>
  );
}

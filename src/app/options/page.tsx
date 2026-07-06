import { getRole } from "@/lib/auth";
import { PlatformCard } from "@/components/options/platform-card";

export const metadata = {
  title: "Options — Nexus",
};

export default async function OptionsPage() {
  const role = await getRole();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Options</h1>
        <p className="text-sm text-muted-foreground">
          Connect the platforms Nexus pulls your coursework and messages from.
        </p>
      </div>

      <div className="space-y-4">
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

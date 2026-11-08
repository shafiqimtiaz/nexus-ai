import { getRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ChatInterface } from "@/components/chat/chat-interface";

export const metadata = {
  title: "Ask Nexus — Nexus",
};

export default async function ChatPage() {
  const role = await getRole();

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-3xl flex-col gap-4">
      <PageHeader
        eyebrow="Study agent"
        title="Ask Nexus"
        description="Check your schedule, plan study sessions, and manage your coursework with tools Nexus can actually use."
      />

      <div className="min-h-0 flex-1">
        <ChatInterface role={role} expanded autoFocus />
      </div>
    </div>
  );
}

import { getRole } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";

export const metadata = {
  title: "AI Chat — Nexus",
};

export default async function ChatPage() {
  const role = await getRole();

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
        <p className="text-sm text-muted-foreground">
          Nexus can check your schedule, plan study sessions, and manage your
          coursework using its tools.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <ChatInterface role={role} />
      </div>
    </div>
  );
}

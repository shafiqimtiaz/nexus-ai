"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useHydrated } from "@/lib/use-hydrated";

export function SlackIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.043zm2.52-10.123a2.528 2.528 0 0 1-2.52-2.522A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.52v2.522h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.522-2.522V8.823a2.528 2.528 0 0 1 2.522-2.52h5.043zm10.123 2.52a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522h-2.52v-2.522zm-1.261 0a2.528 2.528 0 0 1-2.522 2.52h-5.043a2.528 2.528 0 0 1-2.52-2.52V3.78a2.528 2.528 0 0 1 2.52-2.522h5.043a2.528 2.528 0 0 1 2.522 2.522v5.043zm-2.52 10.123a2.528 2.528 0 0 1 2.52 2.522a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.261a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52H15.18z" />
    </svg>
  );
}

function HelpAlert({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Alert>
      <HugeiconsIcon icon={InformationCircleIcon} />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4 text-xs">{children}</ul>
      </AlertDescription>
    </Alert>
  );
}

export function ClassroomHelp() {
  const hydrated = useHydrated();
  const origin = hydrated ? window.location.origin : "http://localhost:3000";

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Authorized redirect URI</p>
        <code className="block rounded border bg-background px-2 py-1 text-[11px] break-all select-all">
          {origin}/api/auth/google/callback
        </code>
      </div>
      <HelpAlert title="How to configure Google Classroom">
        <li>Go to Google Cloud Console, create a project, and enable the Google Classroom API.</li>
        <li>
          Configure your OAuth consent screen and add the redirect URI above to your authorized
          redirect URIs.
        </li>
        <li>Create OAuth 2.0 Client ID credentials, then paste the Client ID and Secret here.</li>
      </HelpAlert>
    </div>
  );
}

export function DiscordHelp() {
  return (
    <HelpAlert title="How to configure Discord">
      <li>
        <strong>User token:</strong> Open Discord in your web browser, press F12, inspect any API
        request under the Network tab, and copy the <code>authorization</code> header value.{" "}
        <em>Keep this token private!</em>
      </li>
      <li>
        <strong>Channel ID:</strong> Enable Developer Mode in Discord Settings &gt; Advanced,
        right-click the channel, and choose <strong>Copy Channel ID</strong>.
      </li>
    </HelpAlert>
  );
}

export function SlackHelp() {
  return (
    <HelpAlert title="How to configure Slack">
      <li>
        <strong>Token (xoxc-...):</strong> Open Slack in your web browser, press F12, inspect any
        request under the Network tab, and copy the token starting with <code>xoxc-</code> in the
        request payload or response.
      </li>
      <li>
        <strong>d cookie (xoxd-...):</strong> In browser Developer Tools, go to Application &gt;
        Cookies &gt; slack.com, and copy the value of the <code>d</code> cookie.
      </li>
      <li>
        <strong>Channel ID:</strong> Right-click the channel name in Slack, click &apos;View channel
        details&apos;, and copy the ID at the bottom.
      </li>
    </HelpAlert>
  );
}

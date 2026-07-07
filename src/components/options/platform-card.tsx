"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  HashIcon,
  Key01Icon,
  Loading03Icon,
  Mortarboard02Icon,
  Message01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

type PlatformType = "google_classroom" | "discord" | "slack" | "gemini";

type SafePlatform = {
  id: string;
  type: PlatformType;
  name: string | null;
  external_id: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
};

type PlatformsResponse = {
  platforms: SafePlatform[];
  hasGlobalGoogleOauth: boolean;
};

async function fetchPlatforms(): Promise<PlatformsResponse> {
  const res = await fetch("/api/platforms");
  if (!res.ok) throw new Error("Failed to load platforms");
  const json = await res.json();
  return {
    platforms: json.platforms ?? [],
    hasGlobalGoogleOauth: !!json.hasGlobalGoogleOauth,
  };
}

function formatSynced(iso: string | null): string {
  if (!iso) return "never synced";
  return `last synced ${new Date(iso).toLocaleString()}`;
}

function SlackIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.043zm2.52-10.123a2.528 2.528 0 0 1-2.52-2.522A2.528 2.528 0 0 1 8.823 0a2.528 2.528 0 0 1 2.52 2.52v2.522h-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.78a2.528 2.528 0 0 1-2.522-2.522V8.823a2.528 2.528 0 0 1 2.522-2.52h5.043zm10.123 2.52a2.528 2.528 0 0 1 2.522-2.52 2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522h-2.52v-2.522zm-1.261 0a2.528 2.528 0 0 1-2.522 2.52h-5.043a2.528 2.528 0 0 1-2.52-2.52V3.78a2.528 2.528 0 0 1 2.52-2.522h5.043a2.528 2.528 0 0 1 2.522 2.522v5.043zm-2.52 10.123a2.528 2.528 0 0 1 2.52 2.522a2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.261a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52H15.18z" />
    </svg>
  );
}

export function PlatformCard({
  type,
  displayName,
  description,
  role,
}: {
  type: PlatformType;
  displayName: string;
  description: string;
  role: Role;
}) {
  const icon =
    type === "google_classroom" ? Mortarboard02Icon : type === "gemini" ? SparklesIcon : Message01Icon;
  const queryClient = useQueryClient();
  const isDemo = role === "demo";

  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [slackCookie, setSlackCookie] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platforms"],
    queryFn: fetchPlatforms,
  });

  const platforms = data?.platforms;
  const hasGlobalGoogleOauth = data?.hasGlobalGoogleOauth ?? false;
  const platform = platforms?.find((p) => p.type === type);
  const connected = platform?.is_connected ?? false;

  const connectDiscord = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "discord",
          external_id: channelId.trim(),
          access_token: botToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect Discord.");
      return json.platform as SafePlatform;
    },
    onSuccess: (p) => {
      toast.success(`Connected to #${p.name ?? "Discord"}.`);
      setBotToken("");
      setChannelId("");
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectSlack = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slack",
          external_id: channelId.trim(),
          access_token: botToken.trim(),
          refresh_token: slackCookie.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect Slack.");
      return json.platform as SafePlatform;
    },
    onSuccess: (p) => {
      toast.success(`Connected to #${p.name ?? "Slack"}.`);
      setBotToken("");
      setChannelId("");
      setSlackCookie("");
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectGemini = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "gemini",
          access_token: botToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not configure Gemini key.");
      return json.platform as SafePlatform;
    },
    onSuccess: () => {
      toast.success(`Gemini API Key configured.`);
      setBotToken("");
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectGoogleOauth = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "google_oauth",
          external_id: channelId.trim(),
          access_token: botToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not configure Google OAuth.");
      window.location.href = "/api/auth/google";
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectBot =
    type === "gemini" ? connectGemini : type === "slack" ? connectSlack : connectDiscord;
  const isSlack = type === "slack";

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/platforms?type=${type}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not disconnect.");
      return json.platform as SafePlatform;
    },
    onSuccess: () => {
      toast.success(`Disconnected ${displayName}.`);
      queryClient.invalidateQueries({ queryKey: ["platforms"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            {isSlack ? (
              <SlackIcon className="h-5 w-5" />
            ) : (
              <HugeiconsIcon icon={icon} className="h-5 w-5" />
            )}
          </span>
          <div>
            <CardTitle>{displayName}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <CardAction>
          {isLoading ? (
            <Badge variant="secondary">Checking…</Badge>
          ) : connected ? (
            <Badge>Connected</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        {connected && (
          <p className="text-xs text-muted-foreground">
            {type === "gemini"
              ? "Key configured. AI Chat is fully operational."
              : `${platform?.name ? `${platform.name} · ` : ""}${formatSynced(
                  platform?.last_synced_at ?? null
                )}`}
          </p>
        )}

        {type === "google_classroom" ? (
          <div className="space-y-4">
            {!connected && (
              <div className="space-y-3">
                {!hasGlobalGoogleOauth ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="client-id"
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                        >
                          <HugeiconsIcon icon={Key01Icon} className="h-3.5 w-3.5" />
                          Google Client ID
                        </label>
                        <Input
                          id="client-id"
                          placeholder="Enter Google Client ID (optional if env set)"
                          value={channelId}
                          disabled={isDemo || connectGoogleOauth.isPending}
                          onChange={(e) => setChannelId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="client-secret"
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                        >
                          <HugeiconsIcon icon={Key01Icon} className="h-3.5 w-3.5" />
                          Google Client Secret
                        </label>
                        <Input
                          id="client-secret"
                          type="password"
                          placeholder="Enter Google Client Secret (optional if env set)"
                          value={botToken}
                          disabled={isDemo || connectGoogleOauth.isPending}
                          onChange={(e) => setBotToken(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Authorized Redirect URI:
                      </p>
                      <code className="text-[11px] block select-all break-all bg-background border px-2 py-1 rounded">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/api/auth/google/callback`
                          : "http://localhost:3000/api/auth/google/callback"}
                      </code>
                      <div className="mt-3 text-[10px] text-muted-foreground space-y-1.5 border-t pt-2 border-border/50">
                        <p className="font-medium text-foreground text-xs">How to configure Google Classroom:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Go to Google Cloud Console, create a project, and enable the Google Classroom API.</li>
                          <li>Configure your OAuth consent screen and add the Redirect URI above to your Authorized Redirect URIs.</li>
                          <li>Create OAuth 2.0 Client ID credentials, then paste the Client ID and Secret here.</li>
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Google OAuth is configured globally by the platform. You can connect your
                    Classroom account directly below.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {connected ? (
                <Button
                  variant="outline"
                  disabled={isDemo || disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={isDemo || connectGoogleOauth.isPending}
                  onClick={() => connectGoogleOauth.mutate()}
                >
                  {connectGoogleOauth.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                  Connect Google Classroom
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {!connected && (
              <>
                <div
                  className={cn("grid gap-3", type === "gemini" ? "grid-cols-1" : "sm:grid-cols-2")}
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="bot-token"
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                    >
                      <HugeiconsIcon icon={Key01Icon} className="h-3.5 w-3.5" />
                      {type === "gemini"
                        ? "Gemini API Key"
                        : isSlack
                          ? "Token (xoxc-...)"
                          : "User token"}
                    </label>
                    <Input
                      id="bot-token"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        type === "gemini"
                          ? "AIzaSy..."
                          : isSlack
                            ? "xoxc-..."
                            : "Your Discord user token"
                      }
                      value={botToken}
                      disabled={isDemo || connectBot.isPending}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                  </div>
                  {isSlack && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="slack-cookie"
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                      >
                        <HugeiconsIcon icon={Key01Icon} className="h-3.5 w-3.5" />
                        d cookie (xoxd-...)
                      </label>
                      <Input
                        id="slack-cookie"
                        type="password"
                        autoComplete="off"
                        placeholder="xoxd-..."
                        value={slackCookie}
                        disabled={isDemo || connectBot.isPending}
                        onChange={(e) => setSlackCookie(e.target.value)}
                      />
                    </div>
                  )}
                  {type !== "gemini" && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="bot-channel"
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                      >
                        <HugeiconsIcon icon={HashIcon} className="h-3.5 w-3.5" />
                        Channel ID
                      </label>
                      <Input
                        id="bot-channel"
                        placeholder={isSlack ? "C12345678" : "123456789012345678"}
                        value={channelId}
                        disabled={isDemo || connectBot.isPending}
                        onChange={(e) => setChannelId(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {type === "gemini" && (
                  <p className="text-[11px] text-muted-foreground">
                    Get an API key from the{" "}
                    <a
                      href="https://aistudio.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Google AI Studio
                    </a>
                    .
                  </p>
                )}

                {type === "discord" && (
                  <div className="rounded-md border bg-muted/20 p-3 text-[10px] text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground text-xs">How to configure Discord:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>User token:</strong> Open Discord in your web browser, press F12, inspect any API request under the Network tab, and copy the <code>authorization</code> header value. <em>Keep this token private!</em>
                      </li>
                      <li>
                        <strong>Channel ID:</strong> Enable Developer Mode in Discord Settings &gt; Advanced, right-click the channel, and choose <strong>Copy Channel ID</strong>.
                      </li>
                    </ul>
                  </div>
                )}

                {type === "slack" && (
                  <div className="rounded-md border bg-muted/20 p-3 text-[10px] text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground text-xs">How to configure Slack:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>Token (xoxc-...):</strong> Open Slack in your web browser, press F12, inspect any request under the Network tab, and copy the token starting with <code>xoxc-</code> in the request payload or response.
                      </li>
                      <li>
                        <strong>d cookie (xoxd-...):</strong> In browser Developer Tools, go to Application &gt; Cookies &gt; slack.com, and copy the value of the <code>d</code> cookie.
                      </li>
                      <li>
                        <strong>Channel ID:</strong> Right-click the channel name in Slack, click &apos;View channel details&apos;, and copy the ID at the bottom.
                      </li>
                    </ul>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {connected ? (
                <Button
                  variant="outline"
                  disabled={isDemo || disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={
                    isDemo ||
                    connectBot.isPending ||
                    !botToken.trim() ||
                    (type !== "gemini" && !channelId.trim()) ||
                    (isSlack && !slackCookie.trim())
                  }
                  onClick={() => connectBot.mutate()}
                >
                  {connectBot.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
                  Connect
                </Button>
              )}
            </div>
          </div>
        )}

        {isDemo && <p className="text-xs text-muted-foreground">Log in to manage connections.</p>}
      </CardContent>
    </Card>
  );
}

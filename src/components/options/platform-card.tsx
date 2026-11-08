"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  HashIcon,
  Key01Icon,
  Mortarboard02Icon,
  Message01Icon,
  SparklesIcon,
  Add01Icon,
  Delete02Icon,
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { Role } from "@/lib/auth";
import {
  ClassroomHelp,
  DiscordHelp,
  SlackHelp,
  SlackIcon,
} from "@/components/options/platform-help";
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
    type === "google_classroom"
      ? Mortarboard02Icon
      : type === "gemini"
        ? SparklesIcon
        : Message01Icon;
  const queryClient = useQueryClient();
  const isDemo = role === "demo";

  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");
  const [slackCookie, setSlackCookie] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([""]);
  const [managing, setManaging] = useState(false);

  const updateChannel = (i: number, v: string) =>
    setChannelIds((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  const addChannel = () => setChannelIds((prev) => [...prev, ""]);
  const removeChannel = (i: number) => setChannelIds((prev) => prev.filter((_, idx) => idx !== i));
  const joinedChannels = channelIds
    .map((c) => c.trim())
    .filter(Boolean)
    .join(",");

  const openManage = (externalId: string | null) => {
    const current = (externalId ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    setChannelIds(current.length ? current : [""]);
    setBotToken("");
    setSlackCookie("");
    setManaging(true);
  };
  const cancelManage = () => {
    setManaging(false);
    setChannelIds([""]);
    setBotToken("");
    setSlackCookie("");
  };

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
          external_id: joinedChannels,
          access_token: botToken.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect Discord.");
      return json.platform as SafePlatform;
    },
    onSuccess: (p) => {
      toast.success(`Connected to ${p.name ?? "Discord"}.`);
      setBotToken("");
      setChannelIds([""]);
      setManaging(false);
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
          external_id: joinedChannels,
          access_token: botToken.trim(),
          refresh_token: slackCookie.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not connect Slack.");
      return json.platform as SafePlatform;
    },
    onSuccess: (p) => {
      toast.success(`Connected to ${p.name ?? "Slack"}.`);
      setBotToken("");
      setChannelIds([""]);
      setSlackCookie("");
      setManaging(false);
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
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isSlack ? (
              <SlackIcon className="size-5" />
            ) : (
              <HugeiconsIcon icon={icon} className="size-5" />
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
                      <Field>
                        <FieldLabel htmlFor="client-id">
                          <HugeiconsIcon icon={Key01Icon} className="size-3.5" />
                          Google Client ID
                        </FieldLabel>
                        <Input
                          id="client-id"
                          placeholder="Enter Google Client ID (optional if env set)"
                          value={channelId}
                          disabled={isDemo || connectGoogleOauth.isPending}
                          onChange={(e) => setChannelId(e.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="client-secret">
                          <HugeiconsIcon icon={Key01Icon} className="size-3.5" />
                          Google Client Secret
                        </FieldLabel>
                        <Input
                          id="client-secret"
                          type="password"
                          placeholder="Enter Google Client Secret (optional if env set)"
                          value={botToken}
                          disabled={isDemo || connectGoogleOauth.isPending}
                          onChange={(e) => setBotToken(e.target.value)}
                        />
                      </Field>
                    </div>

                    <ClassroomHelp />
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
                  {disconnect.isPending && <Spinner />}
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={isDemo || connectGoogleOauth.isPending}
                  onClick={() => connectGoogleOauth.mutate()}
                >
                  {connectGoogleOauth.isPending && <Spinner />}
                  Connect Google Classroom
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {(!connected || managing) && (
              <>
                {managing && (
                  <p className="text-xs text-muted-foreground">
                    Edit the channel list below, then re-enter your token to update. Tokens are
                    never stored in the browser, so they must be provided again.
                  </p>
                )}
                <div
                  className={cn("grid gap-3", type === "gemini" ? "grid-cols-1" : "sm:grid-cols-2")}
                >
                  <Field>
                    <FieldLabel htmlFor="bot-token">
                      <HugeiconsIcon icon={Key01Icon} className="size-3.5" />
                      {type === "gemini"
                        ? "Gemini API Key"
                        : isSlack
                          ? "Token (xoxc-...)"
                          : "User token"}
                    </FieldLabel>
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
                  </Field>
                  {isSlack && (
                    <Field>
                      <FieldLabel htmlFor="slack-cookie">
                        <HugeiconsIcon icon={Key01Icon} className="size-3.5" />d cookie (xoxd-...)
                      </FieldLabel>
                      <Input
                        id="slack-cookie"
                        type="password"
                        autoComplete="off"
                        placeholder="xoxd-..."
                        value={slackCookie}
                        disabled={isDemo || connectBot.isPending}
                        onChange={(e) => setSlackCookie(e.target.value)}
                      />
                    </Field>
                  )}
                </div>

                {type !== "gemini" && (
                  <Field>
                    <FieldLabel render={<span />} nativeLabel={false}>
                      <HugeiconsIcon icon={HashIcon} className="size-3.5" />
                      Channel IDs
                    </FieldLabel>
                    <div className="space-y-2">
                      {channelIds.map((cid, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder={isSlack ? "C12345678" : "123456789012345678"}
                            value={cid}
                            disabled={isDemo || connectBot.isPending}
                            onChange={(e) => updateChannel(i, e.target.value)}
                          />
                          {channelIds.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={isDemo || connectBot.isPending}
                              onClick={() => removeChannel(i)}
                              aria-label="Remove channel"
                            >
                              <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isDemo || connectBot.isPending}
                      onClick={addChannel}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" />
                      Add channel
                    </Button>
                  </Field>
                )}

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

                {type === "discord" && <DiscordHelp />}

                {type === "slack" && <SlackHelp />}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {managing ? (
                <>
                  <Button
                    disabled={
                      isDemo ||
                      connectBot.isPending ||
                      !botToken.trim() ||
                      (type !== "gemini" && !joinedChannels) ||
                      (isSlack && !slackCookie.trim())
                    }
                    onClick={() => connectBot.mutate()}
                  >
                    {connectBot.isPending && <Spinner />}
                    Update channels
                  </Button>
                  <Button variant="outline" disabled={connectBot.isPending} onClick={cancelManage}>
                    Cancel
                  </Button>
                </>
              ) : connected ? (
                <>
                  {(type === "discord" || type === "slack") && (
                    <Button
                      variant="outline"
                      disabled={isDemo}
                      onClick={() => openManage(platform?.external_id ?? null)}
                    >
                      Manage channels
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={isDemo || disconnect.isPending}
                    onClick={() => disconnect.mutate()}
                  >
                    {disconnect.isPending && <Spinner />}
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  disabled={
                    isDemo ||
                    connectBot.isPending ||
                    !botToken.trim() ||
                    (type !== "gemini" && !joinedChannels) ||
                    (isSlack && !slackCookie.trim())
                  }
                  onClick={() => connectBot.mutate()}
                >
                  {connectBot.isPending && <Spinner />}
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

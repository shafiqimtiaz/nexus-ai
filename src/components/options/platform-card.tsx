"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Hash, KeyRound, Loader2 } from "lucide-react";
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

type PlatformType = "google_classroom" | "discord";

type SafePlatform = {
  id: string;
  type: PlatformType;
  name: string | null;
  external_id: string | null;
  is_connected: boolean;
  last_synced_at: string | null;
};

async function fetchPlatforms(): Promise<SafePlatform[]> {
  const res = await fetch("/api/platforms");
  if (!res.ok) throw new Error("Failed to load platforms");
  const json = await res.json();
  return json.platforms ?? [];
}

function formatSynced(iso: string | null): string {
  if (!iso) return "never synced";
  return `last synced ${new Date(iso).toLocaleString()}`;
}

export function PlatformCard({
  type,
  displayName,
  description,
  icon: Icon,
  role,
}: {
  type: PlatformType;
  displayName: string;
  description: string;
  icon: LucideIcon;
  role: Role;
}) {
  const queryClient = useQueryClient();
  const isDemo = role === "demo";

  const [botToken, setBotToken] = useState("");
  const [channelId, setChannelId] = useState("");

  const { data: platforms, isLoading } = useQuery({
    queryKey: ["platforms"],
    queryFn: fetchPlatforms,
  });

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
            <Icon className="h-5 w-5" />
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
            {platform?.name ? `${platform.name} · ` : ""}
            {formatSynced(platform?.last_synced_at ?? null)}
          </p>
        )}

        {type === "google_classroom" ? (
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <Button
                variant="outline"
                disabled={isDemo || disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                {disconnect.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button
                disabled={isDemo}
                onClick={() => {
                  // TODO: wired by Task 1.2
                  window.location.href = "/api/auth/google";
                }}
              >
                Connect Google Classroom
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!connected && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="discord-token"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Bot token
                  </label>
                  <Input
                    id="discord-token"
                    type="password"
                    autoComplete="off"
                    placeholder="Bot token"
                    value={botToken}
                    disabled={isDemo || connectDiscord.isPending}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="discord-channel"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    Channel ID
                  </label>
                  <Input
                    id="discord-channel"
                    placeholder="123456789012345678"
                    value={channelId}
                    disabled={isDemo || connectDiscord.isPending}
                    onChange={(e) => setChannelId(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {connected ? (
                <Button
                  variant="outline"
                  disabled={isDemo || disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  {disconnect.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={
                    isDemo ||
                    connectDiscord.isPending ||
                    !botToken.trim() ||
                    !channelId.trim()
                  }
                  onClick={() => connectDiscord.mutate()}
                >
                  {connectDiscord.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Connect
                </Button>
              )}
            </div>
          </div>
        )}

        {isDemo && (
          <p className="text-xs text-muted-foreground">
            Log in to manage connections.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

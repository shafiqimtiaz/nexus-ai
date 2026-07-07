"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/auth";

type SettingsResponse = { aiRules: string; basePrompt: string };

async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to load AI rules");
  return res.json();
}

export function AiRulesCard({ role }: { role: Role }) {
  const isDemo = role === "demo";
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  const [rules, setRules] = useState("");
  const [showBase, setShowBase] = useState(false);

  // Sync the textarea once the saved rules arrive (and only then, so we never
  // clobber in-progress edits on refetch).
  useEffect(() => {
    if (data?.aiRules !== undefined) setRules(data.aiRules);
  }, [data?.aiRules]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiRules: rules }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save rules.");
      return json.aiRules as string;
    },
    onSuccess: () => {
      toast.success("AI rules saved.");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirty = data ? rules !== data.aiRules : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>AI Agent Rules</CardTitle>
            <CardDescription>
              Add your own rules for the Nexus agent. They&apos;re appended to the built-in rules
              below.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowBase((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showBase ? "Hide" : "Show"} current built-in rules
          </button>
          {showBase && (
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {data?.basePrompt ?? ""}
            </pre>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ai-rules" className="text-xs font-medium text-muted-foreground">
            Your additional rules
          </label>
          <textarea
            id="ai-rules"
            value={rules}
            disabled={isDemo || isLoading || save.isPending}
            onChange={(e) => setRules(e.target.value)}
            rows={6}
            placeholder={
              "e.g. Always answer in a formal tone.\nWhen I ask for a study plan, spread sessions across at least 3 days.\nNever schedule anything before 9am."
            }
            className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-75"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isDemo || isLoading || save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            {save.isPending && <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />}
            Save rules
          </Button>
          {rules.trim() && !dirty && !save.isPending && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        {isDemo && <p className="text-xs text-muted-foreground">Log in to edit AI rules.</p>}
      </CardContent>
    </Card>
  );
}

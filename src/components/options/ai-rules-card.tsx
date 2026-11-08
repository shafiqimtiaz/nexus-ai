"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type SettingsResponse = { aiRules: string; basePrompt: string };

async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Failed to load AI rules");
  return res.json();
}

export function AiRulesCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });

  // null = untouched, so the textarea shows the saved rules until the user edits.
  const [draft, setDraft] = useState<string | null>(null);
  const rules = draft ?? data?.aiRules ?? "";

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
      void queryClient.invalidateQueries({ queryKey: ["settings"] }).then(() => setDraft(null));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirty = data ? rules !== data.aiRules : false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HugeiconsIcon icon={SparklesIcon} className="size-5" />
          </span>
          <div>
            <CardTitle>Agent rules</CardTitle>
            <CardDescription>
              Add your own rules for the Nexus agent. They&apos;re appended to the built-in rules
              below.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Collapsible className="space-y-2">
          <CollapsibleTrigger
            render={
              <Button variant="link" size="sm" className="group/trigger h-auto p-0 text-xs" />
            }
          >
            Built-in rules
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="transition-transform group-data-panel-open/trigger:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="max-h-60 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {data?.basePrompt ?? ""}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        <Field>
          <FieldLabel htmlFor="ai-rules">Your additional rules</FieldLabel>
          <Textarea
            id="ai-rules"
            value={rules}
            disabled={isLoading || save.isPending}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder={
              "e.g. Always answer in a formal tone.\nWhen I ask for a study plan, spread sessions across at least 3 days.\nNever schedule anything before 9am."
            }
            className="min-h-32 resize-y"
          />
          <FieldDescription>Appended to the built-in rules every time you chat.</FieldDescription>
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isLoading || save.isPending || !dirty} onClick={() => save.mutate()}>
            {save.isPending && <Spinner />}
            Save rules
          </Button>
          {rules.trim() && !dirty && !save.isPending && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResourceCard } from "@/components/resources/resource-card";
import { ResourceForm } from "@/components/resources/resource-form";
import type { Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type Label = { id: string; name: string; color: string | null };

export type Resource = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  is_pinned: boolean;
  source_platform: string | null;
  created_at: string;
  labels: Label[];
};

async function fetchResources(
  q: string,
  label: string | null
): Promise<Resource[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (label) params.set("label", label);
  const qs = params.toString();
  const res = await fetch(`/api/resources${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load resources");
  const json = await res.json();
  return json.resources ?? [];
}

async function fetchLabels(): Promise<Label[]> {
  const res = await fetch("/api/labels");
  if (!res.ok) throw new Error("Failed to load labels");
  const json = await res.json();
  return json.labels ?? [];
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; resource: Resource }
  | null;

export function ResourcesView({ role }: { role: Role }) {
  const isOwner = role === "owner";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: fetchLabels,
  });

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources", debouncedSearch, activeLabel],
    queryFn: () => fetchResources(debouncedSearch, activeLabel),
  });

  const isFiltering = debouncedSearch.trim() !== "" || activeLabel !== null;

  const activeLabelName = useMemo(
    () => labels.find((l) => l.id === activeLabel)?.name ?? null,
    [labels, activeLabel]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="text-sm text-muted-foreground">
            Your links, notes, and references — labelled and searchable.
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="h-4 w-4" />
            Add resource
          </Button>
        )}
      </header>

      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources…"
            className="pl-8"
          />
        </div>

        {labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveLabel(null)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeLabel === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              All
            </button>
            {labels.map((label) => {
              const active = activeLabel === label.id;
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => setActiveLabel(active ? null : label.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label.color && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                  )}
                  {label.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      ) : resources.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {isFiltering
              ? activeLabelName
                ? `No matches for “${activeLabelName}”.`
                : "No matches."
              : isOwner
                ? "No resources yet — add your first link."
                : "No resources yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isOwner={isOwner}
              onEdit={() => setDialog({ mode: "edit", resource })}
            />
          ))}
        </div>
      )}

      {isOwner && dialog && (
        <ResourceForm
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          resource={dialog.mode === "edit" ? dialog.resource : null}
          labels={labels}
        />
      )}
    </div>
  );
}

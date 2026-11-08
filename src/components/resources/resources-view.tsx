"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpen01Icon, PlusSignIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/layout/page-header";
import { labelTone } from "@/components/resources/label-tone";
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

async function fetchResources(q: string, label: string | null): Promise<Resource[]> {
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

const ALL = "__all";

type DialogState = { mode: "create" } | { mode: "edit"; resource: Resource } | null;

export function ResourcesView({ role }: { role: Role }) {
  const canEdit = role === "owner" || role === "demo";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

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
      <PageHeader
        eyebrow="Library"
        title="Everything worth keeping"
        description="Your links, notes, and references. Labelled, searchable, and one click from the dashboard when pinned."
        actions={
          canEdit && (
            <Button onClick={() => setDialog({ mode: "create" })}>
              <HugeiconsIcon icon={PlusSignIcon} />
              Add resource
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <InputGroup className="max-w-md bg-card">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library…"
            aria-label="Search resources"
          />
        </InputGroup>

        {labels.length > 0 && (
          <ToggleGroup
            spacing={1}
            aria-label="Filter by label"
            className="w-full flex-wrap"
            value={[activeLabel ?? ALL]}
            onValueChange={(value) => {
              const next = value[0];
              if (next) setActiveLabel(next === ALL ? null : next);
            }}
          >
            {[{ id: ALL, name: "All", color: null as string | null }, ...labels].map((label) => (
              <ToggleGroupItem
                key={label.id}
                value={label.id}
                variant="outline"
                size="sm"
                className="rounded-full bg-card data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
              >
                {label.id !== ALL && (
                  <span className={cn("size-2 rounded-full", labelTone(label.color).dot)} />
                )}
                {label.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <Empty className="border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={BookOpen01Icon} />
            </EmptyMedia>
            <EmptyTitle>
              {isFiltering ? "Nothing matches that" : "Your library is empty"}
            </EmptyTitle>
            <EmptyDescription>
              {isFiltering
                ? activeLabelName
                  ? `No resources labelled “${activeLabelName}” match your search.`
                  : "Try a different search term or clear the filters."
                : canEdit
                  ? "Save syllabi, slide decks, and study guides here so they are one click away."
                  : "Nothing has been saved yet."}
            </EmptyDescription>
          </EmptyHeader>
          {!isFiltering && canEdit && (
            <EmptyContent>
              <Button onClick={() => setDialog({ mode: "create" })}>
                <HugeiconsIcon icon={PlusSignIcon} />
                Add your first link
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              canEdit={canEdit}
              onEdit={() => setDialog({ mode: "edit", resource })}
            />
          ))}
        </div>
      )}

      {canEdit && dialog && (
        <ResourceForm
          key={dialog.mode === "edit" ? dialog.resource.id : "create"}
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

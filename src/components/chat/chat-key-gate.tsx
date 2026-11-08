"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

export function DemoKeyForm({ onSave }: { onSave: (key: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <Empty className="border bg-card">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Key01Icon} />
        </EmptyMedia>
        <EmptyTitle className="text-xl">Bring your own Gemini key</EmptyTitle>
        <EmptyDescription>
          Demo mode. Paste a Gemini API key to try the agent. It stays in this browser and is sent
          with your requests, never saved on the server. Get a free key at{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Google AI Studio
          </a>
          .
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-md">
        <form
          className="flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(value);
          }}
        >
          <Input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza…"
            aria-label="Gemini API key"
            autoComplete="off"
          />
          <Button type="submit" disabled={!value.trim()}>
            Save key
          </Button>
        </form>
      </EmptyContent>
    </Empty>
  );
}

export function MissingKeyNotice() {
  return (
    <Empty className="border bg-card">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon" className="bg-destructive/10 text-destructive">
          <HugeiconsIcon icon={Key01Icon} />
        </EmptyMedia>
        <EmptyTitle className="text-xl">Gemini API key required</EmptyTitle>
        <EmptyDescription>
          Connect Google Gemini on the <span className="font-medium text-foreground">Settings</span>{" "}
          page, or set the <code className="rounded bg-muted px-1 font-mono">GEMINI_API_KEY</code>{" "}
          environment variable on your server.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button render={<Link href="/options" />} nativeButton={false}>
          Configure API key
        </Button>
      </EmptyContent>
    </Empty>
  );
}

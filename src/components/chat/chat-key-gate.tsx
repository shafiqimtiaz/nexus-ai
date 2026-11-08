"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DemoKeyForm({ onSave }: { onSave: (key: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-4 rounded-xl border border-dashed bg-card p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HugeiconsIcon icon={Key01Icon} className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Add your Gemini API key</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Demo mode. Paste a Gemini API key to try the agent — it&apos;s stored only in this browser
          and sent with your requests, never saved on the server. Get a free key at{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Google AI Studio
          </a>
          .
        </p>
      </div>
      <form
        className="flex w-full max-w-md gap-2"
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
          className="h-10"
        />
        <Button type="submit" disabled={!value.trim()} className="h-10 cursor-pointer">
          Save
        </Button>
      </form>
    </div>
  );
}

export function MissingKeyNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center space-y-4 rounded-xl border border-dashed bg-card p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <HugeiconsIcon icon={Key01Icon} className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Gemini API key required</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect Google Gemini on the <span className="font-medium text-foreground">Options</span>{" "}
          page, or set the <code className="rounded bg-muted px-1 font-mono">GEMINI_API_KEY</code>{" "}
          environment variable on your server.
        </p>
      </div>
      <Button render={<Link href="/options" />} nativeButton={false} className="cursor-pointer">
        Configure API key
      </Button>
    </div>
  );
}

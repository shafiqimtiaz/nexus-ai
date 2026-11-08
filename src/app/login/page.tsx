"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  AiMagicIcon,
  Calendar03Icon,
  GoogleIcon,
  Notification03Icon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Brand } from "@/components/layout/brand";

const HIGHLIGHTS: { icon: IconSvgElement; text: string }[] = [
  { icon: Notification03Icon, text: "Classroom, Discord, and Slack announcements in one feed" },
  { icon: Calendar03Icon, text: "Exams and deadlines land on your calendar automatically" },
  { icon: AiMagicIcon, text: "An agent that plans study time around your real schedule" },
];

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);

    const hasSupabase = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    );

    if (hasSupabase) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin + "/api/auth/callback",
          },
        });
        if (authError) throw authError;
      } catch (err) {
        setError((err instanceof Error && err.message) || "Failed to initiate Google sign in");
        setLoading(false);
      }
    } else {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "owner@nexus.edu", password: "mock" }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Mock login failed");
        setLoading(false);
      }
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center lg:min-h-[calc(100dvh-4rem)]">
      <div className="grid overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-foreground/10 lg:grid-cols-[1.1fr_1fr]">
        <section className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-highlight/20 blur-3xl"
          />
          <Brand className="relative" />
          <div className="relative space-y-6">
            <h1 className="max-w-sm text-4xl leading-[1.1] font-semibold tracking-tight text-sidebar-accent-foreground">
              Your whole semester, in one calm place.
            </h1>
            <ul className="space-y-3 text-sm text-sidebar-foreground/80">
              {HIGHLIGHTS.map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-primary">
                    <HugeiconsIcon icon={icon} className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-col justify-center gap-6 p-6 sm:p-10">
          <Brand className="lg:hidden" />
          <div className="space-y-1.5">
            <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to sync your classes, or take a look around in demo mode first.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <HugeiconsIcon icon={Alert02Icon} />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <Button
              type="button"
              size="lg"
              className="h-11 w-full text-sm"
              disabled={loading}
              onClick={handleGoogleLogin}
            >
              {loading ? <Spinner /> : <HugeiconsIcon icon={GoogleIcon} />}
              {loading ? "Connecting…" : "Continue with Google"}
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
              <Separator className="flex-1" />
              or
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full text-sm"
              disabled={loading}
              onClick={() => {
                router.push("/");
              }}
            >
              Explore the read-only demo
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

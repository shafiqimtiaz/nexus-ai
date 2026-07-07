"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      } catch (err: any) {
        setError(err.message || "Failed to initiate Google sign in");
        setLoading(false);
      }
    } else {
      // Mock login for offline/dev environment
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm border border-border/40 shadow-xl bg-card/60 backdrop-blur-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription>
            Access your academic workspace, announcements, calendar, and AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm rounded bg-destructive/10 border border-destructive/20 text-destructive">
              {error}
            </div>
          )}

          <Button
            type="button"
            className="w-full py-6 flex items-center justify-center gap-2 cursor-pointer font-medium text-base shadow-sm hover:scale-[1.01] transition-transform"
            disabled={loading}
            onClick={handleGoogleLogin}
          >
            <svg
              className="h-5 w-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            {loading ? "Connecting..." : "Sign in with Google"}
          </Button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border/40" />
            <span className="flex-shrink mx-4 text-xs text-muted-foreground uppercase">Or</span>
            <div className="flex-grow border-t border-border/40" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full py-5 flex items-center justify-center gap-2 cursor-pointer font-normal border-border/60 hover:bg-muted"
            disabled={loading}
            onClick={() => {
              router.push("/");
            }}
          >
            Browse in Demo Mode (Read-only)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

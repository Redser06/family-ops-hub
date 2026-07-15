import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type AuthSearch = { next?: string; invite?: string };
export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    next: typeof s.next === "string" ? s.next : undefined,
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next, invite } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: next ?? "/today", replace: true });
    });
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm, or sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const dest = invite ? `/invite/${invite}` : (next ?? "/today");
        navigate({ to: dest, replace: true });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    const dest = invite ? `/invite/${invite}` : (next ?? "/today");
    navigate({ to: dest, replace: true });
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="size-8 rounded-lg bg-sage" />
            <span className="font-display text-lg font-semibold">Family Ops Board</span>
          </Link>
          <h1 className="font-display italic text-3xl text-sage font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-charcoal/60 mt-2">
            {mode === "signin"
              ? "Sign in to see today's board."
              : "You'll be able to create or join a household next."}
          </p>
        </div>

        <div className="bg-white border border-border-subtle rounded-3xl p-6 shadow-sm space-y-5">
          <button
            type="button"
            onClick={signInGoogle}
            disabled={loading}
            className="w-full h-12 rounded-xl border border-border-subtle bg-base text-charcoal font-medium text-sm hover:bg-surface transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-charcoal/40">
              or with email
            </span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                required
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
            )}
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90 transition-colors disabled:opacity-50"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-xs text-charcoal/60 hover:text-charcoal transition-colors"
          >
            {mode === "signin"
              ? "New here? Create an account →"
              : "Already have an account? Sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

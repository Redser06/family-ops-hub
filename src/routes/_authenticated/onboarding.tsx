import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Our Household");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);

  async function createHousehold() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_household", { _name: name });
      if (error) throw error;
      toast.success("Household ready");
      await queryClient.invalidateQueries({ queryKey: ["membership"] });
      navigate({ to: "/today", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create household");
    } finally {
      setLoading(false);
    }
  }

  async function joinHousehold() {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("accept_household_invite", { _token: token.trim() });
      if (error) throw error;
      toast.success("Joined household");
      await queryClient.invalidateQueries({ queryKey: ["membership"] });
      navigate({ to: "/today", replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Could not accept invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <p className="text-xs uppercase tracking-widest text-clay font-semibold mb-3 text-center">
          One step to go
        </p>
        <h1 className="font-display italic text-4xl text-sage font-semibold text-center mb-2">
          Set up your household
        </h1>
        <p className="text-sm text-charcoal/60 text-center mb-8">
          Create a new household, or join one you've been invited to.
        </p>

        <div className="bg-white border border-border-subtle rounded-3xl p-6 shadow-sm">
          <div className="flex gap-2 p-1 bg-surface rounded-xl mb-6">
            <button
              onClick={() => setMode("create")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "create" ? "bg-white text-charcoal shadow-sm" : "text-charcoal/60"
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setMode("join")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === "join" ? "bg-white text-charcoal shadow-sm" : "text-charcoal/60"
              }`}
            >
              Join
            </button>
          </div>

          {mode === "create" ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                  Household name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
                />
              </label>
              <p className="text-xs text-charcoal/50">
                We'll seed three starter routines you can edit later.
              </p>
              <button
                onClick={createHousehold}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90 transition-colors disabled:opacity-50"
              >
                Create household
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/60">
                  Invite code
                </span>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your invite code"
                  className="mt-2 w-full h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40 font-mono"
                />
              </label>
              <button
                onClick={joinHousehold}
                disabled={loading || !token.trim()}
                className="w-full h-12 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90 transition-colors disabled:opacity-50"
              >
                Join household
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

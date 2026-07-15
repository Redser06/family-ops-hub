import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// TanStack Router escapes literal dots in URL segments with [.]. Do NOT rename to
// .lovable.oauth.consent.tsx — the router generator hides dotfiles.
export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await (supabase.auth as any).oauth.getAuthorizationDetails(
      authorizationId,
    );
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <p className="font-display italic text-clay text-2xl">
          Could not load this authorization
        </p>
        <p className="text-sm text-charcoal/60 mt-2">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details: any = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const anyAuth = supabase.auth as any;
    const { data, error } = approve
      ? await anyAuth.oauth.approveAuthorization(authorization_id)
      : await anyAuth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an AI assistant";

  return (
    <main className="min-h-screen bg-base grid place-items-center px-6">
      <div className="max-w-md w-full bg-white border border-border-subtle rounded-3xl p-8 shadow-sm">
        <p className="text-xs uppercase tracking-widest text-clay font-semibold mb-3">
          Agent access
        </p>
        <h1 className="font-display italic text-3xl text-sage font-semibold mb-3">
          Connect {clientName} to your household
        </h1>
        <p className="text-sm text-charcoal/70 mb-4">
          {clientName} will be able to call this app's tools while signed in as you. Every
          action it takes appears in the Activity feed alongside your own.
        </p>
        <p className="text-xs text-charcoal/50 mb-6">
          This does not bypass your household's permissions.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive mb-4">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 h-12 rounded-xl border border-border-subtle text-sm font-medium hover:bg-surface disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 h-12 rounded-xl bg-sage text-sage-foreground text-sm font-medium hover:bg-sage/90 disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>
    </main>
  );
}

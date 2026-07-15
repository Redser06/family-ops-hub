import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, householdMembersQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const householdName = (membership?.households as any)?.name ?? "Our Household";
  const { data: members = [] } = useQuery(householdMembersQuery(householdId));
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [invite, setInvite] = useState<{ token: string } | null>(null);
  const [connections, setConnections] = useState<any[]>([]);

  async function createInvite() {
    if (!householdId || !inviteEmail.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("household_invites")
      .insert({
        household_id: householdId,
        email: inviteEmail.trim(),
        invited_by: userData.user?.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setInvite({ token: data.token });
    setInviteEmail("");
    toast.success("Invite created");
  }

  async function loadConnections() {
    if (!householdId) return;
    const { data } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("household_id", householdId);
    setConnections(data ?? []);
  }

  // load on mount
  if (householdId && connections.length === 0) {
    void loadConnections();
  }

  function copyInvite() {
    if (!invite) return;
    navigator.clipboard.writeText(invite.token);
    toast.success("Invite code copied");
  }

  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/mcp` : "/mcp";

  return (
    <div className="p-6 lg:p-10 max-w-3xl space-y-8">
      <PageHeader householdId={householdId} eyebrow="Household" title="Settings" />

      <section className="p-6 rounded-3xl bg-white border border-border-subtle shadow-sm">
        <h2 className="font-display italic text-2xl text-sage font-semibold mb-1">
          {householdName}
        </h2>
        <p className="text-sm text-charcoal/60 mb-5">Members with access to this board.</p>
        <div className="space-y-2 mb-6">
          {members.map((m: any) => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border-subtle"
            >
              <div className="size-9 rounded-full bg-sage/10 text-sage grid place-items-center text-sm font-semibold">
                {(m.profiles?.display_name || m.profiles?.email || "?")[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">
                  {m.profiles?.display_name || m.profiles?.email}
                </p>
                <p className="text-xs text-charcoal/50 truncate">{m.profiles?.email}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-clay">
                {m.role}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border-subtle pt-5">
          <h3 className="text-sm font-semibold text-charcoal mb-3">Invite another adult</h3>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              placeholder="partner@example.com"
              className="flex-1 h-11 rounded-xl border border-border-subtle bg-base px-4 text-sm"
            />
            <button
              onClick={createInvite}
              className="h-11 px-5 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90"
            >
              Create invite
            </button>
          </div>
          {invite && (
            <div className="mt-3 p-3 rounded-xl bg-clay/5 border border-clay/20 flex items-center gap-2">
              <code className="text-xs font-mono flex-1 truncate">{invite.token}</code>
              <button
                onClick={copyInvite}
                className="text-xs font-semibold text-clay uppercase inline-flex items-center gap-1"
              >
                <Copy className="size-3.5" /> Copy
              </button>
            </div>
          )}
          <p className="text-xs text-charcoal/50 mt-2">
            Share this code with the invited person. They'll paste it during onboarding.
          </p>
        </div>
      </section>

      <section className="p-6 rounded-3xl bg-white border border-border-subtle shadow-sm">
        <h3 className="font-display italic text-xl text-sage font-semibold mb-1">
          Google Calendar
        </h3>
        <p className="text-sm text-charcoal/60 mb-5">
          Sync your shared household calendar. V1 supports one shared calendar; more
          calendars come in V2.
        </p>
        {connections.length === 0 ? (
          <div className="p-5 rounded-2xl bg-surface border border-dashed border-border-subtle text-sm text-charcoal/60">
            <p className="mb-3">
              Google Calendar connection isn't wired in this preview yet. When enabled, you'll
              connect a shared calendar and events will appear in Today and Week.
            </p>
            <button
              disabled
              className="h-10 px-4 rounded-xl bg-charcoal/10 text-charcoal/40 text-sm font-medium cursor-not-allowed"
            >
              Connect Google Calendar (coming soon)
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-surface border border-border-subtle flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.google_account_email ?? "Google Calendar"}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-charcoal/50">
                    {c.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="p-6 rounded-3xl bg-white border border-border-subtle shadow-sm">
        <h3 className="font-display italic text-xl text-sage font-semibold mb-1">
          Agent access (MCP)
        </h3>
        <p className="text-sm text-charcoal/60 mb-5">
          Connect Claude, ChatGPT, or another MCP-capable assistant. Each connection signs in
          as you, so RLS applies and every change is logged in Activity.
        </p>
        <div className="p-4 rounded-xl bg-surface border border-border-subtle">
          <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/60 mb-2">
            MCP server URL
          </p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono flex-1 truncate">{mcpUrl}</code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mcpUrl);
                toast.success("Copied");
              }}
              className="text-xs font-semibold text-sage uppercase inline-flex items-center gap-1"
            >
              <Copy className="size-3.5" /> Copy
            </button>
          </div>
        </div>
        <p className="text-xs text-charcoal/50 mt-3">
          MCP works after publishing your app. Add this URL as a connector in Claude/ChatGPT
          and sign in — the assistant will act as your account.
        </p>
        <a
          href="https://modelcontextprotocol.io/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-clay uppercase"
        >
          Learn about MCP <ExternalLink className="size-3" />
        </a>
      </section>
    </div>
  );
}

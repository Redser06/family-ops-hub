import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { membershipQuery, householdMembersQuery } from "@/lib/queries";
import { googleCalendarStatusQuery } from "@/lib/googleCalendarQueries";
import {
  startGoogleCalendarConnect,
  saveGoogleCalendarConnection,
  disconnectGoogleCalendar,
} from "@/lib/googleCalendar.functions";
import { connectAppUser } from "@/integrations/lovable/appUserConnectorClient";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Copy, ExternalLink, CheckCircle2 } from "lucide-react";
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


  function copyInvite() {
    if (!invite) return;
    navigator.clipboard.writeText(invite.token);
    toast.success("Invite code copied");
  }

  // Google Calendar (per-user App User Connector)
  const gcalStatus = useQuery(googleCalendarStatusQuery);
  const startConnectFn = useServerFn(startGoogleCalendarConnect);
  const saveConnFn = useServerFn(saveGoogleCalendarConnection);
  const disconnectFn = useServerFn(disconnectGoogleCalendar);

  const connectGcal = useMutation({
    mutationFn: async () => {
      const result = await connectAppUser({
        connectorId: "google_calendar",
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        start: async (targetOrigin) => await startConnectFn({ data: targetOrigin }),
      });
      if (!result.success) throw new Error(result.error ?? "Connection failed");
      if (result.connectionAPIKey) {
        await saveConnFn({ data: { connectionAPIKey: result.connectionAPIKey } });
      }
    },
    onSuccess: () => {
      toast.success("Google Calendar connected");
      queryClient.invalidateQueries({ queryKey: ["google-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      queryClient.invalidateQueries({ queryKey: ["week"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to connect"),
  });

  const disconnectGcal = useMutation({
    mutationFn: async () => {
      await disconnectFn();
    },
    onSuccess: () => {
      toast.success("Google Calendar disconnected");
      queryClient.invalidateQueries({ queryKey: ["google-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["today"] });
      queryClient.invalidateQueries({ queryKey: ["week"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to disconnect"),
  });


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
          Connect your Google account so events show up on Today and Week. Each adult
          connects their own calendar — we only request read access.
        </p>
        {gcalStatus.isLoading ? (
          <div className="p-5 rounded-2xl bg-surface border border-border-subtle text-sm text-charcoal/60">
            Checking connection…
          </div>
        ) : gcalStatus.data?.connected ? (
          <div className="p-4 rounded-2xl bg-sage/5 border border-sage/30 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-sage shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal truncate">
                {gcalStatus.data.email ?? "Google Calendar connected"}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-sage">
                Read-only · Primary calendar
              </p>
            </div>
            <button
              onClick={() => disconnectGcal.mutate()}
              disabled={disconnectGcal.isPending}
              className="h-9 px-4 rounded-xl bg-white border border-border-subtle text-xs font-semibold text-charcoal hover:bg-surface disabled:opacity-50"
            >
              {disconnectGcal.isPending ? "…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-surface border border-dashed border-border-subtle">
            <p className="text-sm text-charcoal/70 mb-3">
              Not connected. Your primary Google Calendar events will appear on Today and
              Week once you sign in.
            </p>
            <button
              onClick={() => connectGcal.mutate()}
              disabled={connectGcal.isPending}
              className="h-10 px-5 rounded-xl bg-sage text-sage-foreground text-sm font-medium hover:bg-sage/90 disabled:opacity-50"
            >
              {connectGcal.isPending ? "Opening Google…" : "Connect Google Calendar"}
            </button>
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

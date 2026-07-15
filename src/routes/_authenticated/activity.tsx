import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { membershipQuery, activityQuery } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { formatDistanceToNow } from "date-fns";
import { Bot, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data: rows = [] } = useQuery(activityQuery(householdId));

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader householdId={householdId} eyebrow="History" title="Activity" />

      <div className="relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-border-subtle" />
        <div className="space-y-5 relative">
          {rows.map((a: any) => (
            <div key={a.id} className="flex gap-4">
              <div
                className={`size-8 rounded-full grid place-items-center shrink-0 ${
                  a.actor_type === "mcp"
                    ? "bg-clay/10 text-clay"
                    : "bg-sage/10 text-sage"
                }`}
              >
                {a.actor_type === "mcp" ? (
                  <Bot className="size-3.5" />
                ) : (
                  <UserIcon className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-charcoal">
                  {a.actor_type === "mcp"
                    ? a.actor_client_name || "AI assistant"
                    : "Household member"}
                  <span className="ml-2 text-[10px] uppercase tracking-widest text-charcoal/40">
                    {a.action} · {a.entity_type}
                  </span>
                </p>
                <p className="text-sm text-charcoal/70">{a.summary}</p>
                <span className="text-[10px] uppercase tracking-widest text-charcoal/40 mt-1 inline-block">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-charcoal/50 pl-12">No activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

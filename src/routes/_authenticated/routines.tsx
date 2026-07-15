import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { membershipQuery, routinesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { ensureRoutineInstance, logActivity } from "@/lib/mutations";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/routines")({
  component: RoutinesPage,
});

function RoutinesPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data } = useQuery(routinesQuery(householdId));
  const queryClient = useQueryClient();

  async function toggle(routineId: string, stepId: string, stepTitle: string, done: boolean) {
    if (!householdId) return;
    const instanceId = await ensureRoutineInstance(routineId, householdId);
    const { data: userData } = await supabase.auth.getUser();
    if (done) {
      await supabase
        .from("routine_step_completions")
        .delete()
        .eq("instance_id", instanceId)
        .eq("step_id", stepId);
    } else {
      await supabase.from("routine_step_completions").insert({
        instance_id: instanceId,
        step_id: stepId,
        completed_by: userData.user?.id,
      });
      await logActivity({
        householdId,
        action: "complete",
        entityType: "routine_step",
        entityId: stepId,
        summary: `Completed "${stepTitle}"`,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["routines", householdId] });
  }

  const routines = data?.routines ?? [];
  const instances = data?.instances ?? [];
  const completions = data?.completions ?? [];

  return (
    <div className="p-6 lg:p-10">
      <PageHeader householdId={householdId} eyebrow="Repeating rhythms" title="Routines" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {routines.map((r: any) => {
          const steps = (r.routine_steps ?? []).sort(
            (a: any, b: any) => a.order_index - b.order_index,
          );
          const inst = instances.find((i: any) => i.routine_id === r.id);
          const doneIds = new Set(
            completions.filter((c: any) => c.instance_id === inst?.id).map((c: any) => c.step_id),
          );
          return (
            <div
              key={r.id}
              className="p-6 rounded-3xl bg-white border border-border-subtle shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-clay">
                    {r.cadence}
                  </p>
                  <h3 className="font-display italic text-2xl font-semibold text-sage">
                    {r.name}
                  </h3>
                </div>
                <span className="text-xs text-charcoal/50">
                  {doneIds.size} / {steps.length}
                </span>
              </div>
              <ul className="space-y-2">
                {steps.map((s: any) => {
                  const done = doneIds.has(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => toggle(r.id, s.id, s.title, done)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors text-left"
                      >
                        <div
                          className={`size-5 rounded border-2 grid place-items-center shrink-0 ${
                            done ? "bg-sage border-sage" : "border-border-subtle"
                          }`}
                        >
                          {done && <div className="size-2 bg-sage-foreground rounded-sm" />}
                        </div>
                        <span
                          className={`text-sm ${done ? "line-through text-charcoal/40" : "text-charcoal"}`}
                        >
                          {s.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

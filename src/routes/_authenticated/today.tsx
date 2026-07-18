import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, todayOverviewQuery, startOfTodayISO, endOfTodayISO } from "@/lib/queries";
import { googleCalendarEventsQuery } from "@/lib/googleCalendarQueries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, ensureRoutineInstance } from "@/lib/mutations";
import { format, formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Bot, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/today")({
  component: TodayPage,
});

function TodayPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data } = useQuery(todayOverviewQuery(householdId));
  const queryClient = useQueryClient();
  const [quickTask, setQuickTask] = useState("");

  async function addQuickTask() {
    if (!quickTask.trim() || !householdId) return;
    const title = quickTask.trim();
    setQuickTask("");
    const { data: userData } = await supabase.auth.getUser();
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        household_id: householdId,
        title,
        created_by: userData.user?.id ?? null,
        source: "ui",
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity({
      householdId,
      action: "create",
      entityType: "task",
      entityId: task.id,
      summary: `Added "${title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ["today", householdId] });
  }

  async function completeTask(taskId: string, title: string) {
    if (!householdId) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: userData.user?.id ?? null,
      })
      .eq("id", taskId);
    await logActivity({
      householdId,
      action: "complete",
      entityType: "task",
      entityId: taskId,
      summary: `Completed "${title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ["today", householdId] });
  }

  async function toggleRoutineStep(routineId: string, stepId: string, done: boolean) {
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
        completed_by: userData.user?.id ?? null,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["today", householdId] });
  }

  const tasks = data?.tasks ?? [];
  const events = data?.events ?? [];
  const routines = data?.routines ?? [];
  const activity = data?.activity ?? [];
  const stepComps = data?.stepCompletions ?? [];
  const instances = data?.instances ?? [];

  // Merge events + tasks with due_at today for the agenda
  const agendaItems = [
    ...events.map((e: any) => ({
      kind: "event" as const,
      id: e.id,
      title: e.title,
      time: e.start_at,
      subtitle: e.location || e.description || null,
    })),
    ...tasks
      .filter((t: any) => t.due_at)
      .map((t: any) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        time: t.due_at,
        subtitle: null as string | null,
      })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const quickTasks = tasks.filter((t: any) => !t.due_at).slice(0, 6);

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        householdId={householdId}
        eyebrow={format(new Date(), "EEEE, MMM d")}
        title={`Good ${greetingHour()}`}
      />

      <div className="grid grid-cols-12 gap-6 lg:gap-8">
        {/* Left: Agenda + Quick tasks */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          <section>
            <h2 className="font-display text-xl mb-4 flex items-center gap-2 text-charcoal">
              <span className="size-2 rounded-full bg-sage" />
              Today's Agenda
            </h2>
            <div className="space-y-3">
              {agendaItems.length === 0 ? (
                <div className="p-6 rounded-2xl bg-surface border border-border-subtle text-sm text-charcoal/60">
                  Nothing scheduled today. Enjoy the calm.
                </div>
              ) : (
                agendaItems.map((item) => (
                  <div
                    key={item.kind + item.id}
                    className={`p-4 rounded-2xl border border-border-subtle ${
                      item.kind === "event" ? "bg-white shadow-sm" : "bg-surface"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            item.kind === "event" ? "text-sage" : "text-clay"
                          }`}
                        >
                          {format(new Date(item.time), "h:mm a")}
                        </span>
                        <p className="font-semibold text-charcoal truncate">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-sm text-charcoal/60 truncate">{item.subtitle}</p>
                        )}
                      </div>
                      {item.kind === "event" && (
                        <span className="text-[10px] bg-sage/10 text-sage px-2 py-0.5 rounded-full shrink-0">
                          Calendar
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl mb-4 text-charcoal">Quick Tasks</h2>
            <div className="space-y-2">
              {quickTasks.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => completeTask(t.id, t.title)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border-subtle hover:bg-white transition-colors text-left"
                >
                  <div className="size-5 rounded-full border-2 border-border-subtle shrink-0" />
                  <span className="text-sm font-medium text-charcoal/80 flex-1 min-w-0 truncate">
                    {t.title}
                  </span>
                  {t.priority === "important" && (
                    <span className="text-[10px] uppercase font-bold text-clay shrink-0">!</span>
                  )}
                </button>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addQuickTask();
                }}
                className="flex items-center gap-2 p-1 rounded-xl border-2 border-dashed border-border-subtle"
              >
                <div className="size-9 rounded-lg bg-surface grid place-items-center text-charcoal/50 shrink-0">
                  <Plus className="size-4" />
                </div>
                <input
                  value={quickTask}
                  onChange={(e) => setQuickTask(e.target.value)}
                  placeholder="Quick capture… e.g. Pack nursery bag"
                  className="flex-1 bg-transparent text-sm h-10 px-1 focus:outline-none placeholder:text-charcoal/40"
                />
                {quickTask && (
                  <button
                    type="submit"
                    className="text-xs font-semibold text-sage uppercase tracking-wide px-3 shrink-0"
                  >
                    Add
                  </button>
                )}
              </form>
            </div>
          </section>
        </div>

        {/* Center: Routines */}
        <div className="col-span-12 lg:col-span-5">
          <h2 className="font-display italic text-xl mb-4 text-charcoal">Daily Routines</h2>
          <div className="grid grid-cols-2 gap-4">
            {routines.length === 0 && (
              <div className="col-span-2 p-6 rounded-3xl bg-surface border border-border-subtle text-sm text-charcoal/60">
                No routines yet. Create some in{" "}
                <Link to="/routines" className="text-sage font-medium underline">
                  Routines
                </Link>
                .
              </div>
            )}
            {routines.map((r: any, idx: number) => {
              const steps = (r.routine_steps ?? []).sort(
                (a: any, b: any) => a.order_index - b.order_index,
              );
              const instance = instances.find((i: any) => i.routine_id === r.id);
              const doneStepIds = new Set(
                stepComps
                  .filter((c: any) => c.instance_id === instance?.id)
                  .map((c: any) => c.step_id),
              );
              const done = doneStepIds.size;
              const total = steps.length;
              const isHero = idx === 0;
              if (isHero) {
                return (
                  <div
                    key={r.id}
                    className="col-span-2 p-6 rounded-3xl bg-sage text-sage-foreground shadow-lg"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-2">
                      Current Routine
                    </p>
                    <h3 className="text-2xl font-display font-semibold mb-4">{r.name}</h3>
                    <ul className="space-y-2.5">
                      {steps.map((s: any) => {
                        const isDone = doneStepIds.has(s.id);
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => toggleRoutineStep(r.id, s.id, isDone)}
                              className="w-full flex items-center gap-3 text-sm text-left hover:opacity-100 py-1 opacity-95"
                            >
                              <div
                                className={`size-5 rounded border border-white/40 grid place-items-center shrink-0 ${
                                  isDone ? "bg-white/90" : ""
                                }`}
                              >
                                {isDone && (
                                  <div className="size-2 bg-sage rounded-sm" />
                                )}
                              </div>
                              <span className={isDone ? "line-through opacity-60" : ""}>
                                {s.title}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-5 text-xs uppercase tracking-widest opacity-70">
                      {done} / {total} complete
                    </div>
                  </div>
                );
              }
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Link
                  key={r.id}
                  to="/routines"
                  className="p-5 rounded-3xl bg-surface border border-border-subtle hover:bg-white transition-colors"
                >
                  <h4 className="font-display font-semibold mb-1 text-charcoal">{r.name}</h4>
                  <p className="text-xs text-charcoal/50 mb-4">
                    {done} of {total} steps
                  </p>
                  <div className="w-full bg-border-subtle h-1.5 rounded-full">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        idx === 1 ? "bg-sage" : "bg-clay"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 p-8 rounded-3xl bg-surface border border-border-subtle flex items-center gap-4">
            <Sparkles className="size-7 text-clay shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="font-display font-semibold text-charcoal">
                Ask Claude or ChatGPT to update the board
              </p>
              <p className="text-sm text-charcoal/60">
                Connect an assistant in{" "}
                <Link to="/settings" className="text-sage font-medium underline">
                  Settings → Agent access
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right: Activity feed */}
        <div className="col-span-12 lg:col-span-3">
          <h2 className="font-display text-xl mb-4 text-charcoal">Activity</h2>
          <div className="relative">
            <div className="absolute left-4 top-1 bottom-1 w-px bg-border-subtle" />
            <div className="space-y-5 relative">
              {activity.length === 0 && (
                <div className="text-sm text-charcoal/50 pl-12">
                  No activity yet — changes will appear here in real time.
                </div>
              )}
              {activity.map((a: any) => (
                <div key={a.id} className="flex gap-4 relative">
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
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-charcoal">
                      {a.actor_type === "mcp"
                        ? a.actor_client_name || "AI assistant"
                        : "Someone"}
                    </p>
                    <p className="text-sm text-charcoal/70">{a.summary}</p>
                    <span className="text-[10px] text-charcoal/40 uppercase mt-1 inline-block">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function greetingHour() {
  const h = new Date().getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

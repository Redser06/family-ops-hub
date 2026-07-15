import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, tasksQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/mutations";
import { PageHeader } from "@/components/PageHeader";
import { format } from "date-fns";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data: tasks = [] } = useQuery(tasksQuery(householdId));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "important">("normal");
  const [due, setDue] = useState<string>("");

  async function add() {
    if (!title.trim() || !householdId) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        household_id: householdId,
        title: title.trim(),
        priority,
        due_at: due ? new Date(due).toISOString() : null,
        created_by: userData.user?.id ?? null,
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
      entityId: data.id,
      summary: `Added "${title.trim()}"`,
    });
    setTitle("");
    setDue("");
    setPriority("normal");
    queryClient.invalidateQueries({ queryKey: ["tasks", householdId] });
  }

  async function toggleDone(t: any) {
    if (!householdId) return;
    const done = t.status === "done";
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("tasks")
      .update({
        status: done ? "open" : "done",
        completed_at: done ? null : new Date().toISOString(),
        completed_by: done ? null : userData.user?.id,
      })
      .eq("id", t.id);
    await logActivity({
      householdId,
      action: done ? "reopen" : "complete",
      entityType: "task",
      entityId: t.id,
      summary: `${done ? "Reopened" : "Completed"} "${t.title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ["tasks", householdId] });
  }

  async function del(t: any) {
    if (!householdId) return;
    await supabase.from("tasks").delete().eq("id", t.id);
    await logActivity({
      householdId,
      action: "delete",
      entityType: "task",
      entityId: t.id,
      summary: `Deleted "${t.title}"`,
    });
    queryClient.invalidateQueries({ queryKey: ["tasks", householdId] });
  }

  const filtered = tasks.filter((t: any) =>
    filter === "all" ? true : filter === "done" ? t.status === "done" : t.status !== "done",
  );

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      <PageHeader householdId={householdId} eyebrow="Everything" title="Tasks" />

      <div className="bg-white border border-border-subtle rounded-3xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen?"
            className="flex-1 h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="h-12 rounded-xl border border-border-subtle bg-base px-3 text-sm"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="important">Important</option>
          </select>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-12 rounded-xl border border-border-subtle bg-base px-3 text-sm"
          />
          <button
            onClick={add}
            className="h-12 px-5 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90 inline-flex items-center gap-2"
          >
            <Plus className="size-4" />
            Add
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide ${
              filter === f ? "bg-sage text-sage-foreground" : "bg-surface text-charcoal/60"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-charcoal/50 border border-dashed border-border-subtle rounded-3xl">
            No tasks here.
          </div>
        )}
        {filtered.map((t: any) => (
          <div
            key={t.id}
            className="flex items-center gap-3 p-4 rounded-2xl border border-border-subtle bg-white hover:bg-surface transition-colors"
          >
            <button
              onClick={() => toggleDone(t)}
              className={`size-6 rounded-full border-2 shrink-0 grid place-items-center transition-colors ${
                t.status === "done"
                  ? "bg-sage border-sage"
                  : "border-border-subtle hover:border-sage"
              }`}
            >
              {t.status === "done" && (
                <div className="size-2.5 rounded-full bg-sage-foreground" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium truncate ${
                  t.status === "done" ? "line-through text-charcoal/40" : "text-charcoal"
                }`}
              >
                {t.title}
              </p>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                {t.priority === "important" && (
                  <span className="text-clay font-bold">Important</span>
                )}
                {t.due_at && (
                  <span className="text-charcoal/50">
                    {format(new Date(t.due_at), "MMM d, h:mm a")}
                  </span>
                )}
                {t.source === "mcp" && (
                  <span className="text-clay">via assistant</span>
                )}
              </div>
            </div>
            <button
              onClick={() => del(t)}
              className="size-9 rounded-full grid place-items-center text-charcoal/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

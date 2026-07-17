import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, routinesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { ensureRoutineInstance, logActivity } from "@/lib/mutations";
import { PageHeader } from "@/components/PageHeader";
import { Pencil, Check, Trash2, Plus, X, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/routines")({
  component: RoutinesPage,
});

const CADENCES = ["daily", "weekdays", "weekly", "custom"] as const;

function RoutinesPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data } = useQuery(routinesQuery(householdId));
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCadence, setNewCadence] = useState<(typeof CADENCES)[number]>("daily");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["routines", householdId] });

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
    invalidate();
  }

  async function createRoutine() {
    if (!householdId || !newName.trim()) return;
    const nextOrder = (data?.routines?.length ?? 0);
    const { error } = await supabase.from("routines").insert({
      household_id: householdId,
      name: newName.trim(),
      cadence: newCadence,
      order_index: nextOrder,
      active: true,
    });
    if (!error) {
      await logActivity({
        householdId,
        action: "create",
        entityType: "routine",
        summary: `Created routine "${newName.trim()}"`,
      });
      setNewName("");
      setNewCadence("daily");
      setCreating(false);
      invalidate();
    }
  }

  async function updateRoutine(id: string, patch: { name?: string; cadence?: string; active?: boolean }) {
    await supabase.from("routines").update(patch).eq("id", id);
    invalidate();
  }

  async function deleteRoutine(id: string, name: string) {
    if (!confirm(`Delete routine "${name}"? This removes its steps and history.`)) return;
    await supabase.from("routines").delete().eq("id", id);
    if (householdId) {
      await logActivity({
        householdId,
        action: "delete",
        entityType: "routine",
        summary: `Deleted routine "${name}"`,
      });
    }
    if (editingId === id) setEditingId(null);
    invalidate();
  }

  async function addStep(routineId: string, title: string, orderIndex: number) {
    if (!title.trim()) return;
    await supabase.from("routine_steps").insert({
      routine_id: routineId,
      title: title.trim(),
      order_index: orderIndex,
    });
    invalidate();
  }

  async function updateStep(id: string, title: string) {
    await supabase.from("routine_steps").update({ title }).eq("id", id);
    invalidate();
  }

  async function deleteStep(id: string) {
    await supabase.from("routine_steps").delete().eq("id", id);
    invalidate();
  }

  async function moveStep(steps: any[], index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const a = steps[index];
    const b = steps[j];
    await Promise.all([
      supabase.from("routine_steps").update({ order_index: b.order_index }).eq("id", a.id),
      supabase.from("routine_steps").update({ order_index: a.order_index }).eq("id", b.id),
    ]);
    invalidate();
  }

  const routines = data?.routines ?? [];
  const instances = data?.instances ?? [];
  const completions = data?.completions ?? [];

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        householdId={householdId}
        eyebrow="Repeating rhythms"
        title="Routines"
        right={
          <button
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage text-sage-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" /> New routine
          </button>
        }
      />

      {creating && (
        <div className="mb-6 p-5 rounded-3xl bg-white border border-border-subtle shadow-sm max-w-xl">
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Routine name (e.g. Morning Reset)"
              className="w-full px-3 py-2 rounded-xl border border-border-subtle bg-surface focus:outline-none focus:ring-2 focus:ring-sage/30"
            />
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-widest text-charcoal/50">Cadence</label>
              <select
                value={newCadence}
                onChange={(e) => setNewCadence(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-border-subtle bg-surface text-sm"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="px-3 py-2 rounded-xl text-charcoal/60 hover:bg-surface text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={createRoutine}
                  className="px-4 py-2 rounded-xl bg-sage text-sage-foreground text-sm font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {routines.map((r: any) => {
          const steps = (r.routine_steps ?? []).sort(
            (a: any, b: any) => a.order_index - b.order_index,
          );
          const inst = instances.find((i: any) => i.routine_id === r.id);
          const doneIds = new Set(
            completions.filter((c: any) => c.instance_id === inst?.id).map((c: any) => c.step_id),
          );
          const editing = editingId === r.id;

          return (
            <div
              key={r.id}
              className="p-6 rounded-3xl bg-white border border-border-subtle shadow-sm"
            >
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <div className="flex flex-col gap-2">
                      <input
                        defaultValue={r.name}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== r.name) {
                            updateRoutine(r.id, { name: e.target.value.trim() });
                          }
                        }}
                        className="w-full px-2 py-1 rounded-lg border border-border-subtle bg-surface font-display italic text-2xl font-semibold text-sage"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={r.cadence}
                          onChange={(e) => updateRoutine(r.id, { cadence: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-border-subtle bg-surface text-xs"
                        >
                          {CADENCES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1.5 text-xs text-charcoal/60">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={(e) => updateRoutine(r.id, { active: e.target.checked })}
                          />
                          Active
                        </label>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-clay">
                        {r.cadence}
                        {!r.active && " · inactive"}
                      </p>
                      <h3 className="font-display italic text-2xl font-semibold text-sage">
                        {r.name}
                      </h3>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!editing && (
                    <span className="text-xs text-charcoal/50 mr-1">
                      {doneIds.size} / {steps.length}
                    </span>
                  )}
                  <button
                    onClick={() => setEditingId(editing ? null : r.id)}
                    className="p-2 rounded-full text-charcoal/50 hover:text-charcoal hover:bg-surface"
                    title={editing ? "Done" : "Edit"}
                  >
                    {editing ? <Check className="size-4" /> : <Pencil className="size-4" />}
                  </button>
                  {editing && (
                    <button
                      onClick={() => deleteRoutine(r.id, r.name)}
                      className="p-2 rounded-full text-clay hover:bg-clay/10"
                      title="Delete routine"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <ul className="space-y-1">
                {steps.map((s: any, i: number) => {
                  const done = doneIds.has(s.id);
                  if (editing) {
                    return (
                      <li key={s.id} className="flex items-center gap-1">
                        <input
                          defaultValue={s.title}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== s.title) updateStep(s.id, v);
                          }}
                          className="flex-1 px-3 py-2 rounded-xl border border-border-subtle bg-surface text-sm"
                        />
                        <button
                          onClick={() => moveStep(steps, i, -1)}
                          disabled={i === 0}
                          className="p-1.5 rounded-lg text-charcoal/50 hover:bg-surface disabled:opacity-30"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          onClick={() => moveStep(steps, i, 1)}
                          disabled={i === steps.length - 1}
                          className="p-1.5 rounded-lg text-charcoal/50 hover:bg-surface disabled:opacity-30"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          onClick={() => deleteStep(s.id)}
                          className="p-1.5 rounded-lg text-clay hover:bg-clay/10"
                        >
                          <X className="size-3.5" />
                        </button>
                      </li>
                    );
                  }
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

              {editing && (
                <AddStepRow
                  onAdd={(title) => addStep(r.id, title, steps.length)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddStepRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) {
          onAdd(value);
          setValue("");
        }
      }}
      className="mt-2 flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add step…"
        className="flex-1 px-3 py-2 rounded-xl border border-border-subtle bg-surface text-sm"
      />
      <button
        type="submit"
        className="p-2 rounded-full bg-sage text-sage-foreground"
        title="Add step"
      >
        <Plus className="size-4" />
      </button>
    </form>
  );
}

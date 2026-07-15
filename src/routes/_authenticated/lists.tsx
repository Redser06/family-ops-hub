import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, listsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/mutations";
import { PageHeader } from "@/components/PageHeader";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lists")({
  component: ListsPage,
});

const KINDS = [
  { value: "shopping", label: "Shopping" },
  { value: "packing", label: "Packing" },
  { value: "errands", label: "Errands" },
  { value: "prep", label: "Prep" },
  { value: "other", label: "Other" },
] as const;

function ListsPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data: lists = [] } = useQuery(listsQuery(householdId));
  const queryClient = useQueryClient();
  const [newList, setNewList] = useState("");
  const [newKind, setNewKind] = useState<(typeof KINDS)[number]["value"]>("shopping");

  async function createList() {
    if (!newList.trim() || !householdId) return;
    const { data, error } = await supabase
      .from("lists")
      .insert({ household_id: householdId, name: newList.trim(), kind: newKind })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await logActivity({
      householdId,
      action: "create",
      entityType: "list",
      entityId: data.id,
      summary: `Created list "${newList.trim()}"`,
    });
    setNewList("");
    queryClient.invalidateQueries({ queryKey: ["lists", householdId] });
  }

  async function addItem(listId: string, title: string) {
    if (!title.trim() || !householdId) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("list_items").insert({
      list_id: listId,
      title: title.trim(),
      created_by: userData.user?.id,
    });
    queryClient.invalidateQueries({ queryKey: ["lists", householdId] });
  }

  async function toggleItem(id: string, checked: boolean) {
    if (!householdId) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from("list_items")
      .update({
        checked: !checked,
        checked_at: checked ? null : new Date().toISOString(),
        checked_by: checked ? null : userData.user?.id,
      })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["lists", householdId] });
  }

  async function delItem(id: string) {
    await supabase.from("list_items").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["lists", householdId] });
  }

  async function delList(id: string, name: string) {
    if (!householdId) return;
    await supabase.from("lists").delete().eq("id", id);
    await logActivity({
      householdId,
      action: "delete",
      entityType: "list",
      entityId: id,
      summary: `Deleted list "${name}"`,
    });
    queryClient.invalidateQueries({ queryKey: ["lists", householdId] });
  }

  return (
    <div className="p-6 lg:p-10">
      <PageHeader householdId={householdId} eyebrow="Together" title="Lists" />

      <div className="bg-white border border-border-subtle rounded-3xl p-5 mb-8 shadow-sm max-w-2xl flex flex-col md:flex-row gap-3">
        <input
          value={newList}
          onChange={(e) => setNewList(e.target.value)}
          placeholder="New list name (e.g. Beach trip packing)"
          className="flex-1 h-12 rounded-xl border border-border-subtle bg-base px-4 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        />
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as any)}
          className="h-12 rounded-xl border border-border-subtle bg-base px-3 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button
          onClick={createList}
          className="h-12 px-5 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90 inline-flex items-center gap-2"
        >
          <Plus className="size-4" /> New list
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {lists.map((l: any) => (
          <ListCard
            key={l.id}
            list={l}
            onAdd={(t) => addItem(l.id, t)}
            onToggle={toggleItem}
            onDelItem={delItem}
            onDel={() => delList(l.id, l.name)}
          />
        ))}
      </div>
    </div>
  );
}

function ListCard({
  list,
  onAdd,
  onToggle,
  onDelItem,
  onDel,
}: {
  list: any;
  onAdd: (t: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onDelItem: (id: string) => void;
  onDel: () => void;
}) {
  const [t, setT] = useState("");
  const items = (list.list_items ?? []).sort((a: any, b: any) => a.order_index - b.order_index);
  return (
    <div className="p-5 rounded-3xl bg-white border border-border-subtle shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-clay">
            {list.kind}
          </p>
          <h3 className="font-display italic text-xl font-semibold text-sage">
            {list.name}
          </h3>
        </div>
        <button
          onClick={onDel}
          className="size-8 rounded-full grid place-items-center text-charcoal/40 hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="space-y-1">
        {items.map((it: any) => (
          <div
            key={it.id}
            className="flex items-center gap-2 py-1.5 group"
          >
            <button
              onClick={() => onToggle(it.id, it.checked)}
              className={`size-5 rounded border-2 shrink-0 grid place-items-center ${
                it.checked ? "bg-sage border-sage" : "border-border-subtle"
              }`}
            >
              {it.checked && <div className="size-2 bg-sage-foreground rounded-sm" />}
            </button>
            <span
              className={`text-sm flex-1 min-w-0 truncate ${
                it.checked ? "line-through text-charcoal/40" : "text-charcoal"
              }`}
            >
              {it.title}
            </span>
            <button
              onClick={() => onDelItem(it.id)}
              className="opacity-0 group-hover:opacity-100 text-charcoal/40 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(t);
          setT("");
        }}
        className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3"
      >
        <Plus className="size-4 text-charcoal/40 shrink-0" />
        <input
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="Add item"
          className="flex-1 bg-transparent text-sm h-8 focus:outline-none placeholder:text-charcoal/40"
        />
      </form>
    </div>
  );
}

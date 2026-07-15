import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { membershipQuery, notesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/mutations";
import { PageHeader } from "@/components/PageHeader";
import { Archive } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  component: NotesPage,
});

function NotesPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data: notes = [] } = useQuery(notesQuery(householdId));
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  async function add() {
    if (!body.trim() || !householdId) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        household_id: householdId,
        body: body.trim(),
        created_by: userData.user?.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await logActivity({
      householdId,
      action: "create",
      entityType: "note",
      entityId: data.id,
      summary: `Added a note`,
    });
    setBody("");
    queryClient.invalidateQueries({ queryKey: ["notes", householdId] });
  }

  async function archive(id: string) {
    if (!householdId) return;
    await supabase.from("notes").update({ archived: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notes", householdId] });
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader householdId={householdId} eyebrow="Capture" title="Notes & Inbox" />

      <div className="bg-white border border-border-subtle rounded-3xl p-5 mb-6 shadow-sm">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Jot it down before it slips away…"
          rows={3}
          className="w-full rounded-xl border border-border-subtle bg-base px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage/40 resize-none"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={add}
            className="h-11 px-5 rounded-xl bg-sage text-sage-foreground font-medium text-sm hover:bg-sage/90"
          >
            Save note
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {notes.length === 0 && (
          <p className="text-sm text-charcoal/50 text-center py-8">Nothing captured yet.</p>
        )}
        {notes.map((n: any) => (
          <div
            key={n.id}
            className="p-5 rounded-2xl bg-white border border-border-subtle group"
          >
            <p className="text-sm text-charcoal whitespace-pre-wrap">{n.body}</p>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] uppercase tracking-widest text-charcoal/40">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </span>
              <button
                onClick={() => archive(n.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-charcoal/50 hover:text-charcoal inline-flex items-center gap-1 transition"
              >
                <Archive className="size-3.5" /> Archive
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

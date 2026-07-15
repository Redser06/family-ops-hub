import { supabase } from "@/integrations/supabase/client";
import { todayDate } from "./queries";

export async function logActivity(input: {
  householdId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    household_id: input.householdId,
    actor_type: "user",
    actor_user_id: userData.user?.id ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
    metadata: (input.metadata ?? null) as any,
  });
}

export async function ensureRoutineInstance(routineId: string, householdId: string) {
  const scheduled_for = todayDate();
  const { data: existing } = await supabase
    .from("routine_instances")
    .select("id")
    .eq("routine_id", routineId)
    .eq("scheduled_for", scheduled_for)
    .maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("routine_instances")
    .insert({ routine_id: routineId, household_id: householdId, scheduled_for })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

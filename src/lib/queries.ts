import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const membershipQuery = queryOptions({
  queryKey: ["membership"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from("household_memberships")
      .select("household_id, role, households(id, name)")
      .eq("user_id", userData.user.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});

export function todayISO() {
  return new Date().toISOString();
}

export function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfTodayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function endOfWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function todayOverviewQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["today", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return null;
      const start = startOfTodayISO();
      const end = endOfTodayISO();

      const [tasks, events, routines, activity] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("household_id", householdId)
          .neq("status", "done")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(50),
        supabase
          .from("imported_events")
          .select("*")
          .eq("household_id", householdId)
          .gte("start_at", start)
          .lte("start_at", end)
          .order("start_at", { ascending: true }),
        supabase
          .from("routines")
          .select("id, name, cadence, order_index, routine_steps(id, title, order_index)")
          .eq("household_id", householdId)
          .eq("active", true)
          .order("order_index", { ascending: true }),
        supabase
          .from("activity_log")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const todayStr = todayDate();
      const routineIds = (routines.data ?? []).map((r) => r.id);
      const [instances, completions] = await Promise.all([
        routineIds.length
          ? supabase
              .from("routine_instances")
              .select("id, routine_id, scheduled_for, completed_at")
              .eq("household_id", householdId)
              .eq("scheduled_for", todayStr)
              .in("routine_id", routineIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        Promise.resolve({ data: [] as any[], error: null }),
      ]);
      const instanceIds = (instances.data ?? []).map((i: any) => i.id);
      const stepComps = instanceIds.length
        ? await supabase
            .from("routine_step_completions")
            .select("instance_id, step_id")
            .in("instance_id", instanceIds)
        : { data: [] as any[], error: null };

      return {
        tasks: tasks.data ?? [],
        events: events.data ?? [],
        routines: routines.data ?? [],
        instances: instances.data ?? [],
        stepCompletions: stepComps.data ?? [],
        activity: activity.data ?? [],
      };
    },
  });
}

export function weekOverviewQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["week", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return null;
      const start = startOfTodayISO();
      const end = endOfWeekISO();
      const [tasks, events] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("household_id", householdId)
          .neq("status", "done")
          .lte("due_at", end)
          .order("due_at", { ascending: true }),
        supabase
          .from("imported_events")
          .select("*")
          .eq("household_id", householdId)
          .gte("start_at", start)
          .lte("start_at", end)
          .order("start_at", { ascending: true }),
      ]);
      return { tasks: tasks.data ?? [], events: events.data ?? [] };
    },
  });
}

export function tasksQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["tasks", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", householdId)
        .order("status", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function listsQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["lists", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("lists")
        .select("*, list_items(*)")
        .eq("household_id", householdId)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function notesQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["notes", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("household_id", householdId)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function activityQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["activity", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function routinesQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["routines", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return { routines: [], instances: [], completions: [] };
      const { data: routines } = await supabase
        .from("routines")
        .select("*, routine_steps(*)")
        .eq("household_id", householdId)
        .order("order_index", { ascending: true });
      const todayStr = todayDate();
      const rids = (routines ?? []).map((r) => r.id);
      const instances = rids.length
        ? (
            await supabase
              .from("routine_instances")
              .select("*")
              .eq("household_id", householdId)
              .eq("scheduled_for", todayStr)
              .in("routine_id", rids)
          ).data ?? []
        : [];
      const iids = instances.map((i: any) => i.id);
      const completions = iids.length
        ? (
            await supabase
              .from("routine_step_completions")
              .select("*")
              .in("instance_id", iids)
          ).data ?? []
        : [];
      return { routines: routines ?? [], instances, completions };
    },
  });
}

export function householdMembersQuery(householdId: string | null | undefined) {
  return queryOptions({
    queryKey: ["members", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from("household_memberships")
        .select("user_id, role, profiles:user_id(id, display_name, email, avatar_url, color)")
        .eq("household_id", householdId);
      if (error) throw error;
      return data ?? [];
    },
  });
}

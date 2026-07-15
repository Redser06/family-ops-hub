import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, getHouseholdId, logMcpActivity, ok, err } from "./helpers";

// ============ READ TOOLS ============

export const getTodayOverview = defineTool({
  name: "get_today_overview",
  title: "Get today overview",
  description:
    "Returns today's calendar events, open tasks, and pending routine steps for the household.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const [events, tasks, routines] = await Promise.all([
      supabase.from("imported_events").select("id,title,start_at,end_at,location").eq("household_id", hid).gte("start_at", start.toISOString()).lte("start_at", end.toISOString()).order("start_at"),
      supabase.from("tasks").select("id,title,status,priority,due_at,due_window").eq("household_id", hid).neq("status", "done"),
      supabase.from("routines").select("id,name,routine_steps(id,title)").eq("household_id", hid).eq("active", true),
    ]);
    return ok(
      `Today: ${events.data?.length ?? 0} events, ${tasks.data?.length ?? 0} open tasks, ${routines.data?.length ?? 0} active routines.`,
      { events: events.data, tasks: tasks.data, routines: routines.data },
    );
  },
});

export const getWeekPlan = defineTool({
  name: "get_week_plan",
  title: "Get week plan",
  description: "Returns the next 7 days of calendar events and tasks with due dates.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true },
  handler: async (_input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const [events, tasks] = await Promise.all([
      supabase.from("imported_events").select("*").eq("household_id", hid).gte("start_at", start.toISOString()).lte("start_at", end.toISOString()).order("start_at"),
      supabase.from("tasks").select("*").eq("household_id", hid).neq("status", "done").lte("due_at", end.toISOString()).order("due_at"),
    ]);
    return ok("Week fetched.", { events: events.data, tasks: tasks.data });
  },
});

export const listOpenTasks = defineTool({
  name: "list_open_tasks",
  title: "List open tasks",
  description: "List household tasks that are not yet completed. Optionally filter by priority.",
  inputSchema: {
    priority: z.enum(["low", "normal", "important"]).optional().describe("Filter by priority"),
  },
  annotations: { readOnlyHint: true },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    let q = supabase.from("tasks").select("*").eq("household_id", hid).neq("status", "done");
    if (input.priority) q = q.eq("priority", input.priority);
    const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false });
    if (error) return err(error.message);
    return ok(`Found ${data?.length ?? 0} open tasks.`, { tasks: data });
  },
});

export const listRecentActivity = defineTool({
  name: "list_recent_activity",
  title: "List recent activity",
  description: "Recent household activity across tasks, routines, lists, notes, and calendar.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 20)"),
  },
  annotations: { readOnlyHint: true },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .eq("household_id", hid)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 20);
    if (error) return err(error.message);
    return ok(`${data?.length ?? 0} activity rows.`, { activity: data });
  },
});

export const getRoutines = defineTool({
  name: "get_routines",
  title: "Get routines",
  description: "List active routines with their steps and today's completion state.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
  handler: async (_i, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data } = await supabase
      .from("routines")
      .select("id,name,cadence,routine_steps(id,title,order_index)")
      .eq("household_id", hid)
      .eq("active", true)
      .order("order_index");
    return ok(`${data?.length ?? 0} routines.`, { routines: data });
  },
});

export const getLists = defineTool({
  name: "get_lists",
  title: "Get lists",
  description: "Return household lists and their items.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
  handler: async (_i, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data } = await supabase
      .from("lists")
      .select("*, list_items(*)")
      .eq("household_id", hid)
      .eq("archived", false);
    return ok(`${data?.length ?? 0} lists.`, { lists: data });
  },
});

export const getNotes = defineTool({
  name: "get_notes",
  title: "Get notes",
  description: "Return recent household notes.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("household_id", hid)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 20);
    return ok(`${data?.length ?? 0} notes.`, { notes: data });
  },
});

// ============ WRITE TOOLS ============

export const createTask = defineTool({
  name: "create_task",
  title: "Create task",
  description:
    "Add a task to the household board. Title required; due date, priority, and window optional.",
  inputSchema: {
    title: z.string().min(1),
    due_at: z.string().optional().describe("ISO datetime"),
    priority: z.enum(["low", "normal", "important"]).optional(),
    due_window: z.enum(["morning", "afternoon", "evening"]).optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        household_id: hid,
        title: input.title,
        priority: input.priority ?? "normal",
        due_at: input.due_at ?? null,
        due_window: input.due_window ?? null,
        notes: input.notes ?? null,
        source: "mcp",
        created_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "create",
      entityType: "task",
      entityId: data.id,
      summary: `Added "${input.title}"`,
    });
    return ok(`Task created: ${data.id}`, { task: data });
  },
});

export const updateTask = defineTool({
  name: "update_task",
  title: "Update task",
  description: "Update a task's fields.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().optional(),
    priority: z.enum(["low", "normal", "important"]).optional(),
    due_at: z.string().optional(),
    status: z.enum(["open", "in_progress", "done", "snoozed"]).optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { id, ...patch } = input;
    const { data, error } = await supabase
      .from("tasks")
      .update(patch as any)
      .eq("id", id)
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "update",
      entityType: "task",
      entityId: id,
      summary: `Updated "${data.title}"`,
    });
    return ok(`Updated`, { task: data });
  },
});

export const completeTask = defineTool({
  name: "complete_task",
  title: "Complete task",
  description: "Mark a task as done.",
  inputSchema: { id: z.string().uuid() },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
        completed_by: ctx.getUserId(),
      })
      .eq("id", input.id)
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "complete",
      entityType: "task",
      entityId: input.id,
      summary: `Completed "${data.title}"`,
    });
    return ok(`Completed`);
  },
});

export const createNote = defineTool({
  name: "create_note",
  title: "Create note",
  description: "Add a note to the household inbox.",
  inputSchema: { body: z.string().min(1) },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("notes")
      .insert({
        household_id: hid,
        body: input.body,
        created_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "create",
      entityType: "note",
      entityId: data.id,
      summary: "Added a note",
    });
    return ok("Note saved", { note: data });
  },
});

export const createList = defineTool({
  name: "create_list",
  title: "Create list",
  description: "Create a new list (shopping, packing, errands, prep, other).",
  inputSchema: {
    name: z.string().min(1),
    kind: z.enum(["shopping", "packing", "errands", "prep", "other"]).optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("lists")
      .insert({ household_id: hid, name: input.name, kind: input.kind ?? "other" })
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "create",
      entityType: "list",
      entityId: data.id,
      summary: `Created list "${input.name}"`,
    });
    return ok(`List created: ${data.id}`, { list: data });
  },
});

export const addListItem = defineTool({
  name: "add_list_item",
  title: "Add list item",
  description: "Add an item to a list.",
  inputSchema: {
    list_id: z.string().uuid(),
    title: z.string().min(1),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const { data, error } = await supabase
      .from("list_items")
      .insert({ list_id: input.list_id, title: input.title, created_by: ctx.getUserId() })
      .select()
      .single();
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "create",
      entityType: "list_item",
      entityId: data.id,
      summary: `Added "${input.title}" to a list`,
    });
    return ok("Item added", { item: data });
  },
});

export const updateListItem = defineTool({
  name: "update_list_item",
  title: "Update list item",
  description: "Check, uncheck, or rename a list item.",
  inputSchema: {
    id: z.string().uuid(),
    checked: z.boolean().optional(),
    title: z.string().optional(),
  },
  annotations: { readOnlyHint: false },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const { id, ...patch } = input;
    const p: any = { ...patch };
    if (patch.checked !== undefined) {
      p.checked_at = patch.checked ? new Date().toISOString() : null;
      p.checked_by = patch.checked ? ctx.getUserId() : null;
    }
    const { error } = await supabase.from("list_items").update(p).eq("id", id);
    if (error) return err(error.message);
    return ok("Updated");
  },
});

export const completeRoutineStep = defineTool({
  name: "complete_routine_step",
  title: "Complete routine step",
  description: "Mark a routine step complete for today.",
  inputSchema: {
    routine_id: z.string().uuid(),
    step_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    const supabase = supabaseForUser(ctx);
    const hid = await getHouseholdId(ctx);
    const today = new Date().toISOString().slice(0, 10);
    const { data: inst } = await supabase
      .from("routine_instances")
      .select("id")
      .eq("routine_id", input.routine_id)
      .eq("scheduled_for", today)
      .maybeSingle();
    let instanceId = inst?.id;
    if (!instanceId) {
      const { data: created, error } = await supabase
        .from("routine_instances")
        .insert({ routine_id: input.routine_id, household_id: hid, scheduled_for: today })
        .select("id")
        .single();
      if (error) return err(error.message);
      instanceId = created.id;
    }
    const { error } = await supabase.from("routine_step_completions").upsert({
      instance_id: instanceId,
      step_id: input.step_id,
      completed_by: ctx.getUserId(),
    });
    if (error) return err(error.message);
    await logMcpActivity(ctx, {
      householdId: hid,
      action: "complete",
      entityType: "routine_step",
      entityId: input.step_id,
      summary: "Completed a routine step",
    });
    return ok("Step completed");
  },
});

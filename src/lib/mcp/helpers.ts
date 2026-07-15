import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

export function supabaseForUser(ctx: ToolContext) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const token = ctx.getToken();
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getHouseholdId(ctx: ToolContext): Promise<string> {
  const supabase = supabaseForUser(ctx);
  const userId = ctx.getUserId();
  const { data, error } = await supabase
    .from("household_memberships")
    .select("household_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No household set up — sign in and create one in the app first.");
  return data.household_id;
}

export async function logMcpActivity(
  ctx: ToolContext,
  input: {
    householdId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
  },
) {
  const supabase = supabaseForUser(ctx);
  await supabase.from("activity_log").insert({
    household_id: input.householdId,
    actor_type: "mcp",
    actor_user_id: ctx.getUserId(),
    actor_client_name: ctx.getClientId() || "AI assistant",
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    summary: input.summary,
  });
}

export function ok(text: string, structured?: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured !== undefined ? { structuredContent: structured as any } : {}),
  };
}

export function err(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

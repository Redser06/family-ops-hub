import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, householdMembersQuery } from "@/lib/queries";
import {
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ListChecks,
  Repeat,
  StickyNote,
  Activity,
  Settings,
  Monitor,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/today", label: "Today", icon: CalendarDays },
  { to: "/week", label: "Week", icon: CalendarRange },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/routines", label: "Routines", icon: Repeat },
  { to: "/lists", label: "Lists", icon: ListChecks },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: membership, isLoading } = useQuery(membershipQuery);
  const [boardMode, setBoardMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !membership && location.pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, membership, location.pathname, navigate]);

  useEffect(() => {
    const cls = "board-mode";
    if (boardMode) document.documentElement.classList.add(cls);
    else document.documentElement.classList.remove(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [boardMode]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const householdId = membership?.household_id;

  const { data: members } = useQuery(householdMembersQuery(householdId));

  // Realtime — invalidate on relevant channels
  useEffect(() => {
    if (!householdId) return;
    const chan = supabase
      .channel(`household-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${householdId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks", householdId] });
        queryClient.invalidateQueries({ queryKey: ["today", householdId] });
        queryClient.invalidateQueries({ queryKey: ["week", householdId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log", filter: `household_id=eq.${householdId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["activity", householdId] });
        queryClient.invalidateQueries({ queryKey: ["today", householdId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `household_id=eq.${householdId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notes", householdId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "imported_events", filter: `household_id=eq.${householdId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["today", householdId] });
        queryClient.invalidateQueries({ queryKey: ["week", householdId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "routine_step_completions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["today", householdId] });
        queryClient.invalidateQueries({ queryKey: ["routines", householdId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [householdId, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <p className="font-display italic text-sage">Loading your board…</p>
      </div>
    );
  }

  if (!membership) {
    // We're redirecting to /onboarding; still render Outlet in case
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-base flex">
      {/* Sidebar rail */}
      <nav className="w-24 lg:w-28 shrink-0 bg-surface/70 border-r border-border-subtle flex flex-col items-center py-6 gap-2 sticky top-0 h-screen">
        <Link to="/today" className="mb-4 flex flex-col items-center">
          <div className="size-11 rounded-2xl bg-sage grid place-items-center">
            <span className="font-display italic text-sage-foreground text-lg leading-none">F</span>
          </div>
        </Link>
        <div className="flex flex-col gap-1 w-full px-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-colors ${
                  active
                    ? "bg-sage/10 text-sage"
                    : "text-charcoal/50 hover:text-charcoal hover:bg-surface"
                }`}
              >
                <Icon className="size-5" strokeWidth={1.5} />
                <span className="text-[10px] font-medium tracking-tight">{label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col items-center gap-2 board-hide">
          <button
            onClick={() => setBoardMode((b) => !b)}
            title="Toggle board mode"
            className={`size-11 rounded-full grid place-items-center transition-colors ${
              boardMode
                ? "bg-clay text-white"
                : "bg-surface text-charcoal/60 hover:text-charcoal"
            }`}
          >
            <Monitor className="size-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="size-11 rounded-full grid place-items-center text-charcoal/50 hover:text-charcoal hover:bg-surface transition-colors"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {members && members.length > 0 && (
          <div className="hidden">{/* members exposed via context below */}</div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

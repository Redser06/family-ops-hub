import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { membershipQuery, weekOverviewQuery, startOfTodayISO, endOfWeekISO } from "@/lib/queries";
import { googleCalendarEventsQuery } from "@/lib/googleCalendarQueries";
import { PageHeader } from "@/components/PageHeader";
import { addDays, format, isSameDay } from "date-fns";

export const Route = createFileRoute("/_authenticated/week")({
  component: WeekPage,
});

function WeekPage() {
  const { data: membership } = useQuery(membershipQuery);
  const householdId = membership?.household_id;
  const { data } = useQuery(weekOverviewQuery(householdId));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        householdId={householdId}
        eyebrow="This week"
        title={`Week of ${format(today, "MMM d")}`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {days.map((d) => {
          const events = (data?.events ?? []).filter((e: any) =>
            isSameDay(new Date(e.start_at), d),
          );
          const tasks = (data?.tasks ?? []).filter(
            (t: any) => t.due_at && isSameDay(new Date(t.due_at), d),
          );
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`p-4 rounded-2xl border ${
                isToday
                  ? "bg-sage/5 border-sage/40"
                  : "bg-surface border-border-subtle"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-clay">
                {format(d, "EEE")}
              </p>
              <p
                className={`font-display text-2xl font-semibold mb-3 ${
                  isToday ? "text-sage italic" : "text-charcoal"
                }`}
              >
                {format(d, "d")}
              </p>
              <div className="space-y-1.5">
                {events.map((e: any) => (
                  <div
                    key={e.id}
                    className="p-2 rounded-lg bg-white text-xs border border-border-subtle"
                  >
                    <span className="text-[10px] text-sage font-bold uppercase">
                      {format(new Date(e.start_at), "h:mm a")}
                    </span>
                    <p className="font-medium truncate">{e.title}</p>
                  </div>
                ))}
                {tasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-2 rounded-lg bg-clay/5 text-xs border border-clay/20"
                  >
                    <span className="text-[10px] text-clay font-bold uppercase">Task</span>
                    <p className="font-medium truncate">{t.title}</p>
                  </div>
                ))}
                {events.length === 0 && tasks.length === 0 && (
                  <p className="text-xs text-charcoal/40">Nothing scheduled</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

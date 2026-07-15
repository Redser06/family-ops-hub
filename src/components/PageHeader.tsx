import { useQuery } from "@tanstack/react-query";
import { householdMembersQuery } from "@/lib/queries";
import { format } from "date-fns";

export function PageHeader({
  householdId,
  eyebrow,
  title,
  right,
}: {
  householdId: string | null | undefined;
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  const { data: members } = useQuery(householdMembersQuery(householdId));
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-8 lg:mb-10">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-clay mb-1">
          {eyebrow ?? format(new Date(), "EEEE")}
        </p>
        <h1 className="font-display italic text-3xl lg:text-4xl font-semibold text-sage leading-tight truncate">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {right}
        {members && members.length > 0 && (
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((m: any, i: number) => {
              const name = m.profiles?.display_name || m.profiles?.email || "?";
              return (
                <div
                  key={m.user_id}
                  title={name}
                  className="size-10 rounded-full bg-surface border-2 border-base grid place-items-center text-xs font-semibold text-charcoal"
                  style={{ zIndex: 10 - i }}
                >
                  {name[0]?.toUpperCase() ?? "?"}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}

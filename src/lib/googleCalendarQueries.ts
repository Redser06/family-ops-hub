import { queryOptions } from "@tanstack/react-query";
import {
  getGoogleCalendarStatus,
  listGoogleCalendarEvents,
} from "./googleCalendar.functions";

export const googleCalendarStatusQuery = queryOptions({
  queryKey: ["google-calendar", "status"],
  queryFn: () => getGoogleCalendarStatus(),
  staleTime: 60_000,
});

export function googleCalendarEventsQuery(timeMinISO: string, timeMaxISO: string) {
  return queryOptions({
    queryKey: ["google-calendar", "events", timeMinISO, timeMaxISO],
    queryFn: () => listGoogleCalendarEvents({ data: { timeMinISO, timeMaxISO } }),
    staleTime: 60_000,
    retry: false,
  });
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((targetOrigin: string) => targetOrigin)
  .handler(async ({ data: targetOrigin, context }) => {
    const clientKey = process.env.GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientKey) throw new Error("GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY is not set");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl: targetOrigin,
      responseMode: "web_message",
      webMessageTargetOrigin: targetOrigin,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return { authorizationUrl };
  });

export const saveGoogleCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connectionAPIKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, CONNECTOR_ID, data.connectionAPIKey);
    return { ok: true };
  });

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const };
    // Fetch profile email as a light validation.
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: "/calendar/v3/users/me/calendarList/primary",
      });
      if (!res.ok) return { connected: true as const, email: null, error: `HTTP ${res.status}` };
      const body = (await res.json()) as { id?: string; summary?: string };
      return { connected: true as const, email: body.id ?? null, summary: body.summary ?? null };
    } catch (e) {
      return { connected: true as const, email: null, error: e instanceof Error ? e.message : "unknown" };
    }
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      try {
        const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CONNECTOR_ID,
        });
      } catch {
        // ignore gateway errors — still clear local
      }
    }
    await deleteConnectionForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

export interface GCalEvent {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  source: "google";
  html_link: string | null;
}

export const listGoogleCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { timeMinISO: string; timeMaxISO: string }) => input)
  .handler(async ({ data, context }): Promise<{ events: GCalEvent[]; connected: boolean }> => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { events: [], connected: false };
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
    const params = new URLSearchParams({
      timeMin: data.timeMinISO,
      timeMax: data.timeMaxISO,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey: key,
      connectorId: CONNECTOR_ID,
      path: `/calendar/v3/calendars/primary/events?${params.toString()}`,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar request failed [${res.status}]: ${text}`);
    }
    const body = (await res.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        location?: string;
        htmlLink?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };
    const events: GCalEvent[] = (body.items ?? []).map((it) => {
      const startDT = it.start?.dateTime ?? it.start?.date ?? "";
      const endDT = it.end?.dateTime ?? it.end?.date ?? null;
      const allDay = !it.start?.dateTime;
      return {
        id: it.id,
        title: it.summary ?? "(untitled)",
        start_at: allDay ? new Date(startDT + "T00:00:00").toISOString() : new Date(startDT).toISOString(),
        end_at: endDT ? (allDay ? new Date(endDT + "T00:00:00").toISOString() : new Date(endDT).toISOString()) : null,
        all_day: allDay,
        location: it.location ?? null,
        source: "google",
        html_link: it.htmlLink ?? null,
      };
    });
    return { events, connected: true };
  });


## Family Ops Board — build plan

A calm, kitchen-mounted iPad dashboard for a two-adult household, built on the Sage & Clay Editorial direction. Signed-in only, one shared household calendar in V1, MCP server exposed to Claude/ChatGPT via managed OAuth.

### Design system (locked from chosen direction)

- Palette: base `#FDFCFB`, surface `#F4F2EE`, border `#E5E1DA`, sage `#5F6F52` (primary), clay `#A67B5B` (accent), charcoal `#2D2D2D`.
- Fonts: Fraunces (display, italic for date/section titles) + Outfit (sans body). Loaded via `<link>` in `__root.tsx` head.
- Tokens ported verbatim into `src/styles.css` under `@theme` + `:root` in oklch/hex. Rounded-2xl/3xl cards, subtle shadows, no hover-only affordances.
- Large touch targets (min 48px), high-contrast, glanceable at 2-3m. Board Mode toggle: enlarges type, hides edit chrome.

### Information architecture

Left nav rail (persistent) with these sections, all under `_authenticated/`:

- `/today` — kitchen dashboard (default post-login)
- `/week` — 7-day merged planner
- `/tasks` — full task list with filters
- `/routines` — routine cards + step editor
- `/lists` — packing / shopping / errands / prep
- `/notes` — inbox capture
- `/activity` — full audit timeline
- `/settings` — profile, household, Google Calendar, MCP/agent access

Public: `/` landing with sign-in CTA (session-aware redirect to `/today`), `/auth`, `/auth/callback`, `/.lovable/oauth/consent` (MCP consent), `/reset-password`.

### Data model (Lovable Cloud / Supabase)

Migration in one file with GRANTs + RLS. Roles table separate from profiles. Every table scoped by `household_id` with `has_household_access(auth.uid(), household_id)` security-definer helper.

- `households` (id, name, created_at)
- `profiles` (id → auth.users, display_name, avatar_url, color)
- `household_memberships` (household_id, user_id, role: `adult`|`child`, joined_at) — access source of truth
- `household_invites` (household_id, email, token, expires_at, invited_by)
- `app_role` enum + `user_roles` (user_id, role) — for future admin scopes
- `tasks` (id, household_id, title, notes, status: `open`|`in_progress`|`done`|`snoozed`, priority: `low`|`normal`|`important`, due_at, due_window: `morning`|`afternoon`|`evening`|null, assignee_id nullable, repeat_rule jsonb null, created_by, created_at, completed_at, completed_by, source: `ui`|`mcp`)
- `routines` (id, household_id, name, cadence: `daily`|`weekly`|`custom`, schedule jsonb, active)
- `routine_steps` (id, routine_id, title, order_index)
- `routine_instances` (id, routine_id, household_id, scheduled_for date, started_at, completed_at, completed_by)
- `routine_step_completions` (instance_id, step_id, completed_by, completed_at)
- `lists` (id, household_id, name, kind: `shopping`|`packing`|`errands`|`prep`|`other`, archived)
- `list_items` (id, list_id, title, checked, order_index, created_by, checked_by, checked_at)
- `notes` (id, household_id, body, created_by, created_at, archived)
- `calendar_connections` (id, household_id, provider: `google`, google_account_email, refresh_token_encrypted, access_token_encrypted, expires_at, last_synced_at, status: `active`|`needs_reauth`|`error`, connected_by)
- `imported_events` (id, connection_id, household_id, google_event_id unique, title, description, start_at, end_at, location, all_day, updated_at) — dedupe by (connection_id, google_event_id)
- `activity_log` (id, household_id, actor_type: `user`|`mcp`, actor_user_id, actor_client_name, action, entity_type, entity_id, summary, metadata jsonb, created_at) — every create/update/delete writes here via triggers + server helpers

All tables: GRANTs for authenticated + service_role, RLS enabled, policies scoped by `has_household_access()`. Owner reads for hidden/archived state included.

### Authentication

- Email/password + Google sign-in (via `lovable.auth.signInWithOAuth`; call `supabase--configure_social_auth` for google).
- First-run: `/onboarding` under `_authenticated` — create household OR accept invite by token. Auto-created profile via trigger on `auth.users` insert; membership NOT auto-created.
- Invite flow: from `/settings`, adult A creates invite with email → generates token → mailto or copy-link → adult B signs up, `/invite/:token` claims and creates membership.
- Route gate: integration-managed `src/routes/_authenticated/route.tsx`. Home `/` is a public landing (session-aware). Signed-in default lands `/today`.

### Google Calendar integration (V1: one shared household calendar)

Implemented via the App User Connector pattern with `google_calendar` connector, scoped per household (only one active connection at a time in V1). Store `connectionAPIKey` in `calendar_connections` (encrypted at rest via pgsodium-style helper or explicit crypto with `CONNECTION_KEY_SECRET`).

- `/settings/integrations` shows Connect Google Calendar button → popup consent → save connection.
- Server fn `syncCalendar(household_id)` lists events (14 days back, 60 days forward) from primary calendar, upserts `imported_events` by `google_event_id`.
- Auto-refresh: server fn triggered on Today/Week route loader (throttled: 60s min interval).
- Create/update events: server fn `createCalendarEvent` calls Google API via `callAsAppUser`, then upserts into `imported_events`.
- Reconnect surface: `needs_reauth` banner on Today when status flips.
- V2 hook: `calendar_connections` already supports multiple rows per household; UI is single-connection today.

### MCP server (OAuth-protected)

Using `@lovable.dev/mcp-js` mounted at `/mcp`. Managed Supabase OAuth 2.1 authorization server + `src/routes/[.]lovable.oauth.consent.tsx` consent route (approves as the signed-in adult).

Actions (each `defineTool` with narrow Zod input, `annotations`, and household-scoped queries via forwarded user token → RLS applies):

Read (readOnlyHint):
- `get_today_overview` — today's events + open tasks + pending routine steps + last 5 activity items
- `get_week_plan` — 7-day merged agenda
- `list_open_tasks` — filters: assignee, priority, due window
- `list_recent_activity` — last N activity rows
- `get_routines` — routines + today's completion state
- `get_lists` — lists and items
- `get_notes` — recent notes

Write:
- `create_task` (title, due_at?, priority?, assignee?, list_id?)
- `update_task` (id, patch)
- `complete_task` (id)
- `create_note` (body)
- `create_list` (name, kind)
- `add_list_item` (list_id, title)
- `update_list_item` (id, checked?/title?)
- `complete_routine_step` (instance_id, step_id)
- `create_calendar_event` (title, start_at, end_at, description?)
- `refresh_calendar_sync`

Every write logs to `activity_log` with `actor_type='mcp'` + `actor_client_name` from `ctx.getClientId()`. Read/write separation is explicit via annotations.

### Bi-directional live UI

- TanStack Query with a global `queryClient` (already in template).
- Supabase realtime channel per household on `activity_log`, `tasks`, `routine_step_completions`, `list_items`, `notes`, `imported_events` — invalidates matching queries.
- Activity feed uses realtime insert stream + fade-in animation.
- Board mode: 30s polling fallback if realtime disconnects.

### Screens (built to match the direction faithfully)

**Today (`/today`)** — 12-col grid, iPad landscape optimized:
- Header: italic Fraunces date, greeting with both adults' names, weather placeholder (V1 static, V2 hook), avatar cluster.
- Left col (4): Today's Agenda cards (merged events + tasks, sage/clay accent), Quick Tasks checklist, Quick Capture input.
- Center col (5): Daily Routines — hero sage tile for active routine w/ steps, two smaller tiles (Evening, Weekly Reset), Weekly Meal Plan placeholder card.
- Right col (3): Activity feed with vertical timeline rail, showing user + Claude/ChatGPT actions identically.
- Bottom-right floating "Board Mode" pill.

**Week (`/week`)** — 7-day column layout, each column an agenda strip merging events + tasks + routine markers.

**Tasks / Routines / Lists / Notes / Activity / Settings** — cards + rail visuals consistent with the direction. Quick-add on every list surface. Natural-language parser for task quick-add (chrono-node) → resolves "pack nursery bag Thursday" into title + due_at.

### Seeding

Migration-embedded seed for the first household is NOT done (empty household + invite flow chosen). Instead, on household creation we insert 3 starter routines (Morning Reset, Evening Wind-down, Weekly Reset) with sensible default steps. Everything else starts empty.

### Security

- All Supabase access via `requireSupabaseAuth`; RLS enforced.
- MCP validates managed Supabase JWT via `auth.oauth.issuer`; tools forward user token → RLS as that user.
- Encrypted at rest: Google refresh token, MCP connection key not stored (managed by OAuth server), calendar `connectionAPIKey` encrypted with `CONNECTION_KEY_SECRET`.
- Household boundary: `has_household_access()` security-definer function used in every policy; no cross-household leakage possible.
- Audit trail: `activity_log` insert on every mutation via server-side helper (not client-side) so MCP + UI writes look identical.

### Trade-offs & V2 hooks

- V1 uses one household-wide Google Calendar connection. Schema supports multiple, UI does not. V2 flips single-select UI into list.
- Weather is a static placeholder in V1; can wire OpenWeather via a server fn later.
- Natural-language date parsing is client-only (chrono-node); complex phrases fall back to a date picker.
- Children as full users deferred — `household_memberships.role='child'` exists but no auth path.
- Push notifications deferred (V1 relies on always-on kitchen display + activity feed).
- Realtime is push, but Board Mode adds a 30s polling fallback for iPad standby recovery.

### Build order

1. Enable Lovable Cloud + configure Google social auth + configure managed OAuth server + provision Lovable AI key (not needed V1 but useful for NL parsing later — skip for now).
2. Migration: enums, tables, GRANTs, RLS policies, `has_household_access`, `has_role`, activity triggers.
3. Design tokens into `src/styles.css`, fonts in `__root.tsx` head, real app title/description/OG.
4. Rebuild `src/routes/index.tsx` as public landing + session-aware redirect. Delete placeholder.
5. `/auth`, `/auth/callback`, `/onboarding` (create/join household), invite claim route.
6. `_authenticated` layout content: nav rail component, header shell.
7. Today screen (full fidelity to chosen direction) — read-only wiring first, then quick-add + complete.
8. Week, Tasks, Routines, Lists, Notes, Activity screens.
9. Settings → Integrations: Google Calendar App User Connector (client-connect step + storage table + sync server fn).
10. Realtime wiring for tasks / activity / list items / routine completions / imported events.
11. MCP: `bun add @lovable.dev/mcp-js zod`, bunfig exclusion, `src/lib/mcp/index.ts` + tools, `mcpPlugin()` in vite config, `[.]lovable.oauth.consent.tsx`, activate OAuth server, extract manifest.
12. Board Mode toggle, PWA manifest (installable only — no service worker), favicon.
13. Verification pass: build, Playwright smoke on Today + Settings, MCP manifest extract, tell user to publish for external MCP clients.

Ready for you to hit Implement.

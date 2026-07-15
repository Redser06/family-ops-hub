
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.member_role AS ENUM ('adult', 'child');
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'done', 'snoozed');
CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'important');
CREATE TYPE public.task_source AS ENUM ('ui', 'mcp');
CREATE TYPE public.due_window AS ENUM ('morning', 'afternoon', 'evening');
CREATE TYPE public.list_kind AS ENUM ('shopping', 'packing', 'errands', 'prep', 'other');
CREATE TYPE public.routine_cadence AS ENUM ('daily', 'weekly', 'custom');
CREATE TYPE public.calendar_status AS ENUM ('active', 'needs_reauth', 'error');
CREATE TYPE public.actor_type AS ENUM ('user', 'mcp');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  color TEXT NOT NULL DEFAULT '#5F6F52',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- HOUSEHOLDS
-- =========================================================
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Our Household',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_memberships (
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'adult',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_memberships TO authenticated;
GRANT ALL ON public.household_memberships TO service_role;
ALTER TABLE public.household_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_invites TO authenticated;
GRANT ALL ON public.household_invites TO service_role;
ALTER TABLE public.household_invites ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ACCESS HELPERS (security definer to avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_household_access(_user_id UUID, _household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_memberships
    WHERE household_id = _household_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.current_household_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.household_memberships
  WHERE user_id = _user_id
  ORDER BY joined_at ASC
  LIMIT 1;
$$;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  due_window public.due_window,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  repeat_rule JSONB,
  source public.task_source NOT NULL DEFAULT 'ui',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.tasks (household_id, status, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ROUTINES
-- =========================================================
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence public.routine_cadence NOT NULL DEFAULT 'daily',
  schedule JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routines TO authenticated;
GRANT ALL ON public.routines TO service_role;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_steps TO authenticated;
GRANT ALL ON public.routine_steps TO service_role;
ALTER TABLE public.routine_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routine_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  scheduled_for DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (routine_id, scheduled_for)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_instances TO authenticated;
GRANT ALL ON public.routine_instances TO service_role;
ALTER TABLE public.routine_instances ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routine_step_completions (
  instance_id UUID NOT NULL REFERENCES public.routine_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.routine_steps(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, step_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_step_completions TO authenticated;
GRANT ALL ON public.routine_step_completions TO service_role;
ALTER TABLE public.routine_step_completions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- LISTS
-- =========================================================
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.list_kind NOT NULL DEFAULT 'other',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items TO authenticated;
GRANT ALL ON public.list_items TO service_role;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- NOTES
-- =========================================================
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- CALENDAR
-- =========================================================
CREATE TABLE public.calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  google_account_email TEXT,
  connection_key_ciphertext TEXT,
  status public.calendar_status NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.imported_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, google_event_id)
);
CREATE INDEX ON public.imported_events (household_id, start_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_events TO authenticated;
GRANT ALL ON public.imported_events TO service_role;
ALTER TABLE public.imported_events ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ACTIVITY LOG
-- =========================================================
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_type public.actor_type NOT NULL DEFAULT 'user',
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_client_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  summary TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.activity_log (household_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- POLICIES
-- =========================================================

-- Profiles: everyone signed-in reads any profile (needed to show member names/avatars);
-- users only update their own.
CREATE POLICY "profiles select all authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Households
CREATE POLICY "households select members" ON public.households
  FOR SELECT TO authenticated USING (public.has_household_access(auth.uid(), id));
CREATE POLICY "households insert self" ON public.households
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "households update members" ON public.households
  FOR UPDATE TO authenticated USING (public.has_household_access(auth.uid(), id));

-- Memberships
CREATE POLICY "memberships select self" ON public.household_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_household_access(auth.uid(), household_id));
CREATE POLICY "memberships insert self" ON public.household_memberships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "memberships delete members" ON public.household_memberships
  FOR DELETE TO authenticated USING (public.has_household_access(auth.uid(), household_id));

-- Invites (creator manages, invitee reads by token via service_role/edge)
CREATE POLICY "invites select members" ON public.household_invites
  FOR SELECT TO authenticated USING (public.has_household_access(auth.uid(), household_id));
CREATE POLICY "invites insert members" ON public.household_invites
  FOR INSERT TO authenticated WITH CHECK (public.has_household_access(auth.uid(), household_id) AND invited_by = auth.uid());
CREATE POLICY "invites delete members" ON public.household_invites
  FOR DELETE TO authenticated USING (public.has_household_access(auth.uid(), household_id));

-- Generic household-scoped policy generator via repeat
CREATE POLICY "tasks all household" ON public.tasks FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "routines all household" ON public.routines FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "routine_steps all household" ON public.routine_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND public.has_household_access(auth.uid(), r.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.routines r WHERE r.id = routine_id AND public.has_household_access(auth.uid(), r.household_id)));

CREATE POLICY "routine_instances all household" ON public.routine_instances FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "routine_step_completions all household" ON public.routine_step_completions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routine_instances ri WHERE ri.id = instance_id AND public.has_household_access(auth.uid(), ri.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.routine_instances ri WHERE ri.id = instance_id AND public.has_household_access(auth.uid(), ri.household_id)));

CREATE POLICY "lists all household" ON public.lists FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "list_items all household" ON public.list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND public.has_household_access(auth.uid(), l.household_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND public.has_household_access(auth.uid(), l.household_id)));

CREATE POLICY "notes all household" ON public.notes FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "calendar_connections all household" ON public.calendar_connections FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "imported_events all household" ON public.imported_events FOR ALL TO authenticated
  USING (public.has_household_access(auth.uid(), household_id))
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

CREATE POLICY "activity_log select household" ON public.activity_log FOR SELECT TO authenticated
  USING (public.has_household_access(auth.uid(), household_id));
CREATE POLICY "activity_log insert household" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (public.has_household_access(auth.uid(), household_id));

-- =========================================================
-- HOUSEHOLD BOOTSTRAP: create household + membership + starter routines atomically
-- =========================================================
CREATE OR REPLACE FUNCTION public.create_household(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hid UUID;
  _uid UUID := auth.uid();
  _morning UUID;
  _evening UUID;
  _weekly UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.households (name, created_by) VALUES (COALESCE(NULLIF(_name, ''), 'Our Household'), _uid)
  RETURNING id INTO _hid;

  INSERT INTO public.household_memberships (household_id, user_id, role)
  VALUES (_hid, _uid, 'adult');

  INSERT INTO public.routines (household_id, name, cadence, order_index) VALUES
    (_hid, 'Morning Reset', 'daily', 0) RETURNING id INTO _morning;
  INSERT INTO public.routines (household_id, name, cadence, order_index) VALUES
    (_hid, 'Evening Wind-down', 'daily', 1) RETURNING id INTO _evening;
  INSERT INTO public.routines (household_id, name, cadence, order_index) VALUES
    (_hid, 'Weekly Reset', 'weekly', 2) RETURNING id INTO _weekly;

  INSERT INTO public.routine_steps (routine_id, title, order_index) VALUES
    (_morning, 'Empty dishwasher', 0),
    (_morning, 'Start a load of laundry', 1),
    (_morning, 'Wipe kitchen counters', 2),
    (_evening, 'Tidy living room', 0),
    (_evening, 'Prep tomorrow''s bags', 1),
    (_evening, 'Set coffee for the morning', 2),
    (_weekly, 'Take bins out', 0),
    (_weekly, 'Grocery restock', 1),
    (_weekly, 'Plan the week ahead', 2);

  INSERT INTO public.activity_log (household_id, actor_type, actor_user_id, action, entity_type, entity_id, summary)
  VALUES (_hid, 'user', _uid, 'create', 'household', _hid, 'Household created');

  RETURN _hid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated;

-- Accept invite (called via authenticated RPC by the invitee)
CREATE OR REPLACE FUNCTION public.accept_household_invite(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _inv public.household_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _inv FROM public.household_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found'; END IF;
  IF _inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invite already accepted'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'invite expired'; END IF;

  INSERT INTO public.household_memberships (household_id, user_id, role)
  VALUES (_inv.household_id, _uid, 'adult')
  ON CONFLICT DO NOTHING;

  UPDATE public.household_invites SET accepted_at = now() WHERE id = _inv.id;

  INSERT INTO public.activity_log (household_id, actor_type, actor_user_id, action, entity_type, entity_id, summary)
  VALUES (_inv.household_id, 'user', _uid, 'join', 'household', _inv.household_id, 'Joined the household');

  RETURN _inv.household_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_household_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_household_id(UUID) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_step_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imported_events;

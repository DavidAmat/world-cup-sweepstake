-- ============================================================================
-- Migration: app_now() override — testable "current date"
-- ----------------------------------------------------------------------------
-- The initial-predictions lock is enforced in TWO places that must agree:
--  · the app (getInitialLockState → rpc are_initial_predictions_locked)
--  · the RLS policies on initial_predictions / group_qualification_predictions
--    (they call are_initial_predictions_locked internally)
--
-- So a "fake now" used only in the app would desync RLS: writes would still
-- be allowed and other users' rows would stay hidden. To let us simulate a
-- moved current date (env var FECHA_ACTUAL), the override has to live where
-- BOTH layers read it: the database.
--
-- public.app_settings.fecha_actual holds the simulated instant (NULL = use
-- real now()). public.app_now() returns it. are_initial_predictions_locked
-- now compares against app_now() instead of now(); RLS follows for free.
-- The Next app keeps app_settings in sync from the FECHA_ACTUAL env var.
-- ============================================================================


-- ─────────────────────────── app_settings (single row) ──────────────────────

create table public.app_settings (
  id            boolean primary key default true check (id),
  fecha_actual  timestamptz,
  updated_at    timestamptz not null default now()
);

insert into public.app_settings (id, fecha_actual) values (true, null);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();


-- ─────────────────────────── app_now() ──────────────────────────────────────
-- SECURITY DEFINER so it can read app_settings from inside RLS policy
-- evaluation (which runs as the querying role) without needing a broad
-- select grant on the table.

create or replace function public.app_now()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select fecha_actual from public.app_settings where id),
    now()
  )
$$;


-- ─────────────────────────── re-point the lock check ────────────────────────
-- Only the boolean check changes (now() → app_now()). initial_predictions_
-- lock_at is unchanged (predictions_open_until, else min(kickoff_at)).

create or replace function public.are_initial_predictions_locked(p_tournament_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    public.app_now() >= public.initial_predictions_lock_at(p_tournament_id),
    false
  )
$$;


-- ─────────────────────────── RLS · app_settings ─────────────────────────────

alter table public.app_settings enable row level security;

-- Readable by any authenticated user (handy for a debug banner / Studio).
create policy "app_settings_select_authenticated"
  on public.app_settings for select to authenticated using (true);

-- Only admins can change it through the anon/authenticated path. The Next
-- app syncs it from the env var using the service-role client, which
-- bypasses RLS anyway.
create policy "app_settings_admin_all"
  on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

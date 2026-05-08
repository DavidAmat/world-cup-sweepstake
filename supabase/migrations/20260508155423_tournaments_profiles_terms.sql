-- ============================================================================
-- Migration: tournaments + profiles + terms_acceptances
-- ----------------------------------------------------------------------------
-- Creates the core "who and what" tables of the app:
--  · tournaments: each World Cup edition or test environment.
--  · profiles: 1:1 with auth.users with display_name, initials and role.
--  · terms_acceptances: trail of which user accepted which rules version.
--
-- Also installs two helper functions used across later migrations:
--  · public.is_admin()        → boolean, used by RLS policies.
--  · public.set_updated_at()  → trigger function for auto-stamping updates.
-- ============================================================================


-- ─────────────────────────── helpers ────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;


-- ─────────────────────────── tournaments ────────────────────────────────────

create table public.tournaments (
  id                          uuid primary key default gen_random_uuid(),
  slug                        citext not null unique,
  name                        text not null,
  year                        integer not null,
  status                      text not null default 'draft'
                                check (status in ('draft','active','completed','archived')),
  is_test                     boolean not null default false,
  predictions_open_until      timestamptz,
  group_qualifiers_per_group  integer not null default 2
                                check (group_qualifiers_per_group between 1 and 4),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();


-- ─────────────────────────── profiles ───────────────────────────────────────

create table public.profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  initials      text not null,
  role          text not null default 'player'
                  check (role in ('admin','player')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- is_admin must be declared after profiles exists.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.role = 'admin'
  )
$$;


-- ─────────────────────────── terms_acceptances ──────────────────────────────

create table public.terms_acceptances (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  rules_version   integer not null,
  accepted_at     timestamptz not null default now(),
  unique (tournament_id, user_id, rules_version)
);


-- ─────────────────────────── RLS · tournaments ──────────────────────────────

alter table public.tournaments enable row level security;

create policy "tournaments_select_authenticated"
  on public.tournaments
  for select
  to authenticated
  using (true);

create policy "tournaments_admin_all"
  on public.tournaments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ─────────────────────────── RLS · profiles ─────────────────────────────────

alter table public.profiles enable row level security;

-- Anyone authenticated can read profiles (needed for leaderboard names).
create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- A user may update only their own profile, and may NOT change the role.
-- Admins can do anything via the all-admin policy below.
create policy "profiles_update_own_no_role_change"
  on public.profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and role = (select role from public.profiles where user_id = (select auth.uid()))
  );

create policy "profiles_admin_all"
  on public.profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ─────────────────────────── RLS · terms_acceptances ────────────────────────

alter table public.terms_acceptances enable row level security;

-- Users see their own acceptances; admins see all.
create policy "terms_acceptances_select_own_or_admin"
  on public.terms_acceptances
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- A user can record only their own acceptance.
create policy "terms_acceptances_insert_own"
  on public.terms_acceptances
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- No update/delete for non-admins (audit trail).
create policy "terms_acceptances_admin_all"
  on public.terms_acceptances
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

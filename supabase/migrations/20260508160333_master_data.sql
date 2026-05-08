-- ============================================================================
-- Migration: master data — teams, players, stages, rounds
-- ----------------------------------------------------------------------------
-- These are the per-tournament catalog tables. They are loaded from JSON
-- seeds (hito 06) and may be tweaked by the admin (hito 07). All four
-- tables share the same RLS shape: select for authenticated, write for admin.
-- ============================================================================


-- ─────────────────────────── teams ──────────────────────────────────────────

create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  external_id     text,
  code            citext not null,
  canonical_name  text not null,
  display_name    text not null,
  aliases         jsonb not null default '[]'::jsonb,
  group_code      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, code),
  unique (tournament_id, external_id)
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create index teams_tournament_idx on public.teams (tournament_id);
create index teams_group_idx on public.teams (tournament_id, group_code) where group_code is not null;


-- ─────────────────────────── players ────────────────────────────────────────

create table public.players (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete restrict,
  external_id     text,
  canonical_name  text not null,
  display_name    text not null,
  aliases         jsonb not null default '[]'::jsonb,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, external_id)
);

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create index players_team_idx on public.players (team_id);
create index players_tournament_active_idx on public.players (tournament_id, active);


-- ─────────────────────────── stages ─────────────────────────────────────────

-- Catalog of phases per tournament (group_stage, round_of_16, ...). Each phase
-- has a sort_order for display and a score_multiplier consumed by the scoring
-- engine in hito 11 (e.g. final ×2, group ×1).
create table public.stages (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references public.tournaments(id) on delete cascade,
  code               citext not null,
  name               text not null,
  sort_order         integer not null,
  score_multiplier   numeric(4,2) not null default 1.00 check (score_multiplier > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tournament_id, code)
);

create trigger stages_set_updated_at
  before update on public.stages
  for each row execute function public.set_updated_at();

create index stages_tournament_order_idx on public.stages (tournament_id, sort_order);


-- ─────────────────────────── rounds ─────────────────────────────────────────

-- A round is a "matchday" inside a stage. For group_stage we'll have
-- group_md1..3; for knockouts each round is a single block (r16, qf, ...).
create table public.rounds (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  stage_id        uuid not null references public.stages(id) on delete cascade,
  code            citext not null,
  name            text not null,
  sort_order      integer not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tournament_id, code)
);

create trigger rounds_set_updated_at
  before update on public.rounds
  for each row execute function public.set_updated_at();

create index rounds_tournament_order_idx on public.rounds (tournament_id, sort_order);
create index rounds_stage_idx on public.rounds (stage_id);


-- ─────────────────────────── RLS · all four tables ──────────────────────────

alter table public.teams   enable row level security;
alter table public.players enable row level security;
alter table public.stages  enable row level security;
alter table public.rounds  enable row level security;

create policy "teams_select_authenticated"   on public.teams   for select to authenticated using (true);
create policy "players_select_authenticated" on public.players for select to authenticated using (true);
create policy "stages_select_authenticated"  on public.stages  for select to authenticated using (true);
create policy "rounds_select_authenticated"  on public.rounds  for select to authenticated using (true);

create policy "teams_admin_all"   on public.teams   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "players_admin_all" on public.players for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stages_admin_all"  on public.stages  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "rounds_admin_all"  on public.rounds  for all to authenticated using (public.is_admin()) with check (public.is_admin());

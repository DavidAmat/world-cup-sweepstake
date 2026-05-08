-- ============================================================================
-- Migration: fixtures + match_results + match_goals + player_match_stats
-- ----------------------------------------------------------------------------
-- The "what happened on the pitch" half of the schema. Fixtures are loaded
-- from seed JSONs (hito 06). The admin manually fills the result for each
-- fixture (hito 10). Goals are individual rows per fixture so the admin can
-- edit/delete them without rewriting the whole result.
--
-- Also installs public.is_fixture_locked() used by prediction RLS in mig 5.
-- ============================================================================


-- ─────────────────────────── fixtures ───────────────────────────────────────

create table public.fixtures (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references public.tournaments(id) on delete cascade,
  stage_id           uuid not null references public.stages(id)  on delete restrict,
  round_id           uuid not null references public.rounds(id)  on delete restrict,
  group_code         text,
  home_team_id       uuid references public.teams(id) on delete set null,
  away_team_id       uuid references public.teams(id) on delete set null,
  home_placeholder   text,
  away_placeholder   text,
  kickoff_at         timestamptz not null,
  venue              text,
  external_id        text,
  status             text not null default 'scheduled'
                       check (status in ('scheduled','locked','completed','cancelled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tournament_id, external_id),
  -- Each side must be either an actual team or a placeholder string
  -- (e.g. "Winner Group A" before knockout brackets are resolved).
  check (home_team_id is not null or home_placeholder is not null),
  check (away_team_id is not null or away_placeholder is not null)
);

create trigger fixtures_set_updated_at
  before update on public.fixtures
  for each row execute function public.set_updated_at();

create index fixtures_tournament_kickoff_idx on public.fixtures (tournament_id, kickoff_at);
create index fixtures_round_idx on public.fixtures (tournament_id, round_id);
create index fixtures_status_idx on public.fixtures (tournament_id, status);


-- ─────────────────────────── helper: is_fixture_locked ──────────────────────

-- Returns true once we are within 24h of kickoff. Used by RLS policies on
-- predictions: writes are denied past the lock, and reads are allowed for
-- everyone (predictions become public) once the fixture is locked.
create or replace function public.is_fixture_locked(p_fixture_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    now() >= (select kickoff_at - interval '24 hours' from public.fixtures where id = p_fixture_id),
    false
  )
$$;


-- ─────────────────────────── match_results ──────────────────────────────────

create table public.match_results (
  id                       uuid primary key default gen_random_uuid(),
  tournament_id            uuid not null references public.tournaments(id) on delete cascade,
  fixture_id               uuid not null unique references public.fixtures(id) on delete cascade,
  home_goals_90            integer not null check (home_goals_90 >= 0),
  away_goals_90            integer not null check (away_goals_90 >= 0),
  went_extra_time          boolean not null default false,
  home_goals_120           integer check (home_goals_120 is null or home_goals_120 >= 0),
  away_goals_120           integer check (away_goals_120 is null or away_goals_120 >= 0),
  went_penalties           boolean not null default false,
  penalty_winner_team_id   uuid references public.teams(id) on delete set null,
  winner_team_id           uuid references public.teams(id) on delete set null,
  qualified_team_id        uuid references public.teams(id) on delete set null,
  result_status            text not null default 'draft'
                             check (result_status in ('draft','confirmed')),
  created_by               uuid references public.profiles(user_id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- 120' goals are present iff extra time happened.
  check (
    (went_extra_time = false and home_goals_120 is null and away_goals_120 is null)
    or
    (went_extra_time = true  and home_goals_120 is not null and away_goals_120 is not null)
  ),
  -- Penalties imply extra time and a recorded winner.
  check (
    (went_penalties = false and penalty_winner_team_id is null)
    or
    (went_penalties = true  and went_extra_time = true and penalty_winner_team_id is not null)
  )
);

create trigger match_results_set_updated_at
  before update on public.match_results
  for each row execute function public.set_updated_at();

create index match_results_status_idx on public.match_results (tournament_id, result_status);


-- ─────────────────────────── match_goals ────────────────────────────────────

create table public.match_goals (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  fixture_id      uuid not null references public.fixtures(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete restrict,
  player_id       uuid references public.players(id) on delete set null,
  minute          integer check (minute is null or minute between 0 and 130),
  period          text check (period in ('first_half','second_half','extra_time_first','extra_time_second','unknown')),
  own_goal        boolean not null default false,
  penalty_goal    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger match_goals_set_updated_at
  before update on public.match_goals
  for each row execute function public.set_updated_at();

create index match_goals_fixture_idx on public.match_goals (fixture_id);
create index match_goals_player_idx on public.match_goals (player_id) where player_id is not null;


-- ─────────────────────────── player_match_stats ─────────────────────────────

-- Optional, alimented progresivamente by the admin (hito 13 stats page).
-- One row per (fixture, player). Empty by default for tournaments where
-- the admin doesn't want to maintain detail.
create table public.player_match_stats (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  fixture_id      uuid not null references public.fixtures(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete restrict,
  player_id       uuid not null references public.players(id) on delete cascade,
  minutes_played  integer check (minutes_played is null or minutes_played between 0 and 130),
  goals           integer not null default 0 check (goals >= 0),
  assists         integer not null default 0 check (assists >= 0),
  yellow_cards    integer not null default 0 check (yellow_cards between 0 and 2),
  red_cards       integer not null default 0 check (red_cards between 0 and 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (fixture_id, player_id)
);

create trigger player_match_stats_set_updated_at
  before update on public.player_match_stats
  for each row execute function public.set_updated_at();


-- ─────────────────────────── RLS · all four tables ──────────────────────────

alter table public.fixtures           enable row level security;
alter table public.match_results      enable row level security;
alter table public.match_goals        enable row level security;
alter table public.player_match_stats enable row level security;

create policy "fixtures_select_authenticated"           on public.fixtures           for select to authenticated using (true);
create policy "match_results_select_authenticated"      on public.match_results      for select to authenticated using (true);
create policy "match_goals_select_authenticated"        on public.match_goals        for select to authenticated using (true);
create policy "player_match_stats_select_authenticated" on public.player_match_stats for select to authenticated using (true);

create policy "fixtures_admin_all"           on public.fixtures           for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "match_results_admin_all"      on public.match_results      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "match_goals_admin_all"        on public.match_goals        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "player_match_stats_admin_all" on public.player_match_stats for all to authenticated using (public.is_admin()) with check (public.is_admin());

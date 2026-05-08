-- ============================================================================
-- Migration: predictions
-- ----------------------------------------------------------------------------
-- Three flavours of prediction:
--  · initial_predictions: champion / runner-up / top scorer / best player.
--    One row per (tournament, user). Lock = tournament-level cutoff
--    (predictions_open_until, computed in app from min(kickoff_at) - 24h
--    when null in the tournaments row).
--  · group_qualification_predictions: 1..N teams the user thinks will
--    qualify out of each group. One row per (tournament, user, group, team).
--    Same tournament-level lock as initial.
--  · match_predictions: per-fixture predictions with all the knockout
--    extras (extra time, penalties, qualified team). Lock = per-fixture,
--    via public.is_fixture_locked().
-- ============================================================================


-- ─────────────────────────── initial_predictions ────────────────────────────

create table public.initial_predictions (
  id                     uuid primary key default gen_random_uuid(),
  tournament_id          uuid not null references public.tournaments(id) on delete cascade,
  user_id                uuid not null references public.profiles(user_id) on delete cascade,
  champion_team_id       uuid references public.teams(id) on delete restrict,
  runner_up_team_id      uuid references public.teams(id) on delete restrict,
  top_scorer_player_id   uuid references public.players(id) on delete restrict,
  best_player_id         uuid references public.players(id) on delete restrict,
  submitted_at           timestamptz,
  locked_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create trigger initial_predictions_set_updated_at
  before update on public.initial_predictions
  for each row execute function public.set_updated_at();


-- ─────────────────────────── group_qualification_predictions ────────────────

create table public.group_qualification_predictions (
  id                   uuid primary key default gen_random_uuid(),
  tournament_id        uuid not null references public.tournaments(id) on delete cascade,
  user_id              uuid not null references public.profiles(user_id) on delete cascade,
  group_code           text not null,
  team_id              uuid not null references public.teams(id) on delete restrict,
  predicted_position   integer check (predicted_position is null or predicted_position between 1 and 4),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tournament_id, user_id, group_code, team_id)
);

create trigger group_qualification_predictions_set_updated_at
  before update on public.group_qualification_predictions
  for each row execute function public.set_updated_at();

create index group_qualification_predictions_user_idx
  on public.group_qualification_predictions (tournament_id, user_id);


-- ─────────────────────────── match_predictions ──────────────────────────────

create table public.match_predictions (
  id                            uuid primary key default gen_random_uuid(),
  tournament_id                 uuid not null references public.tournaments(id) on delete cascade,
  fixture_id                    uuid not null references public.fixtures(id) on delete cascade,
  user_id                       uuid not null references public.profiles(user_id) on delete cascade,
  home_goals_90                 integer not null check (home_goals_90 >= 0),
  away_goals_90                 integer not null check (away_goals_90 >= 0),
  predicts_extra_time           boolean not null default false,
  home_goals_120                integer check (home_goals_120 is null or home_goals_120 >= 0),
  away_goals_120                integer check (away_goals_120 is null or away_goals_120 >= 0),
  predicts_penalties            boolean not null default false,
  predicted_winner_team_id      uuid references public.teams(id) on delete set null,
  predicted_qualified_team_id   uuid references public.teams(id) on delete set null,
  submitted_at                  timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (fixture_id, user_id),
  check (
    (predicts_extra_time = false and home_goals_120 is null and away_goals_120 is null)
    or
    (predicts_extra_time = true  and home_goals_120 is not null and away_goals_120 is not null)
  ),
  -- Penalties imply extra time.
  check (predicts_penalties = false or predicts_extra_time = true)
);

create trigger match_predictions_set_updated_at
  before update on public.match_predictions
  for each row execute function public.set_updated_at();

create index match_predictions_user_tournament_idx on public.match_predictions (tournament_id, user_id);
create index match_predictions_fixture_idx on public.match_predictions (fixture_id);


-- ─────────────────────────── RLS · initial_predictions ──────────────────────

alter table public.initial_predictions enable row level security;

-- Users see their own predictions. Admins see everything. Public visibility
-- of OTHER users' initial predictions is decided in hito 08 (likely once
-- the tournament-level lock is past); for now stay strict.
create policy "initial_predictions_select_own_or_admin"
  on public.initial_predictions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "initial_predictions_insert_own"
  on public.initial_predictions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "initial_predictions_update_own"
  on public.initial_predictions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "initial_predictions_delete_own"
  on public.initial_predictions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "initial_predictions_admin_all"
  on public.initial_predictions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ─────────────────────────── RLS · group_qualification_predictions ──────────

alter table public.group_qualification_predictions enable row level security;

create policy "gqp_select_own_or_admin"
  on public.group_qualification_predictions for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "gqp_insert_own"
  on public.group_qualification_predictions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "gqp_update_own"
  on public.group_qualification_predictions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "gqp_delete_own"
  on public.group_qualification_predictions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "gqp_admin_all"
  on public.group_qualification_predictions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ─────────────────────────── RLS · match_predictions ────────────────────────

alter table public.match_predictions enable row level security;

-- Own row is always visible to the owner. Other users' rows are visible
-- only after the fixture is locked (within 24h of kickoff). Admins see all.
create policy "match_predictions_select_own_or_locked"
  on public.match_predictions for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_fixture_locked(fixture_id)
    or public.is_admin()
  );

-- Insert/update/delete only own row, only before lock. Admins bypass via
-- the admin policy below.
create policy "match_predictions_insert_own_unlocked"
  on public.match_predictions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not public.is_fixture_locked(fixture_id)
  );

create policy "match_predictions_update_own_unlocked"
  on public.match_predictions for update to authenticated
  using (
    user_id = (select auth.uid())
    and not public.is_fixture_locked(fixture_id)
  )
  with check (
    user_id = (select auth.uid())
    and not public.is_fixture_locked(fixture_id)
  );

create policy "match_predictions_delete_own_unlocked"
  on public.match_predictions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not public.is_fixture_locked(fixture_id)
  );

create policy "match_predictions_admin_all"
  on public.match_predictions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

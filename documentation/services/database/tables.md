> Context: [`context/07-database.md`](../../../context/07-database.md)

# Database Tables

Every table in `public` schema. Source of truth: `supabase/migrations/*` and `src/lib/supabase/database.types.ts`.

## tournaments

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| slug | citext UNIQUE | e.g. `wc_2026` |
| name | text | |
| year | integer | |
| status | text | `draft \| active \| completed \| archived` |
| is_test | boolean | default false |
| predictions_open_until | timestamptz | optional cutoff (legacy; lock is admin-controlled) |
| group_qualifiers_per_group | integer | default 2, check 1–4 |
| initial_predictions_locked_at | timestamptz | admin manual lock (NULL = open) |
| created_at, updated_at | timestamptz | `set_updated_at` trigger |

## profiles

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid PK | FK → `auth.users(id)` CASCADE |
| display_name | text | |
| initials | text | auto from display name on signup |
| role | text | `admin \| player` |
| must_change_password | boolean | default `false`; `true` forces `/cambiar-password`. Pinned in self-update RLS |
| is_scam | boolean | default `false`; `true` shows the `ScamExperience` prank. Pinned in self-update RLS |
| created_at, updated_at | timestamptz | |

## login_events

Login audit log — one row per successful email/password sign-in (no locking; logins only).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → profiles CASCADE | |
| logged_at | timestamptz | default `now()` (UTC; displayed in Madrid) |
| INDEX | (logged_at desc) | |

RLS: `login_events_admin_all` (admin read). Inserted by the `signIn` action via the service-role client.

## terms_acceptances

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK → tournaments CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| rules_version | integer | matches `scoring_rules.version` |
| accepted_at | timestamptz | |
| UNIQUE | (tournament_id, user_id, rules_version) | |

## app_settings

Single-row table for global app config.

| Column | Type | Notes |
|--------|------|-------|
| id | boolean PK | always `true` (singleton check) |
| fecha_actual | timestamptz | NULL = use real `now()` via `app_now()` |
| updated_at | timestamptz | |

## teams

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| external_id | text | seed upsert key |
| code | citext | UNIQUE (tournament_id, code) |
| canonical_name, display_name | text | |
| aliases | jsonb | default `[]` |
| group_code | text | nullable (knockout teams may lack group) |
| created_at, updated_at | timestamptz | |

## players

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| team_id | uuid FK → teams RESTRICT | |
| external_id | text | UNIQUE (tournament_id, external_id) |
| canonical_name, display_name | text | |
| aliases | jsonb | |
| active | boolean | default true |
| created_at, updated_at | timestamptz | |

## stages

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| code | citext | UNIQUE (tournament_id, code) |
| name | text | |
| sort_order | integer | |
| score_multiplier | numeric(4,2) | > 0; used by scoring engine |
| created_at, updated_at | timestamptz | |

## rounds

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| stage_id | uuid FK CASCADE | |
| code | citext | UNIQUE (tournament_id, code) |
| name | text | |
| sort_order | integer | |
| predictions_locked_at | timestamptz | admin manual jornada lock |
| predictions_locked_by | uuid FK → profiles SET NULL | |
| created_at, updated_at | timestamptz | |

## fixtures

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| stage_id | uuid FK RESTRICT | |
| round_id | uuid FK RESTRICT | |
| group_code | text | nullable |
| home_team_id, away_team_id | uuid FK → teams SET NULL | |
| home_placeholder, away_placeholder | text | knockout placeholders |
| kickoff_at | timestamptz | |
| venue | text | |
| external_id | text | UNIQUE (tournament_id, external_id) |
| status | text | `scheduled \| locked \| completed \| cancelled` |
| CHECK | home side | team_id OR placeholder required |
| CHECK | away side | team_id OR placeholder required |
| created_at, updated_at | timestamptz | |

## match_results

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| fixture_id | uuid UNIQUE FK CASCADE | |
| home_goals_90, away_goals_90 | integer | ≥ 0 |
| went_extra_time | boolean | |
| home_goals_120, away_goals_120 | integer | nullable; dropped from app logic but columns may exist |
| went_penalties | boolean | |
| penalty_winner_team_id | uuid FK → teams SET NULL | |
| winner_team_id | uuid FK → teams SET NULL | |
| qualified_team_id | uuid FK → teams SET NULL | |
| result_status | text | `draft \| confirmed` |
| created_by | uuid FK → profiles SET NULL | |
| created_at, updated_at | timestamptz | |

## match_goals

Individual goal rows per fixture (admin-entered).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| fixture_id | uuid FK CASCADE | |
| team_id | uuid FK RESTRICT | |
| player_id | uuid FK → players SET NULL | |
| minute | integer | 0–130 or null |
| period | text | `first_half \| second_half \| extra_time_first \| extra_time_second \| unknown` |
| own_goal, penalty_goal | boolean | |
| created_at, updated_at | timestamptz | |

## player_match_stats

Optional per-player fixture stats. No UI after hito 13 deletion.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| fixture_id | uuid FK CASCADE | |
| team_id | uuid FK RESTRICT | |
| player_id | uuid FK CASCADE | |
| minutes_played | integer | 0–130 |
| goals, assists | integer | ≥ 0 |
| yellow_cards | integer | 0–2 |
| red_cards | integer | 0–1 |
| UNIQUE | (fixture_id, player_id) | |
| created_at, updated_at | timestamptz | |

## initial_predictions

One row per (tournament, user).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| champion_team_id, runner_up_team_id | uuid FK RESTRICT | |
| top_scorer_text, best_player_text | text | 1–80 chars; free text (not FK to players) |
| top_scorer_correct, best_player_correct | boolean | null = unevaluated; admin sets in evaluaciones |
| submitted_at, locked_at | timestamptz | |
| UNIQUE | (tournament_id, user_id) | |
| created_at, updated_at | timestamptz | |

## group_qualification_predictions

One row per (tournament, user, group, team) — **2 or 3 rows per group** (3 in exactly 8 groups, the WC2026 best-thirds rule; see `context/web/initial-predictions.md`). `predicted_position` is always null (order not predicted).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| group_code | text | |
| team_id | uuid FK RESTRICT | |
| predicted_position | integer | 1–4 or null |
| UNIQUE | (tournament_id, user_id, group_code, team_id) | |
| created_at, updated_at | timestamptz | |

## match_predictions

One row per (fixture, user).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| fixture_id | uuid FK CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| home_goals_90, away_goals_90 | integer | ≥ 0 |
| predicts_extra_time | boolean | |
| home_goals_120, away_goals_120 | integer | nullable; columns exist but 120' scoring dropped |
| predicts_penalties | boolean | implies extra time |
| predicted_winner_team_id | uuid FK SET NULL | |
| predicted_qualified_team_id | uuid FK SET NULL | |
| submitted_at | timestamptz | |
| UNIQUE | (fixture_id, user_id) | |
| created_at, updated_at | timestamptz | |

## scoring_rules

Versioned JSON rule sets.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| version | integer | > 0; UNIQUE (tournament_id, version) |
| rules | jsonb | point values + multipliers |
| active | boolean | partial unique: one active per tournament |
| created_at, updated_at | timestamptz | |

## prediction_scores

Derived by recalculation engine.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| fixture_id | uuid FK CASCADE | null for initial / group_qualification |
| prediction_type | text | `group_phase \| knockout \| initial \| group_qualification` |
| scoring_rules_version | integer | |
| points_total | numeric(8,2) | |
| points_breakdown | jsonb | per-criterion detail |
| calculated_at | timestamptz | |

## leaderboard_snapshots

Materialized standings per round (evolution chart).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tournament_id | uuid FK CASCADE | |
| round_id | uuid FK CASCADE | |
| user_id | uuid FK → profiles CASCADE | |
| total_points | numeric(10,2) | |
| rank | integer | > 0 |
| UNIQUE | (tournament_id, round_id, user_id) | |
| created_at | timestamptz | |

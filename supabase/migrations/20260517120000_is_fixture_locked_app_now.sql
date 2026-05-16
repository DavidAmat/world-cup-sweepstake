-- ============================================================================
-- Migration: is_fixture_locked → app_now()
-- ----------------------------------------------------------------------------
-- The per-fixture prediction lock (PID §4.4: now >= kickoff - 24h) was
-- defined against now(). Re-point it to public.app_now() so the FECHA_ACTUAL
-- testing override (app_settings.fecha_actual, hito 08) also simulates the
-- match-prediction lock. Same signature, same body shape, only now() changes.
-- RLS policies on match_predictions already call this function, so the
-- change propagates with no policy edits.
-- ============================================================================

create or replace function public.is_fixture_locked(p_fixture_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    public.app_now() >= (
      select kickoff_at - interval '24 hours'
        from public.fixtures where id = p_fixture_id
    ),
    false
  )
$$;

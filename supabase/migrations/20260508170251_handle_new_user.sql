-- ============================================================================
-- Migration: handle_new_user trigger
-- ----------------------------------------------------------------------------
-- Whenever a row is inserted in auth.users (i.e. someone registers via
-- supabase.auth.signUp()), automatically create the matching public.profiles
-- row with role='player'. Display name comes from the signup metadata
-- (raw_user_meta_data.display_name); if absent, falls back to the email
-- prefix.
--
-- SECURITY DEFINER + locked search_path is required because the new user
-- doesn't have insert privileges on profiles (no RLS policy grants it to
-- regular authenticated users — admin only).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_display_name text;
begin
  computed_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (user_id, display_name, initials, role)
  values (
    new.id,
    computed_display_name,
    upper(left(computed_display_name, 2)),
    'player'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

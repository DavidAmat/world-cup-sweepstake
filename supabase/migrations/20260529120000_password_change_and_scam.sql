-- Forced first-login password change + "scam" prank flag on profiles.
--
-- must_change_password: when true the proxy gate redirects the user to
--   /cambiar-password until they set a new password (clears the flag).
-- is_scam: when true the change-password page renders the prank overlay and
--   the password change is refused server-side.
--
-- Both flags are administrative: a user may edit their own profile but must
-- NOT be able to self-clear these columns. We pin them in the self-update
-- policy (same technique already used for `role`). Only the service-role
-- client (used by the changePassword action and the seed scripts) and admins
-- may change them.

alter table public.profiles
  add column must_change_password boolean not null default false;

alter table public.profiles
  add column is_scam boolean not null default false;

-- Re-create the self-update policy so it also pins the two new flags.
drop policy if exists "profiles_update_own_no_role_change" on public.profiles;

create policy "profiles_update_own_no_role_change"
  on public.profiles
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and role = (select role from public.profiles where user_id = (select auth.uid()))
    and must_change_password = (
      select must_change_password from public.profiles where user_id = (select auth.uid())
    )
    and is_scam = (
      select is_scam from public.profiles where user_id = (select auth.uid())
    )
  );

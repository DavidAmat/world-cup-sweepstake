-- Login audit log: one row per successful email/password sign-in.
--
-- This only records *logins* (the signIn server action inserts here). It does
-- NOT gate or lock anything — sessions stay open as normal, and re-using an
-- already-open session does not add a row. Inserts are done with the
-- service-role client, so no INSERT policy is granted to users; admins read.

create table public.login_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(user_id) on delete cascade,
  logged_at   timestamptz not null default now()
);

create index login_events_logged_at_idx on public.login_events (logged_at desc);

alter table public.login_events enable row level security;

-- Only admins can read the log. Inserts happen via the service-role client
-- (bypasses RLS), so no user-facing insert policy is needed.
create policy "login_events_admin_all"
  on public.login_events
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

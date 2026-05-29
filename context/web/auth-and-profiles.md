# Auth and Profiles

Supabase Auth (email/password), the `profiles` table, role-based admin access, the forced first-login password change, the `/perfil` self-service password change, the "scam" prank account, and the `/rules` terms-acceptance flow.

## What it is

Accounts are **pre-created by the admin** (public self-registration is disabled). Supabase Auth stores credentials in `auth.users`; a Postgres trigger creates a matching `profiles` row with `role = 'player'`. The seed scripts then stamp the real display name, the admin role, and the per-account flags. Each account ships with a **temporary password** and is forced to change it on first login.

The app distinguishes **public** routes (`/`, `/login`), **authenticated** routes (predictions, leaderboards, `/rules`, `/perfil`), and **admin** routes (`/admin/*`). `/register` exists only to redirect to `/login`. Authorization uses three layers: `src/proxy.ts` (session refresh + forced-password gate + `/admin` gate), server-side `requireAuth()` / `requireAdmin()`, and Postgres RLS.

## Account creation, login, registration disabled

Accounts come from `data/users/users_passwords.json` via `scripts/wc2026/create-users.ts` (see `context/data/seeding-and-master-data.md`). That script uses the Auth admin API to create each user with `email_confirm: true` and the temporary password, then sets `must_change_password = true`, `is_scam` (for the prank account), and `role = 'admin'` for `david@porra.com`.

1. **`/register`** — disabled. The page redirects to `/login`; the `signUp` server action also hard-stops with a Spanish "registro deshabilitado" error in case it is ever posted directly.
2. **`handle_new_user` trigger** — after `auth.users` insert, creates `profiles` with `display_name` (metadata or email prefix), `initials` (first two letters, uppercased), and `role = 'player'`.
3. **`/login`** — `signIn` action; errors mapped to Spanish via `translateAuthError`.
4. **Logout** — `signOut` action clears session and redirects to `/`.

Email confirmation is off (`enable_confirmations = false` in `supabase/config.toml`). There is no email-based password reset — users change their own password from `/perfil`, and the admin can reset in Supabase Studio. No OAuth providers.

## Forced password change

On first login each pre-created account still carries `must_change_password = true`. The **`src/proxy.ts` gate** redirects any logged-in user with that flag to **`/cambiar-password`** on every GET navigation (auth pages and the change-password page itself are exempt; only GET is gated so server-action POSTs like sign-out are never intercepted). This runs before render, so it takes priority over the terms-acceptance gate.

- **`/cambiar-password`** (`src/app/cambiar-password/`) — new password + confirm form (`ChangePasswordForm`).
- **`changePassword` action** — validates (min 8, must match), calls `supabase.auth.updateUser({ password })`, then clears `must_change_password` via the **service-role** client (RLS pins this column so the user cannot clear it from their own session). Refuses outright for scam accounts.

After the change the flag is `false`, the gate stops firing, and the user proceeds normally.

## Login audit log & admin Users page

Every successful email/password login inserts one row into **`login_events`** (`user_id`, `logged_at`). The `signIn` action does this with the service-role client, best-effort (failure never blocks login). It records **logins only** — not session refreshes, not other actions, and re-using an already-open session adds nothing. Nothing is locked.

**`/admin/users`** (`src/app/admin/users/page.tsx`, `requireAdmin`) shows two tables built with the service-role client: participants (avatar + display name + email from `auth.users` + role) and **Accesos recientes** (display name + the login timestamp formatted in Madrid via `formatMadridDateTimeFull`). Linked from the `/admin` dashboard.

## Self-service password change (`/perfil`)

**`/perfil`** (`src/app/perfil/`) shows the avatar, display name, email, and role, and reuses `ChangePasswordForm` so any user can change their password at any time (same `changePassword` action, which also idempotently clears the flag). Linked from the header user menu ("Mi perfil"). Display name / initials editing is still not exposed.

## Scam mode (prank account)

One seeded account (`lluis@porra.com`) has `is_scam = true`. For that user `/cambiar-password` renders `ScamExperience` (`src/app/cambiar-password/ScamExperience.tsx`, client component): a full-screen invisible blocker plus disabled form inputs, and a deliberately paced sequence — three **small, mild** Spanish notices fade in one at a time, **every 5 s** (system update, unstable connection, browser compatibility — ambiguous, not obviously a scam; closing one brings it back ~6 s later). **After 30 s** a calm "Actualización disponible" dialog appears with an "Actualizar ahora" button; clicking it drops the scary full-screen red "AMENAZA DETECTADA / contact the administrator" warning. Pure client-side theatre — no navigation, no writes — and `changePassword` also refuses scam accounts server-side, so the password can never change.

## Profiles

`profiles` is 1:1 with `auth.users`:

| Field | Source |
|-------|--------|
| `display_name` | Signup metadata, fallback email prefix |
| `initials` | Auto from display name on signup |
| `role` | `'player'` by default; `'admin'` set by the seed script for David |
| `must_change_password` | `true` for seeded accounts; cleared after the user sets a new password |
| `is_scam` | `true` only for the prank account; drives `ScamExperience` |

All authenticated users can read profiles (leaderboard names). Users may update their own row but cannot change `role`, `must_change_password`, or `is_scam` (the self-update RLS policy pins all three; only the service-role client and admins change them). See `documentation/services/database/rls.md` for policies.

Avatar images in the header are resolved from `display_name` via `lib/profiles/avatars.ts` — see `context/web/avatars-profiles.md`.

## Authorization

**Session:** JWT in HTTP-only cookies. `src/proxy.ts` refreshes tokens on every request via `getClaims()` (local JWKS validation, no extra network roundtrip).

**`requireAuth()`** — server-only; redirects to `/login` if no valid claims. Returns `{ userId, email, supabase }`.

**`requireAdmin()`** — calls `requireAuth()`, loads `profiles.role`, redirects non-admins to `/`.

**`proxy.ts` password gate** — for logged-in GET navigations (outside `/login`, `/register`, `/cambiar-password`), the proxy reads `profiles.must_change_password` and redirects to `/cambiar-password` while it is `true`.

**`proxy.ts` admin gate** — for paths starting with `/admin`, the proxy redirects unauthenticated users to `/login` and non-admins to `/` with a server 307. This runs before page render because `redirect()` inside nested admin Server Components can mis-resolve paths (e.g. `/admin/fixtures` → wrong nested redirect).

Individual pages and server actions still call `requireAuth()` / `requireAdmin()` as defense in depth.

## Terms acceptance (`/rules`)

Before using the app dashboard, logged-in users must accept rules for the active tournament:

1. **`/` (home)** — if logged in and an active tournament exists but no `terms_acceptances` row, redirects to `/rules`.
2. **`/rules`** — Spanish rules and scoring examples; checkbox + submit calls `acceptTerms`.
3. **`acceptTerms`** — inserts into `terms_acceptances` (idempotent on unique constraint). Records `rules_version = 0` (constant in code). The app runs one tournament (`wc_2026`) with one fixed rules set for its lifetime — no new tournaments or scoring-rule versions are planned, so re-acceptance on version change is out of scope.

After acceptance, home shows the feature mosaic dashboard.

## Admin account

`david@porra.com` is promoted to `admin` by `scripts/wc2026/create-users.ts` (`ADMIN_EMAIL` constant). To promote another user manually, in Studio or `psql`:

```sql
update public.profiles set role = 'admin'
 where user_id = (select id from auth.users where email = '<email>');
```

Documented also in `context/04-local-development.md`.

## Header

`components/layout/Header.tsx` (Server Component) reads auth state and profile, passes props to `HeaderClient` (client nav, floating navbar). Shows a login link when anonymous (no "Crear cuenta"); display name, avatar (links to `/perfil`), nav links, "Mi perfil", and sign-out when logged in. Admin users see an Administración link.

## Out of scope (by design)

- OAuth / social login
- Email confirmation flow / email-based password recovery
- Public self-registration (disabled; accounts are pre-created)
- In-app role management UI
- Editable display name / initials (password change is exposed via `/perfil`)

## Where to look deeper

- Routes, actions, schemas, SQL: `documentation/services/web/auth-and-profiles.md`
- Production clean-slate + user-creation runbook: `documentation/implementations/wc2026-clean-slate-and-users.md`
- Security overview: `context/08-security.md`
- Supabase clients: `context/shared/supabase-clients.md`
- `profiles` / `terms_acceptances` schema: `documentation/services/database/tables.md`
- RLS policies: `documentation/services/database/rls.md`
- Avatar resolution: `context/web/avatars-profiles.md` (Phase 2)
- User-facing scoring copy (Spanish): `documentation/user_guides/puntuacion.md` (Phase 2)

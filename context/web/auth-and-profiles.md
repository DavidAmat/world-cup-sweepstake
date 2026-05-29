# Auth and Profiles

Supabase Auth (email/password), the `profiles` table, role-based admin access, and the `/rules` terms-acceptance flow.

## What it is

Players register with email, password, and a display name. Supabase Auth stores credentials in `auth.users`; a Postgres trigger creates a matching `profiles` row with `role = 'player'`. Admins are promoted manually in Supabase Studio or SQL — there is no in-app admin UI for role changes.

The app distinguishes **public** routes (`/`, `/login`, `/register`), **authenticated** routes (predictions, leaderboards, `/rules`), and **admin** routes (`/admin/*`). Authorization uses three layers: `src/proxy.ts` (session refresh + `/admin` gate), server-side `requireAuth()` / `requireAdmin()`, and Postgres RLS.

## Registration and login

1. **`/register`** — form posts to `signUp` server action (`lib/auth/actions.ts`). Sends `display_name` in signup metadata; on success redirects to `/`.
2. **`handle_new_user` trigger** — after `auth.users` insert, creates `profiles` with `display_name` (metadata or email prefix), `initials` (first two letters, uppercased), and `role = 'player'`.
3. **`/login`** — `signIn` action; errors mapped to Spanish via `translateAuthError`.
4. **Logout** — `signOut` action clears session and redirects to `/`.

Email confirmation is off (`enable_confirmations = false` in `supabase/config.toml`). There is no self-service password reset — the admin resets passwords in Supabase Studio. No OAuth providers.

## Profiles

`profiles` is 1:1 with `auth.users`:

| Field | Source |
|-------|--------|
| `display_name` | Signup metadata, fallback email prefix |
| `initials` | Auto from display name on signup |
| `role` | `'player'` by default; `'admin'` via manual promotion |

All authenticated users can read profiles (leaderboard names). Users may update their own row but cannot change `role` (RLS enforces). See `documentation/services/database/rls.md` for policies.

Avatar images in the header are resolved from `display_name` via `lib/profiles/avatars.ts` — see `context/web/avatars-profiles.md`.

## Authorization

**Session:** JWT in HTTP-only cookies. `src/proxy.ts` refreshes tokens on every request via `getClaims()` (local JWKS validation, no extra network roundtrip).

**`requireAuth()`** — server-only; redirects to `/login` if no valid claims. Returns `{ userId, email, supabase }`.

**`requireAdmin()`** — calls `requireAuth()`, loads `profiles.role`, redirects non-admins to `/`.

**`proxy.ts` admin gate** — for paths starting with `/admin`, the proxy redirects unauthenticated users to `/login` and non-admins to `/` with a server 307. This runs before page render because `redirect()` inside nested admin Server Components can mis-resolve paths (e.g. `/admin/fixtures` → wrong nested redirect).

Individual pages and server actions still call `requireAuth()` / `requireAdmin()` as defense in depth.

## Terms acceptance (`/rules`)

Before using the app dashboard, logged-in users must accept rules for the active tournament:

1. **`/` (home)** — if logged in and an active tournament exists but no `terms_acceptances` row, redirects to `/rules`.
2. **`/rules`** — Spanish rules and scoring examples; checkbox + submit calls `acceptTerms`.
3. **`acceptTerms`** — inserts into `terms_acceptances` (idempotent on unique constraint). Records `rules_version = 0` (constant in code). The app runs one tournament (`wc_2026`) with one fixed rules set for its lifetime — no new tournaments or scoring-rule versions are planned, so re-acceptance on version change is out of scope.

After acceptance, home shows the feature mosaic dashboard.

## Promoting the first admin

Register a user locally or in prod, then in Studio or `psql`:

```sql
update public.profiles set role = 'admin'
 where user_id = (select id from auth.users where email = '<email>');
```

Documented also in `context/04-local-development.md`.

## Header

`components/layout/Header.tsx` (Server Component) reads auth state and profile, passes props to `HeaderClient` (client nav, floating navbar). Shows login/register links when anonymous; display name, avatar, nav links, and sign-out when logged in. Admin users see an Administración link.

## Out of scope (by design)

- OAuth / social login
- Email confirmation flow
- Self-service password recovery
- In-app role management UI
- Editable profile page (display name / initials changes not yet exposed)

## Where to look deeper

- Routes, actions, schemas, SQL: `documentation/services/web/auth-and-profiles.md`
- Security overview: `context/08-security.md`
- Supabase clients: `context/shared/supabase-clients.md`
- `profiles` / `terms_acceptances` schema: `documentation/services/database/tables.md`
- RLS policies: `documentation/services/database/rls.md`
- Avatar resolution: `context/web/avatars-profiles.md` (Phase 2)
- User-facing scoring copy (Spanish): `documentation/user_guides/puntuacion.md` (Phase 2)

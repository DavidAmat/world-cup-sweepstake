> Context: [`context/web/auth-and-profiles.md`](../../../context/web/auth-and-profiles.md)

# Auth and Profiles — implementation detail

Exhaustive reference for Supabase Auth, profiles, permissions, and terms acceptance.

## Routes

| Route | Auth | Guard | Purpose |
|-------|------|-------|---------|
| `/` | optional | — | Welcome (anon) or dashboard mosaic (auth + terms accepted) |
| `/login` | public | — | Email/password login form (Spanish) |
| `/register` | public | — | Disabled — redirects to `/login` |
| `/cambiar-password` | required | `requireAuth()` | Forced + voluntary password change; scam overlay for `is_scam` |
| `/perfil` | required | `requireAuth()` | Profile summary + self-service password change |
| `/admin/users` | admin | `proxy.ts` + `requireAdmin()` | Participants list (name/email/avatar) + login audit log |
| `/rules` | required | `requireAuth()` | Rules, scoring examples, terms acceptance |
| `/admin/*` | admin | `proxy.ts` + `requireAdmin()` on pages | Admin area |

Route groups: `(auth)` for login/register (no shared layout); `(app)` for player features (each page calls `requireAuth()` individually — no group layout guard).

## Request proxy (`src/proxy.ts`)

Next.js 16 request interceptor (replaces the old `middleware.ts` name). Runs on all non-static paths.

1. Skips session work if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing (e.g. preview without env).
2. Creates a Supabase server client with request/response cookie bridging.
3. Calls `getClaims()` to refresh the JWT.
4. **Forced-password gate** — when `claims.sub` exists, `request.method === "GET"`, and the path is not in `["/cambiar-password", "/login", "/register"]`: selects `profiles.must_change_password`; if `true` → `307` to `/cambiar-password`. Only GET is gated so server-action POSTs (sign-out, the change-password submit) are never intercepted. Placed before the admin gate so it wins.
5. For `pathname.startsWith("/admin")`:
   - No `claims.sub` → `307` to `/login`
   - `profiles.role !== 'admin'` → `307` to `/`

Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, and common image extensions.

## Server actions — auth (`src/lib/auth/actions.ts`)

All marked `"use server"`. Use `createClient()` from `lib/supabase/server`.

### `signUp()`

- **Disabled.** Self-registration is off — accounts are pre-created (see `scripts/wc2026/create-users.ts`). The action takes no fields and immediately redirects to `/login?error=El registro está deshabilitado…`. The `/register` page also redirects to `/login`.

### `signIn(formData)`

- Fields: `email`, `password`.
- Calls `supabase.auth.signInWithPassword`.
- Error → redirect `/login?error=…`
- **On success**: inserts `{ user_id }` into `login_events` via `createAdminClient()` (best-effort, wrapped in try/catch — logging never blocks login). Logs the **login event only**, not session refreshes or other actions; no locking.
- Success → redirect `/`

### `signOut()`

- Calls `supabase.auth.signOut()`, redirect `/`.

## Error translation (`src/lib/auth/errors.ts`)

`translateAuthError(message: string): string` — maps common Supabase Auth English messages to Spanish UI copy:

| Pattern | Spanish |
|---------|---------|
| invalid login credentials | Email o contraseña incorrectos. |
| user already registered | Ya existe una cuenta con ese email. |
| password should be at least | La contraseña debe tener al menos 8 caracteres. |
| unable to validate email / invalid | El email no parece válido. |
| email rate limit / too many requests | Demasiados intentos… |
| signups not allowed | El registro está deshabilitado… |

Unmatched messages pass through unchanged.

## Permission helpers

### `src/lib/permissions/requireAuth.ts`

```ts
import "server-only";
```

- `createClient()` → `supabase.auth.getClaims()`
- Missing/error claims → `redirect("/login")`
- Returns `{ userId: claims.sub, email, supabase }`

### `src/lib/permissions/requireAdmin.ts`

- Awaits `requireAuth()`
- Selects `display_name, initials, role` from `profiles` where `user_id = userId`
- `role !== 'admin'` → `redirect("/")`
- Returns `{ userId, supabase, profile }`

Used by all `admin/*` pages and actions as a second guard after the proxy.

## Pages

### `src/app/(auth)/login/page.tsx`

Server Component. Reads `searchParams.error`. Form `action={signIn}`. Fields: email, password. Link to `/register`.

### `src/app/(auth)/register/page.tsx`

Server Component. `redirect("/login")` — registration disabled.

### `src/app/page.tsx` (home)

- Anonymous: welcome + a single "Iniciar sesión" CTA (no "Crear cuenta").
- Authenticated: loads active tournament (`tournaments.status = 'active'`, latest by `created_at`). If tournament exists and no `terms_acceptances` row for `(tournament_id, user_id)` → `redirect("/rules")`.
- Terms accepted: feature mosaic dashboard (links to predictions, clasificacion, my-scores).

### `src/app/rules/page.tsx`

`requireAuth()`. Loads active tournament and checks existing acceptance. Renders:

- How-it-works steps (initial predictions, match predictions, locking)
- 3×3 scoring example cards (code-aligned values: 5/10/3-2-1/3, knockout extras, multipliers, 200/150/100/100, 25 per clasificado)
- Multiplier and initial-prediction tables
- Accept form (checkbox required) or "already accepted" state

### `src/app/rules/actions.ts`

#### `acceptTerms(formData)`

- Hidden field `tournamentId` (required).
- Inserts `{ tournament_id, user_id, rules_version: PLACEHOLDER_RULES_VERSION }` into `terms_acceptances`.
- `PLACEHOLDER_RULES_VERSION = 0` — intentional. The app is single-tournament (`wc_2026`) with one rules set; no new `scoring_rules` versions or re-acceptance flow is planned.
- Duplicate key / unique constraint → treated as success (idempotent).
- Other errors → redirect `/rules?error=…`
- Success → redirect `/rules?ok=1`

## Password change, profile, and scam mode

### `ChangePasswordForm` (`src/components/auth/ChangePasswordForm.tsx`)

Shared presentational form (`action={changePassword}`). Props: `origin` (error redirect target), `next` (success redirect target), `submitLabel`, `disabled`. Hidden fields `origin`/`next`; inputs `password` + `confirm` (min 8). Used by both `/cambiar-password` and `/perfil`.

### `changePassword(formData)` (`src/app/cambiar-password/actions.ts`)

- `requireAuth()`; reads own `profiles.is_scam`. **If scam → `redirect("/cambiar-password")` without changing anything** (defense in depth).
- Validates: `password.length >= 8`, `password === confirm`; on failure `redirect(${origin}?error=…)`.
- `supabase.auth.updateUser({ password })` (user session).
- Clears the flag with the **service-role** client: `createAdminClient().from("profiles").update({ must_change_password: false })` — required because the self-update RLS policy pins this column.
- Success → `redirect(next)` (`/` for the forced flow, `/perfil?ok=1` for the profile flow).

### `src/app/cambiar-password/page.tsx`

`requireAuth()`; selects `display_name, must_change_password, is_scam`. Copy differs when `must_change_password` (forced) vs voluntary. Renders `ChangePasswordForm origin="/cambiar-password" next="/" disabled={isScam}`. When `is_scam`, also renders `<ScamExperience />`.

### `src/app/cambiar-password/ScamExperience.tsx` (`"use client"`)

Pure client-side prank for `is_scam` accounts. No navigation, no writes. Deliberately paced so it is subtle at first:

- `fixed inset-0 z-[60]` invisible blocker over the form; form inputs also rendered `disabled`.
- Three small, mild `Notice` toasts (`MAX_TOASTS = 3`) at scattered fixed positions (system update, unstable connection, browser compatibility — soft amber/zinc, ambiguous copy). A `setInterval` of `REVEAL_INTERVAL_MS = 5000` increments `revealed`, so they appear **one every 5 s**. Closing one (`hidden[id]`) schedules reappearance after `REAPPEAR_MS = 6000`; all timers cleared on unmount.
- After `UPDATE_DELAY_MS = 30000` (`setTimeout`) `showUpdate` flips and a calm white "Actualización disponible" dialog appears with an "Actualizar ahora" (primary) button that sets `virus = true`.
- `virus` renders a full-screen `z-[90]` red "🚨 AMENAZA DETECTADA / posible virus / apaga el ordenador y contacta con el administrador" warning with no working dismissal.

### `src/app/perfil/page.tsx`

`requireAuth()`; selects `display_name, initials, role`; `avatarUrlFor(displayName)`. Shows `Avatar` + name + email + admin badge, then `ChangePasswordForm origin="/perfil" next="/perfil?ok=1"`. Success banner on `?ok=1`. Linked from the header user menu.

### `src/app/admin/users/page.tsx`

`requireAdmin()`. Uses `createAdminClient()` for everything:

- Participants table: `profiles` (`user_id, display_name, initials, role, is_scam`) joined with emails from `auth.admin.listUsers()` (keyed by id). Renders `Avatar` (via `avatarUrlFor`), display name (with a red shield for `is_scam`), email, role badge.
- Accesos recientes: `login_events` newest-first (limit 200) with embedded `profiles(display_name)`; timestamps via `formatMadridDateTimeFull` (Madrid, incl. year + seconds). Empty-state message when no logins yet.

### `login_events` (migration `20260529130000_login_events.sql`)

- `id uuid pk`, `user_id uuid` → `profiles(user_id)` ON DELETE CASCADE, `logged_at timestamptz default now()`.
- Index `login_events_logged_at_idx (logged_at desc)`.
- RLS: `login_events_admin_all` (read for admins). Inserts come from the service-role client in `signIn`, so no user insert policy exists.
- Stored as UTC `timestamptz`; displayed in Madrid (same convention as the rest of the app). Cleared automatically when a user is deleted (cascade) — `scripts/wc2026/clean-slate.ts` thus empties it via auth-user deletion.

## Header components

### `src/components/layout/Header.tsx`

Async Server Component:

1. `getClaims()` for session
2. If logged in: select `display_name, initials, role` from `profiles`
3. `avatarUrlFor(displayName)` from `lib/profiles/avatars`
4. Renders `HeaderClient` with props + a `<form action={signOut}>` passed as `signOutForm`

### `src/components/layout/HeaderClient.tsx`

Client Component: floating navbar, mobile menu, nav links (Inicio, Predicciones, Clasificación dropdown), admin shield link when `isAdmin`, `Avatar` display. See `context/web/ui-and-design.md` for layout styling.

## Database

### `profiles` (migration `20260508155423_tournaments_profiles_terms.sql`, extended by `20260529120000_password_change_and_scam.sql`)

- PK `user_id` → `auth.users(id)` ON DELETE CASCADE
- `display_name text`, `initials text`, `role text` CHECK (`admin` | `player`)
- `must_change_password boolean not null default false` — forces the `/cambiar-password` gate
- `is_scam boolean not null default false` — drives `ScamExperience`
- `set_updated_at` trigger
- **RLS self-update pin:** `profiles_update_own_no_role_change` `with check` requires `role`, `must_change_password`, and `is_scam` to equal their current values — users cannot self-clear any of them; only the service-role client / admins can.

### `terms_acceptances`

- FK `tournament_id`, `user_id`
- `rules_version integer` — intended to match `scoring_rules.version`
- UNIQUE `(tournament_id, user_id, rules_version)`
- RLS: users insert/read own rows; admin full access

### `handle_new_user` (migration `20260508170251_handle_new_user.sql`)

`SECURITY DEFINER` trigger on `auth.users` AFTER INSERT:

```sql
computed_display_name := coalesce(
  new.raw_user_meta_data->>'display_name',
  split_part(new.email, '@', 1)
);
insert into public.profiles (user_id, display_name, initials, role)
values (new.id, computed_display_name, upper(left(computed_display_name, 2)), 'player');
```

Required because authenticated users have no INSERT policy on `profiles`.

### Related functions

- `is_admin()` — used in RLS policies; see `documentation/services/database/functions.md`

## Supabase Auth config

`supabase/config.toml`:

- `enable_confirmations = false` (auth and email sections)
- Email/password provider only

## Environment variables

| Name | Used by |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `proxy.ts`, `lib/supabase/server.ts`, `client.ts` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same |

No auth-specific secrets beyond the publishable key. See `context/08-security.md`.

## Admin user management (manual)

**Promote to admin** (Studio → SQL or `psql`):

```sql
update public.profiles set role = 'admin'
 where user_id = (select id from auth.users where email = '<email>');
```

**Demote to player:** same with `role = 'player'`.

**Reset password:** Studio → Authentication → Users → select user → recovery link or manual password change.

## Verification commands

```bash
# Local stack + app
npm run db:reset
npm run dev

# Type/lint
npm run typecheck
npm run lint

# Protected routes redirect when anonymous
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin
# expect 307 → /login

# After signup, confirm profile row
# Studio :54323 → Table Editor → profiles
```

## Files index

| Path | Role |
|------|------|
| `src/proxy.ts` | Session refresh, forced-password gate, `/admin` gate |
| `src/lib/auth/actions.ts` | signUp (disabled), signIn, signOut |
| `src/app/cambiar-password/page.tsx` | Forced/voluntary password change UI |
| `src/app/cambiar-password/actions.ts` | changePassword action |
| `src/app/cambiar-password/ScamExperience.tsx` | Scam prank overlay (client) |
| `src/app/perfil/page.tsx` | Profile + password change |
| `src/components/auth/ChangePasswordForm.tsx` | Shared password form |
| `src/app/admin/users/page.tsx` | Admin participants + login log |
| `src/lib/dates/madridTime.ts` | `formatMadridDateTimeFull` for the log |
| `scripts/wc2026/clean-slate.ts` | Prod clean-slate (delete test data, keep J1–J3) |
| `scripts/wc2026/create-users.ts` | Create the 15 accounts + flags |
| `supabase/migrations/20260529120000_password_change_and_scam.sql` | must_change_password + is_scam + RLS pin |
| `supabase/migrations/20260529130000_login_events.sql` | login_events audit table |
| `src/lib/auth/errors.ts` | translateAuthError |
| `src/lib/permissions/requireAuth.ts` | Auth guard |
| `src/lib/permissions/requireAdmin.ts` | Admin guard |
| `src/lib/supabase/server.ts` | Cookie-based server client |
| `src/lib/supabase/client.ts` | Browser client (not used in auth flows) |
| `src/app/(auth)/login/page.tsx` | Login UI |
| `src/app/(auth)/register/page.tsx` | Register UI |
| `src/app/page.tsx` | Home + terms redirect |
| `src/app/rules/page.tsx` | Rules UI |
| `src/app/rules/actions.ts` | acceptTerms |
| `src/components/layout/Header.tsx` | Auth-aware header (server) |
| `src/components/layout/HeaderClient.tsx` | Nav chrome (client) |
| `supabase/migrations/20260508155423_tournaments_profiles_terms.sql` | profiles + terms_acceptances |
| `supabase/migrations/20260508170251_handle_new_user.sql` | Registration trigger |

## Resolved: rules_version in terms acceptance

The app runs **one tournament** (`wc_2026`) and **one fixed scoring rules set**. New tournaments or new `scoring_rules` versions are not planned. `acceptTerms` therefore keeps `rules_version = 0`; wiring it to `scoring_rules.version` or building re-acceptance on rule change is unnecessary for this product scope.

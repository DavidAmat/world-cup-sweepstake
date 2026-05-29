# Security

Auth model, RLS posture, and secrets layout. No secret values in this doc — names only.

## Authentication

- **Provider:** Supabase Auth, email/password only.
- **Session:** JWT in HTTP-only cookies; refreshed in `src/proxy.ts` via `getClaims()`.
- **Registration:** `signUp` server action → `auth.users` insert → `handle_new_user` trigger creates `profiles` row with `role = 'player'`.
- **No email confirmation** in local or prod (immediate access after signup).
- **No self-service password reset** — admin resets via Supabase Studio (Authentication → Users).
- **No OAuth** providers configured.

## Authorization layers

1. **`src/proxy.ts`** — blocks unauthenticated users from `/admin/*`; redirects non-admins to `/`.
2. **Server Actions / pages** — `requireAuth()` and `requireAdmin()` from `lib/permissions/`.
3. **Postgres RLS** — every table; policies use `(select auth.uid())` and helper functions.

Defense in depth: even if a server action guard is missed, RLS prevents unauthorized writes.

## Admin model

- `profiles.role` ∈ `admin | player`.
- `is_admin()` is `SECURITY DEFINER`, reads `profiles` for current `auth.uid()`.
- Users cannot change their own `role` (RLS `with check` preserves existing role on self-update).
- First admin promoted manually in Studio/SQL.

## Service role (secret key)

`SUPABASE_SECRET_KEY` powers `lib/supabase/admin.ts`:
- Scoring recalculation
- Seed upload scripts
- Tournament reset
- Syncing `app_settings.fecha_actual` from env

Never import `admin.ts` in client components. File is guarded with `import "server-only"`.

## Row Level Security highlights

| Data | Visibility rule |
|------|-----------------|
| Match predictions | Own always; others' visible when `is_fixture_locked()` |
| Initial / group qualification | Own always; others' visible when `are_initial_predictions_locked()` |
| Profiles | All authenticated can read (leaderboard names) |
| Results, fixtures, scores | All authenticated can read; only admin can write |
| Terms acceptances | Own rows; admin sees all |

## Environment variables (names only)

| Variable | Exposure |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (browser); RLS enforced |
| `SUPABASE_SECRET_KEY` | **Server only** — bypasses RLS |
| `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` | Public |
| `FECHA_ACTUAL` | Local dev; optional time simulation |

All values live in `.env.local` (gitignored) and Vercel env settings. `.env.example` documents names with empty values.

## Network

- Supabase hosted project: EU region, free tier.
- No custom WAF or IP allowlisting configured.
- Local Supabase: Docker on localhost (macOS may need LAN IP workaround).

## Audit trail

- `terms_acceptances` — immutable for non-admins (no user update/delete policies).
- `scoring_rules` — versioned; inactive rows retained.
- `prediction_scores.scoring_rules_version` — records which rule set produced each score.

## Where to look deeper

- RLS policies per table: `documentation/services/database/rls.md`
- Auth flows: `context/web/auth-and-profiles.md` (Phase 2)
- Supabase clients: `context/shared/supabase-clients.md`

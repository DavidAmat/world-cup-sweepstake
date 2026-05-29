# 2026-05-29 — Production clean-slate, forced password change & scam prank

Vibe-coded feature for the go-live to production.

## Goal (user request)

Take the (test-filled) database to a clean production state — keep only the Jornada 1/2/3 group
fixtures (no results) and master data — seed the 15 real accounts from
`data/users/users_passwords.json` with temporary passwords, force a password change on first login,
add a `/perfil` section to change it later, and give the `"scam": true` account
(`lluis@porra.com`) a fake-malware prank page that blocks it from doing anything.

## Decisions

- Admin = `david@porra.com`; others players.
- Keep group J1–J3 only; delete the 32 knockout placeholders; clear all results.
- Public self-registration disabled.
- Schema via migration + `db:push`; data clean-slate + user creation via scripts run with
  `--confirm-prod` (user runs prod; verified locally).

## What shipped

- **Migration** `supabase/migrations/20260529120000_password_change_and_scam.sql` —
  `profiles.must_change_password` + `profiles.is_scam`; self-update RLS policy pins both (+ `role`).
- **Scripts** `scripts/wc2026/clean-slate.ts` (`wc2026:clean[:prod]`) and
  `scripts/wc2026/create-users.ts` (`wc2026:users[:prod]`).
- **Forced gate** in `src/proxy.ts` (GET-only) → `/cambiar-password` while `must_change_password`.
- **Routes** `src/app/cambiar-password/` (page + `actions.ts` `changePassword` + `ScamExperience.tsx`)
  and `src/app/perfil/`; shared `src/components/auth/ChangePasswordForm.tsx`.
- **Registration disabled**: `signUp` hard-stops, `/register` redirects to `/login`, "Crear cuenta"
  links removed (home + header).
- **Scam**: `ScamExperience` (client) — reappearing red Spanish danger toasts (Windows 18, weak
  Wi-Fi, unsupported browser, expired license), blocking overlay + disabled form, "ACTUALIZAR AHORA"
  → full-screen virus warning. `changePassword` also refuses scam accounts server-side.

### Follow-up (same day)

- **Login audit log**: migration `20260529130000_login_events.sql` (`login_events`, admin-read).
  `signIn` inserts a row per successful login via the service-role client (logins only, no locking).
- **Admin `/admin/users`**: participants (avatar + name + email + role) and "Accesos recientes"
  (name + Madrid timestamp via new `formatMadridDateTimeFull`). Card added to `/admin`.
- Avatars: all usernames have a matching `public/images/users/<Name>.png` **except `Mayol.png`**
  (falls back to initials until added).

## Local verification (passed)

`db:reset` → `types:gen` → `wc2026:upload` → `wc2026:clean` (32 knockout fixtures deleted, 72 kept,
0 results) → `wc2026:users` (15 accounts; David admin; all `must_change_password=t`; Lluis
`is_scam=t`). `typecheck`, `lint`, `build` clean. Unauth redirects confirmed via curl:
`/register`, `/perfil`, `/cambiar-password`, `/admin` → 307 `/login`. Authenticated forced-change +
scam visuals to be confirmed in-browser (visual prank).

## Detail / runbook

- Overview: `context/web/auth-and-profiles.md`
- Detail: `documentation/services/web/auth-and-profiles.md`
- Prod runbook: `documentation/implementations/wc2026-clean-slate-and-users.md`

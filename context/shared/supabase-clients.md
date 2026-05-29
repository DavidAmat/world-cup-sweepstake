# Supabase Clients

Three typed Supabase clients for different runtimes and trust boundaries. All use `Database` from `src/lib/supabase/database.types.ts` (regenerate with `npm run types:gen` after migrations).

## The three clients

| Module | Factory | Key | RLS | Where to use |
|--------|---------|-----|-----|--------------|
| `client.ts` | `createBrowserClient` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Enforced | Client components in the browser |
| `server.ts` | `createServerClient` | publishable + session cookies | Enforced | Server Components, Server Actions, route handlers |
| `admin.ts` | `createClient` (`@supabase/supabase-js`) | `SUPABASE_SECRET_KEY` | Bypassed | Server-only: scoring recalc, reset, `app_settings` sync, seed scripts |

**Rule:** never import `admin.ts` in client code. The file starts with `import "server-only"`.

## Browser client (`client.ts`)

```ts
createBrowserClient<Database>(url, publishableKey)
```

Used for interactive client components that need Supabase (e.g. auth forms). Subject to RLS as the logged-in user.

## Server client (`server.ts`)

```ts
await createClient()  // async — awaits cookies()
```

Wraps `@supabase/ssr` `createServerClient` with Next.js `cookies()`:

- **Reads** session cookies on every server request
- **Sets** cookies in Server Actions / route handlers; silently no-ops in Server Components (session refresh happens in `proxy.ts` instead)

This is the default for pages and mutations that should respect RLS.

## Admin client (`admin.ts`)

```ts
createAdminClient()
```

Service-role client with `autoRefreshToken: false`, `persistSession: false`. Use when RLS would block legitimate server work:

- `recalculateTournamentScores` and related scoring paths
- Tournament reset (`/admin/reset`)
- `syncAppNowFromEnv` → writes `app_settings.fecha_actual`
- Initial-predictions lock actions (admin client updates `tournaments.initial_predictions_locked_at`)

**Scripts:** `scripts/lib/supabase.ts` defines a separate `createScriptAdminClient()` with the same env vars but without `"server-only"`, so `tsx` seed/scoring scripts do not pull in the Next.js server bundle.

## Session refresh (`src/proxy.ts`)

Next.js 16 request proxy (not `middleware.ts`) runs on almost every request:

1. Builds a ephemeral `createServerClient` from request/response cookies
2. Calls `auth.getClaims()` to refresh the JWT
3. Gates `/admin/*`: unauthenticated → `/login`; non-admin → `/`

If Supabase env vars are missing (e.g. early Vercel preview), the proxy skips auth and passes through — pages still render.

Server Components cannot rely on setting cookies; the proxy keeps sessions alive between navigations.

## Environment variables (names only)

| Variable | Client(s) |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | all |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser, server, proxy |
| `SUPABASE_SECRET_KEY` | admin, scripts |

Legacy `anon` / `service_role` keys still work on Supabase until end of 2026; this project uses publishable/secret by default.

## macOS local quirk

`.env.local` often has `127.0.0.1` for Next.js, but Supabase CLI Docker may only listen on a LAN IP. **Next** resolves `127.0.0.1`; **tsx scripts** auto-rewrite to LAN in `scripts/lib/env.ts`. See `context/04-local-development.md`.

## Type generation

`npm run types:gen` runs:

```bash
supabase gen types typescript --local 2>/dev/null | grep -v '^Connecting to db' > src/lib/supabase/database.types.ts
```

The `grep` strips a CLI status line that would break `tsc`. Regenerate after every migration that changes schema.

## Where to look deeper

- Auth + proxy gate: `context/web/auth-and-profiles.md`
- Security posture: `context/08-security.md`
- RLS policies: `documentation/services/database/rls.md`
- Local DB commands: `context/04-local-development.md`
- Script admin client: `documentation/services/data-tooling/seed-scripts.md`

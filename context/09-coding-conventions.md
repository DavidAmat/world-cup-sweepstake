# Coding Conventions

Observed and enforced patterns in this repo. Grounded in ESLint, Prettier, and existing code — not aspirational rules.

## Language split

- **UI copy:** Spanish (labels, errors shown to users, page titles).
- **Code:** English (variables, functions, table/column names, file names).
- **Domain nouns:** keep verbatim in docs and UI where they are product terms (`pichichi`, `mejor jugador`, `prórroga`, `jornada`, `clasificados`).

Date display uses `Europe/Madrid` in the UI (`lib/dates/madridTime.ts`). Database stores `timestamptz`.

## Next.js patterns

- **App Router** with route groups: `(app)`, `(auth)`, `admin/`.
- **Server Components** by default; `"use client"` only when needed (forms, charts, interactive UI).
- **Server Actions** in `actions.ts` per route for mutations — not Route Handlers for forms.
- **Request proxy:** `src/proxy.ts` exports `proxy()` — do not create `middleware.ts`.
- Read `node_modules/next/dist/docs/` before using Next APIs (breaking changes vs older training data).

## Validation and forms

- **Zod** schemas in `schemas.ts` per feature.
- **react-hook-form** + `@hookform/resolvers/zod` in client forms.
- Validate again in server actions before DB writes.

## Supabase access

Three clients — see `context/shared/supabase-clients.md`:
- Browser / server: publishable key, RLS applies.
- Admin: secret key, server-only, explicit bypass.

Prefer server client in Server Components and actions. Use admin client only for operations RLS cannot allow (recalc, seed, reset).

## Auth guards

- `requireAuth()` — redirects to `/login` if no session.
- `requireAdmin()` — redirects non-admins.
- `/admin/*` also gated in `proxy.ts` (307 redirect, avoids streaming redirect bugs).

Use `getClaims()` (not `getSession()`) for server-side auth checks per Supabase guidance.

## File organization

```
app/<route>/
  page.tsx
  actions.ts      # if mutations
  schemas.ts      # if forms
  *Client.tsx     # client components when split
lib/<domain>/     # reusable logic
components/<area>/ # shared UI
```

## Styling

- **Tailwind v4** via `@tailwindcss/postcss`.
- **Light mode only** — dark mode removed (hito 15).
- **Plus Jakarta Sans** font, custom palette — canonical reference: `context/web/ui-and-design.md`. Do not restate palette values here.

## Linting and formatting

ESLint 9 flat config (`eslint.config.mjs`):
- Extends `eslint-config-next/core-web-vitals`, `typescript`, `prettier`.
- Ignores: `.next/`, `data/`, `context/`, `supabase/`, `scripts/`, `database.types.ts`, `.venv/`.

Prettier (`.prettierrc.json`): semi, double quotes, trailing commas, printWidth 100, Tailwind class sorting plugin.

```bash
npm run lint
npm run format:check
npm run typecheck
```

## Testing

No Jest/Vitest/Playwright. Verification:
- `npm run scoring:smoke`
- Manual SQL / Studio checks
- `npm run db:reset` after migration changes

## SQL migrations

- One concern per migration file, timestamp prefix.
- Always enable RLS on new tables before exposing via API.
- Wrap `auth.uid()` as `(select auth.uid())` in policies.
- Use `SECURITY DEFINER` + locked `search_path` for helper functions that policies call.

## Where to look deeper

- UI design rules: `context/web/ui-and-design.md`
- Database conventions: `documentation/services/database/migrations.md`
- App layout: `context/03-app-architecture.md`

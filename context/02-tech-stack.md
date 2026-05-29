# Tech Stack

Locked versions from `package.json`, `pyproject.toml`, and `supabase/config.toml`. Re-verify lockfiles before citing.

## Runtime (Next.js app)

| Package | Version | Role |
|---------|---------|------|
| next | 16.2.6 | App Router, Turbopack dev, Vercel deploy |
| react / react-dom | 19.2.4 | UI |
| typescript | ^5 | Type checking (`npm run typecheck`) |
| tailwindcss | ^4 | Styling (`@tailwindcss/postcss`) |
| @supabase/ssr | ^0.10.3 | Cookie-aware Supabase client (browser + server) |
| @supabase/supabase-js | ^2.105.3 | Admin client (service role) |
| react-hook-form | ^7.75.0 | Form state |
| zod | ^4.4.3 | Validation (forms + server actions) |
| @hookform/resolvers | ^5.2.2 | Zod ↔ RHF bridge |
| date-fns | ^4.1.0 | Date formatting |
| lucide-react | ^1.14.0 | Icons |
| country-flag-icons | ^1.6.17 | Flag components |

## Tooling

| Tool | Version / config | Role |
|------|------------------|------|
| eslint | ^9 | Lint (`npm run lint`); `eslint-config-next` 16.2.6 + `eslint-config-prettier` |
| prettier | ^3.8.3 | Format (`npm run format`); `prettier-plugin-tailwindcss` |
| tsx | ^4.21.0 | Run TypeScript scripts (seed upload, scoring smoke) |
| Node.js | 20.9+ | Required by Next 16 |
| npm | (default) | Package manager |

Prettier config (`.prettierrc.json`): semi, double quotes, trailing commas, printWidth 100, tabWidth 2, Tailwind plugin.

## Database and auth (Supabase)

| Component | Detail |
|-----------|--------|
| Postgres | major_version **17** (`supabase/config.toml`) |
| Auth | Email/password via Supabase Auth |
| RLS | Enabled on all public tables |
| CLI | Supabase CLI for local Docker + migrations |
| Extensions | `pgcrypto`, `citext` (migration `20260507222918`) |

Local ports (defaults): API `:54321`, DB `:54322`, Studio `:54323`.

Env var names (values never committed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (replaces legacy `anon` key)
- `SUPABASE_SECRET_KEY` (replaces legacy `service_role` key)
- `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`

## Hosting

| Service | Plan / usage |
|---------|--------------|
| Vercel | Hobby; auto-deploy from GitHub `master` |
| Supabase | Free tier; single hosted project for prod (and preview deployments) |

## Data tooling (parallel, not Next.js runtime)

| Component | Detail |
|-----------|--------|
| Python | >=3.12,<3.13 via **uv** (`pyproject.toml`) |
| pandas | >=2.2.0 — CSV → JSON conversion |
| jupyterlab | Optional notebooks under `data/raw/` |
| Entry script | (none committed) — helpers in `data/raw/utils.py`; fixtures generated via `scripts/wc2026/gen-fixtures.ts` |

Output JSON feeds `data/seeds/wc_2026/` and is uploaded via `scripts/wc2026/upload.ts`.

## Verification (no test framework)

- `npm run typecheck` — TypeScript
- `npm run lint` / `npm run format:check` — code style
- `npm run scoring:smoke` — scoring engine smoke recalculation
- `npm run db:reset` + manual SQL — schema/integration checks

## Where to look deeper

- Local setup: `context/04-local-development.md`
- Deploy flow: `context/05-deployment.md`
- Supabase clients: `context/shared/supabase-clients.md`
- Python pipeline: `documentation/services/data-tooling/python-pipeline.md` (Phase 2)

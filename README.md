# Porra Mundial 2026

App privada para gestionar la porra del Mundial 2026 entre amigos.

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
  (Auth + Postgres + RLS) · Vercel.
- **Idioma de la UI**: español. El código y la base de datos están en
  inglés.

## Documentación

Empieza por la orientación del proyecto y el índice completo:

- [`context/00-project-complete-overview.md`](context/00-project-complete-overview.md) — visión global (ideal para onboarding de un LLM)
- [`context/00-index.md`](context/00-index.md) — índice de todos los ficheros en `context/` y `documentation/`
- [`context/00-documentation-instructions.md`](context/00-documentation-instructions.md) — dónde va cada tipo de doc
- [`documentation/`](documentation/) — detalle de ingeniería (rutas, SQL, comandos, runbooks)

## Desarrollo local

Requisitos: Node 20.9+, Docker (para Supabase local).

```bash
npm install
cp .env.example .env.local        # rellenar tras npm run db:start
npm run db:start
npm run db:reset
npm run types:gen
npm run wc2026:upload             # cargar torneo wc_2026
npm run dev                        # http://localhost:3000
```

## Scripts útiles

```bash
npm run dev           # arrancar Next en local
npm run build         # build de producción
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier sobre todo el repo
npm run format:check  # Prettier en modo check (CI)
npm run wc2026:upload # subir seeds del Mundial 2026 a Supabase
npm run scoring:smoke # smoke del motor de puntuación
```

## Estructura del repo

```
src/
  app/                    rutas Next.js (App Router)
  components/             UI compartida
  lib/                    clients Supabase, scoring, permisos, fechas, copy
data/seeds/wc_2026/       JSONs de seed del torneo activo
supabase/                 migraciones y config Supabase CLI
scripts/                  upload wc2026, scoring smoke, lib compartida
context/                  documentación orientada a LLM (overviews)
documentation/            documentación detallada para ingeniería
```

## Deploy

- Cada PR a `master` genera un Preview Deployment en Vercel.
- Mergear a `master` despliega a producción.
- Las migraciones a Supabase de producción se aplican manualmente con
  `npm run db:push` desde local.

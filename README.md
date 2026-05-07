# Porra Mundial 2026

App privada para gestionar la porra del Mundial 2026 entre amigos.

- **Stack**: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase
  (Auth + Postgres + RLS) · Vercel.
- **Idioma de la UI**: español. El código y la base de datos están en
  inglés.
- **Plan de implementación**: ver [`context/plan/01-plan.md`](context/plan/01-plan.md).

## Desarrollo local

Requisitos: Node 20.9+, Docker (para Supabase local desde el hito 03).

```bash
npm install
cp .env.example .env.local        # rellenar tras crear el proyecto Supabase
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
```

## Estructura del repo

```
src/
  app/                    rutas Next.js (App Router)
  components/             UI compartida
  lib/                    clients Supabase, scoring, permisos, fechas, copy
data/seeds/               JSONs de seed (Catar 2022 / Mundial 2026)
supabase/                 migraciones y config Supabase CLI (hito 03)
scripts/                  scripts de seed e importación
context/
  initial-setup/          brainstorming + PID iniciales
  plan/                   plan de implementación por hitos (01..17)
  implementations/        bitácora por hito (qué se hizo, errores, decisiones)
```

## Deploy

- Cada PR a `master` genera un Preview Deployment en Vercel.
- Mergear a `master` despliega a producción.
- Las migraciones a Supabase de producción se aplican manualmente con
  `supabase db push` desde local (ver hito 16).

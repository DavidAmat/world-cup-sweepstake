# 09 — Predicciones de partidos · bitácora de implementación

> Hito **EN CURSO**. Plan: `context/plan/09-match-predictions.md`
> (aprobado por el usuario: "Adelante"). Bootstrap:
> `context/plan/08-bootstrap-prompt.md`.

## Estado

- [x] Paso 1 · Micro-migración `is_fixture_locked → app_now()` (local).
- [x] Paso 1b · Migración a prod (db push) + commit.
- [ ] Paso 2 · Helper `src/lib/predictions/matchLock.ts`.
- [ ] Paso 3 · `schemas.ts` + `actions.ts` (save + generateRandom).
- [ ] Paso 4 · Página `/predictions/matches`.
- [ ] Paso 5 · Página `/predictions/matches/public`.
- [ ] Paso 6 · Navegación (Header + dashboard).
- [ ] Paso 7 · typecheck/lint/format/build verdes.
- [ ] Paso 8 · Smoke local David1/2/3 + push master.
- [ ] Paso 9 · Cierre de bitácora.

## Decisiones aprobadas

- D09-1..D09-9 del plan aprobadas por el usuario.
- **D09-8 / D09-9 ajustadas por el usuario** (respuesta a la consulta):
  - Generador aleatorio = **solo admin** (`requireAdmin`).
  - Algoritmo: dado de categoría 90' (40 % local / 30 % empate /
    30 % visitante) → sample del grupo de marcadores. Grupos pueden
    acabar en empate (final). Eliminatorias: empate a 90' ⇒ **siempre
    prórroga**; `PENALTY_PROB=0.70`; ganador por dado 50/50 "da igual
    el resultado de la prórroga"; 120' coherente.
  - Invariante D09-9 reforzado en Zod: eliminatoria + empate a 90' ⇒
    prórroga obligatoria (en ambos sentidos).

---

## Paso 1 · Micro-migración (en curso)

Fichero: `supabase/migrations/20260517120000_is_fixture_locked_app_now.sql`.
`create or replace` de `public.is_fixture_locked`: único cambio
`now()` → `public.app_now()`. Misma firma, mismo `stable`. La RLS de
`match_predictions` ya llama a esta función por nombre → el override
`FECHA_ACTUAL` pasa a simular también el lock de partido.

Aplicada local con `npx supabase migration up --local` (no
`db:reset`). Verificado en psql: fixture `2026-06-11 20:00Z` →
`locked=false` con hora real (2026-05-16); con `app_settings.
fecha_actual=2026-06-11 00:00Z` → `locked=true`; restaurado a null →
`locked=false`. `pg_get_functiondef` confirma el cuerpo con
`app_now()`. `app_settings` restaurado a null.

`npm run types:gen` + `prettier`: `database.types.ts` **sin
cambios** (firma idéntica, como predijo el plan). `git status`
limpio salvo los 3 ficheros nuevos del hito.

Prod: usuario confirmó. `echo y | npx supabase db push --linked`
aplicó `20260517120000`. `migration list --linked` confirma
Local==Remote (…20260517120000 en ambos). Sin pérdida de datos
(`create or replace` de función). Commit del paso 1: ver abajo.

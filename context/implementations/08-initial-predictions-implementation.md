# 08 — Predicciones iniciales · bitácora de implementación

> Hito en curso. Plan: `context/plan/08-initial-predictions.md`.

## Estado

- [x] Paso 1 · Migración SQL (D2 free-text + lock + RLS) — local.
- [x] Paso 1b · Migración a prod (db:push) — aplicada.
- [x] Paso 2 · Helper `src/lib/predictions/initialLock.ts`.
- [x] Paso 3 · `schemas.ts` + `actions.ts`.
- [x] Paso 4 · Página `/predictions/initial` (form + lectura).
- [x] Paso 5 · Página `/predictions/initial/public`.
- [x] Paso 6 · Navegación (Header + dashboard).
- [x] Paso 7 · typecheck/lint/format/build verdes.
- [~] Paso 8 · Verificación automática hecha; smoke browser pendiente.
- [ ] Paso 9 · Cierre de bitácora.

## Decisiones aprobadas

- D08-1..D08-8 del plan aprobadas por el usuario.
- **Cambio del usuario sobre D08-2**: el lock global = kickoff del
  **primer partido del torneo** (`min(fixtures.kickoff_at)`), SIN
  restar 24h. Las predicciones iniciales se pueden editar mientras no
  haya empezado ningún partido. (El margen de 24h es para
  predicciones de partido, hito 09.) Plan actualizado en §0/§1/§2/§3.

---

## Paso 1 · Migración SQL

Fichero: `supabase/migrations/20260515120000_initial_predictions_freetext_and_lock.sql`.

Aplicada en local con `npx supabase migration up --local` (no
`db:reset`: así se preservan teams/fixtures/usuarios locales; la
migración es aditiva salvo el `drop column` de D2 sobre tabla vacía).

Verificado vía psql:

- `initial_predictions`: `top_scorer_player_id`/`best_player_id`
  eliminadas; `top_scorer_text`/`best_player_text` añadidas con check
  de longitud 1..80. Sin FK a `players`.
- Funciones `initial_predictions_lock_at` /
  `are_initial_predictions_locked` creadas.
- `initial_predictions_lock_at(wc_2022_test)` = `2026-06-11 20:00Z`
  (= `min(kickoff_at)`, primer partido, sin -24h). `locked = false`
  (hoy 2026-05-15 → abierto). Coincide con la decisión del usuario.
- 10 policies recreadas (5 por tabla: admin_all + insert/update/
  delete `_own_unlocked` + select `_own_or_locked_or_admin`).

`npm run types:gen` (local) regenerado: `database.types.ts` ya no
tiene FK a players en initial_predictions; expone `top_scorer_text`/
`best_player_text` y las dos funciones rpc tipadas.

Pendiente: `db:push` a prod (requiere confirmación del usuario) tras
validar la app en local.

## Pasos 2-7 · App

- `src/lib/predictions/initialLock.ts`: `getInitialLockState(tid)` ·
  dos `rpc` (`initial_predictions_lock_at`,
  `are_initial_predictions_locked`). El lock lo decide Postgres
  (`now()` de la DB) → no se usa `Date.now()` en server components,
  esquiva `react-hooks/purity` sin `connection()`.
- `src/app/(app)/predictions/initial/schemas.ts`: `GROUP_CODES` A–H,
  Zod `InitialPredictionPayloadSchema` + `readInitialPayload`
  (coerción FormData, "" → null, patrón de `admin/fixtures/schemas`).
- `.../initial/actions.ts`: `saveInitialPredictions`. requireAuth +
  getDefaultTournament + re-check lock (defensa además de RLS) +
  validación cruzada (campeón≠subcampeón; por grupo ambos o ninguno,
  1.º≠2.º, pertenencia a grupo/torneo) + upsert `initial_predictions`
  (conserva `submitted_at`) + delete-then-insert de `gqp` (D08-7).
- `.../initial/page.tsx`: server component. Si `locked` → vista solo
  lectura (sin `<form>`, sin redirect — gotcha streaming Next 16);
  si abierto → form (selects campeón/subcampeón, texto pichichi/mejor
  jugador, 8 grupos × 1.º/2.º). Badge Abierto/Bloqueado + fecha lock
  en Madrid.
- `.../initial/public/page.tsx`: si no `locked` → aviso (no redirect);
  si `locked` → card por usuario (todos los `profiles`) + dropdown de
  categoría vía `?cat=` (form GET, sin JS).
- Nav: link "Predicciones" en `Header.tsx` (logueados) + dos tarjetas
  en `dashboard/page.tsx`.
- `database.types.ts` regenerado (local) y formateado con Prettier
  (el fichero autogenerado no sale prettier-clean; se formatea, igual
  que en hitos previos) → `format:check` verde.

`typecheck`/`lint`/`format:check`/`build` verdes. Build lista las
rutas `/predictions/initial` y `/predictions/initial/public`.

## Paso 8 · Verificación automática (DB/RLS, login real)

Anon → `/predictions/initial[/public]` responde `307 /login`.

Script throwaway (no commiteado) con `@supabase/supabase-js` y login
real David1/David2 contra Supabase local:

- `lock_at` = `2026-06-11T20:00Z` (= `min(kickoff_at)`, primer
  partido, **sin** -24h). `locked=false` hoy.
- David2 (player) upsert `initial_predictions` + insert `gqp` → OK.
- David2 player **UNLOCKED** ve solo su fila (1) — sin fuga de ajenas.
- Tras lock (`predictions_open_until = now()-1m`):
  `are_initial_predictions_locked=true`; update de David2 → 204 pero
  **0 filas** (RLS `USING` excluye la fila; `top_scorer_text` sigue
  "Messi") → write bloqueado correctamente.
  David2 player **LOCKED** ve 2 filas (públicas), gqp idem.
- DB restaurada (`predictions_open_until=null`, predicciones de
  prueba borradas) → lista para el smoke en navegador.

Pendiente: smoke en navegador por el usuario (David1/David2).

## Paso 9 · Producción

Usuario confirmó. `npx supabase db push --linked` aplicó
`20260515120000` a prod (initial_predictions/gqp vacías en prod, 0
filas, sin pérdida). `migration list --linked` confirma Local==Remote
en `20260515120000`. Tipos no se regeneran: schema local==prod, el
`database.types.ts` commiteado ya es correcto.

Commit `16f6f3a` push a master (`f3ca8c5..16f6f3a`) → Vercel
autodespliega. Orden seguro respetado: migración a prod ANTES del
deploy del código que la usa.

Pendiente para cerrar el hito: smoke en navegador (David1/David2) en
local y/o prod (`https://world-cup-sweepstake-mu.vercel.app`).

# 09 — Predicciones de partidos · bitácora de implementación

> Hito **EN CURSO**. Plan: `context/plan/09-match-predictions.md`
> (aprobado por el usuario: "Adelante"). Bootstrap:
> `context/plan/08-bootstrap-prompt.md`.

## Estado

- [x] Paso 1 · Micro-migración `is_fixture_locked → app_now()` (local).
- [x] Paso 1b · Migración a prod (db push) + commit.
- [x] Paso 2 · Helper `src/lib/predictions/matchLock.ts`.
- [x] Paso 3 · `schemas.ts` + `actions.ts` (save + generateRandom).
- [x] Paso 4 · Página `/predictions/matches`.
- [x] Paso 5 · Página `/predictions/matches/public`.
- [x] Paso 6 · Navegación (Header + dashboard).
- [x] Paso 7 · typecheck/lint/format/build verdes.
- [ ] Paso 8 · Smoke navegador David1/2/3 (usuario) + push master.
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
(`create or replace` de función). Commit `d7a6ca2` (migración +
plan + bitácora) push a master.

## Pasos 2-7 · App

- `src/lib/predictions/matchLock.ts`: `getMatchLockState()` =
  `syncAppNowFromEnv()` + **un** `rpc("app_now")`; `isFixtureLocked
  (kickoffIso, appNowIso)` reproduce en JS la fórmula de
  `public.is_fixture_locked` (appNow ≥ kickoff−24h). Un round-trip,
  no N; "now" de Postgres → sin `Date.now()` en server component.
- `schemas.ts`: `FixturePredictionSchema` (Zod) con `superRefine`
  que espeja los 2 CHECK de `match_predictions` + invariante D09-9
  (grupos no empatan→no, eliminatoria empate90'⇒prórroga obligatoria;
  120'≥90'; penaltis⇒empate a 120'; sin penaltis⇒gana el del 120';
  el que pasa ∈ {home,away} y coincide con el ganador). `home/away_
  team_id` e `is_knockout` los inyecta el server (no son input del
  usuario). `readFixturePayload` lee campos `*_<fid>`; si 90' vacío
  ⇒ `skip` (guardado parcial OK).
- `actions.ts`: `saveRoundMatchPredictions` (requireAuth, recarga
  fixtures de la ronda por `round_id`, salta sin-equipos y
  bloqueados, valida por fixture, `upsert` masivo `onConflict
  fixture_id,user_id`, `submitted_at` omitido → default en insert,
  preservado en update). `generateRandomMatchPredictions`
  (**requireAdmin**): dado 0.4/0.7 → bucket HOME/DRAW/AWAY; grupos
  terminan ahí; eliminatoria empate90'⇒prórroga, `PENALTY_PROB=0.7`,
  ganador 50/50, 120' coherente (empate si penaltis, +1 del ganador
  si se decide en prórroga). Construye filas que respetan los CHECK
  por construcción.
- `/predictions/matches/page.tsx`: selector de ronda (`?round=`,
  form GET), default = primera ronda con fixture abierto. Por
  fixture: sin-equipos deshabilitado / bloqueado solo-lectura (sin
  redirect) / abierto con form. Eliminatoria muestra siempre
  prórroga/120'/penaltis/equipo que pasa. Botón "🎲 Generar
  predicciones aleatorias" solo si `profiles.role==='admin'`. Banner
  "🧪 Fecha simulada" + banners ok/error.
- `/predictions/matches/public/page.tsx`: mismo selector; por
  fixture, si no bloqueado "se hará pública al bloquear" (no se
  filtran ajenas: RLS), si bloqueado una card por usuario
  (`profiles`) con 90'/120'/penaltis/equipo que pasa.
- Nav: `Header.tsx` +link "Partidos"; `dashboard` +2 tarjetas.

`database.types.ts` sin cambios (no hubo migración nueva de tabla).
`typecheck`/`lint`/`format:check`/`build` verdes (build lista
`/predictions/matches` y `/predictions/matches/public`). Rutas
gateadas: anónimo → `307 /login` en ambas (proxy).

Pendiente: smoke en navegador por el usuario (David1 admin /
David2 / David3 players), incl. `make fecha` para mover el lock.

## Cambio del usuario · NO se predice el resultado a 120'

Decisión del usuario (revisión sobre el plan): la predicción de un
partido solo captura el resultado a 90', si hay prórroga, si hay
penaltis y qué equipo pasa. El **resultado a 120' NO se anota**.

- Migración `20260517130000_match_predictions_drop_120.sql`:
  `drop constraint match_predictions_check` (el que ataba
  `predicts_extra_time` a la presencia de `home/away_goals_120`).
  Se mantiene `match_predictions_check1` (penaltis⇒prórroga). Las
  columnas `home/away_goals_120` se conservan (nullable, sin uso por
  predicciones) para no hacer un drop destructivo sobre las 56 filas
  existentes (3 con 120 del smoke previo, intactas). La app siempre
  escribe esas columnas como NULL a partir de ahora.
- `schemas.ts`: fuera `home/away_goals_120` del Zod y de
  `readFixturePayload`; fuera los refines de 120'. Quedan: penaltis
  ⇒prórroga; prórroga⇒empate 90'; eliminatoria empate90'⇒prórroga;
  el que pasa ∈{home,away} y, si NO hay prórroga, = ganador del 90'.
  Con prórroga el ganador es libre (no se rastrea el 120').
- `actions.ts`: el `upsert` fija `home/away_goals_120 = null`
  siempre; el generador aleatorio, en eliminatoria con empate a 90',
  solo marca prórroga + (penaltis 70 %) + ganador 50/50, sin 120'.
- `page.tsx`/`public/page.tsx`: eliminados inputs y render del
  120'; el modo lectura/público muestra "prórroga[ · penaltis]".
  Selects de 120' fuera de los `.select()`.
- Aplicada local (`migration up`) y **prod** (usuario confirmó;
  `db push --linked`, `migration list --linked` → Local==Remote
  hasta `20260517130000`). `types:gen` → `database.types.ts` sin
  cambios (solo se quitó un CHECK, no columnas).
  typecheck/lint/format/build verdes.

## Cambio del usuario · single-page con todas las jornadas + estado guardado

Rediseño de `/predictions/matches` (petición del usuario):

1. **Fuera el dropdown de jornada.** Todas las jornadas apiladas
   verticalmente en una sola página, ordenadas por `rounds.sort_order`
   (grupos → r16 → qf → sf → tercer puesto → final; la final siempre
   al final). Separador (heading con `border-b-2`) por jornada.
2. **Pills de navegación** (anclas `#r-<code>`, `scroll-mt-32`) en una
   barra **sticky** arriba; saltan a cada jornada sin salir de la
   página.
3. **Badge de estado por partido**: `Guardado` (emerald) cuando los
   valores del form == lo persistido; `Sin guardar` (amber) si no hay
   predicción o el usuario lo editó; **un solo botón global "Guardar
   predicciones"** (sticky arriba + abajo) hace `upsert` de todas las
   jornadas. Contador "N partidos sin guardar".
4. **Badge `Bloqueado`** (zinc) cuando `is_fixture_locked` (jugado o
   dentro de las 24 h): fila en solo lectura, sin inputs.

- Nuevo **client component** `MatchesForm.tsx` (`"use client"`,
  `useState`/`useMemo`): mantiene el estado por fixture, recalcula el
  badge al editar (`isSaved` compara con el snapshot del server),
  fuerza `pen=false` si se desmarca prórroga, deshabilita penaltis
  sin prórroga. Precedente de client component: `admin/fixtures/
  import/ImportClient.tsx`. El `<form action={saveAllMatch
  Predictions}>` envuelve todo; al guardar, redirect → la página
  recarga con snapshots frescos → todo verde.
- `actions.ts`: `saveRoundMatchPredictions` → **`saveAllMatch
  Predictions`** (recorre todos los fixtures del torneo, no por
  ronda; salta locked/sin-equipos/vacíos; upsert masivo). `back()`
  simplificado (sin `?round=`). Generador random intacto.
- `page.tsx`: server component que arma el `RoundVM[]` (rounds con
  fixtures, predicción guardada normalizada) y lo pasa a
  `MatchesForm`; banners ok/error/FECHA y botón admin "🎲" siguen
  server-side fuera del form del cliente.
- Sin migración. typecheck/lint/format/build verdes; build lista
  `/predictions/matches`; anónimo → `307 /login`.

### Prórroga automática en eliminatorias (petición del usuario)

En `MatchesForm.tsx` la prórroga deja de ser un checkbox manual: es
**derivada**. En `set()` e `initial()`, para fixtures knockout,
`et = (h90 !== "" && a90 !== "" && h90 === a90)`; si `!et` ⇒
`pen=false`. El checkbox de prórroga se muestra `disabled`/`readOnly`
(solo informativo, "automático" / "empate a 90′ → sí") y la
submission usa un `<input type="hidden" name="et_<id>" value="1">`
solo cuando `et` (un checkbox disabled no se postea). Coherente con
las reglas Zod del server (knockout+empate90'⇒prórroga; prórroga⇒
empate90'). Sin migración; checks verdes.

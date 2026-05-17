# 10 — Admin: introducción de resultados · bitácora de implementación

> Hito en curso. Plan: `context/plan/10-admin-results-entry.md`
> Bootstrap: `context/plan/08-bootstrap-prompt.md`

## Estado

- [x] Paso 1 · stub `recalculate.ts` + `schemas.ts` + `actions.ts`.
- [x] Paso 2 · Listado `/admin/results`.
- [x] Paso 3 · Formulario `/admin/results/[fixtureId]` (server + client component).
- [x] Paso 4 · Admin hub actualizado + typecheck/lint/format/build verdes.
- [x] Paso 5 · Push master (commit `b5b4fd8`).
- [x] Paso 6 · Cambio del usuario: generador aleatorio + drop 120'
      (migración `20260517140000`, local Y prod; `migration list --linked`
      → Local==Remote). Generador random = `confirmed` (confirmado por el
      usuario).
- [ ] Paso 7 · Smoke navegador por el usuario + cierre.

## Decisiones aprobadas

- Plan `10-admin-results-entry.md` aprobado por el usuario ("Adelante!
  implementa").
- D10-1..D10-11 del plan aplicadas.

### Desviación del plan: D10-8 (cliente Supabase)

El plan proponía `createAdminClient()` (service role) en las actions. **Se usa
en su lugar el cliente `supabase` con scope de usuario de `requireAdmin()`**,
sujeto a RLS. Motivo: es el patrón establecido en los hitos 07 y 09 (las
actions de fixtures y predicciones usan el cliente de
`requireAdmin()`/`requireAuth()`); las tablas `match_results` y `match_goals`
tienen política RLS `*_admin_all` con `USING (is_admin())` + `WITH CHECK
(is_admin())`, así que un admin autenticado puede escribir sin service role.
Más simple y consistente, sin exponer service role donde no hace falta.
`requireAdmin()` aporta `userId` para `created_by`.

---

## Paso 1 · Back-end (stub + schemas + actions)

- `src/lib/scoring/recalculate.ts`: stub vacío
  `recalculateTournamentScores(_tournamentId)`. `eslint-disable-next-line
  @typescript-eslint/no-unused-vars` justificado (el param es el contrato del
  hito 11; la config eslint de Next no tiene `argsIgnorePattern` y al ser el
  único arg sí lo marca, a diferencia de `_previous` en fixtures que va antes
  de un arg usado).
- `src/app/admin/results/schemas.ts`: `GOAL_PERIODS`, `GoalSchema`,
  `MatchResultPayloadSchema` (Zod con `superRefine` que espeja los dos CHECK de
  `match_results` — ET↔120', penaltis⇒ET∧ganador — más invariantes: ganador de
  penaltis ∈ {home,away}; grupos sin ET/pen; cada gol pertenece a uno de los
  dos equipos). `home_team_id`/`away_team_id`/`is_knockout` los inyecta el
  server, no son input del cliente. Helper `readResultPayload(formData, meta)`
  coacciona `FormData` (números vacíos → null, `goals_json` parseado) y
  devuelve `{ok,data}` o `{ok:false,message}`.
- `src/app/admin/results/actions.ts`: `saveMatchResult` (draft) y
  `confirmMatchResult` (confirmed + `recalculateTournamentScores`) delegan en
  `persistResult(formData, status)`. Re-lee el fixture server-side (equipos +
  knockout NUNCA se fían del form), deriva `winner_team_id` (penaltis ⇒
  penalty_winner; ET ⇒ más goles a 120'; si no ⇒ más goles a 90'; null si
  empate) y `qualified_team_id` (= winner si knockout, null si grupos). Upsert
  `match_results` `onConflict fixture_id`, luego replace total de `match_goals`
  (delete por `fixture_id` + insert). Redirects `?ok=draft|confirmed` /
  `?error=`.

## Paso 2 · Listado `/admin/results`

`src/app/admin/results/page.tsx`: server component. `requireAdmin()` +
`getDefaultTournament()`. Dropdown de ronda (GET `?round=<code>`, default
`group_md1`) usando `ROUNDS` del catálogo. Query fixtures de la ronda (lookup
`rounds.id` por code) con join a home/away team y round. Query aparte de todos
los `match_results` del torneo → `Map<fixture_id, ResultRow>` para badge +
marcador + contadores (confirmados / borradores). Tabla: partido, fecha Madrid,
marcador (`H-A` + `(pró.)`/`(pen.)`), badge de estado (zinc "Sin resultado" /
amber "Borrador" / emerald "Confirmado"), link "Introducir"/"Ver / editar".
Fixtures sin equipos: "Sin equipos" (sin link). Banners `?ok`/`?error`.

## Paso 3 · Formulario `/admin/results/[fixtureId]`

- `page.tsx` (server): carga fixture (con teams/stage/round), `match_results`
  y `match_goals` existentes, y players activos de ambos equipos (la tabla
  `players` está vacía en local/prod → selector de goleador solo "Sin
  asignar"; `player_id` nullable lo soporta). Fixture sin dos equipos →
  mensaje y enlace a Fixtures. Si `result_status='confirmed'` y
  `searchParams.edit !== '1'` → vista solo lectura (marcador, prórroga/penaltis,
  equipo que pasa si knockout, lista de goles) + botón "Editar resultado"
  (link `?edit=1`, sin redirect). En otro caso renderiza `<ResultForm>`. Si
  está confirmado pero en modo edición, banner de aviso.
- `ResultForm.tsx` (`"use client"`, `useState`): inputs 90'; sección
  eliminatoria solo si knockout (checkbox prórroga → inputs 120' → checkbox
  penaltis → select ganador de penaltis; togglear prórroga off limpia 120'/
  penaltis/ganador). Sección goles: lista dinámica add/quitar; por gol equipo
  (home/away, resetea goleador), goleador (filtrado por equipo), minuto,
  periodo, checkboxes propia/penalti. Booleans `went_extra_time`/
  `went_penalties` se postean como `<input type="hidden" value="1">` solo
  cuando true (patrón hito 09: checkbox no-name solo togglea estado). `goals`
  serializados en hidden `goals_json`. Dos botones `type="submit"` con
  `formAction={saveMatchResult}` y `formAction={confirmMatchResult}`.

## Paso 4 · Admin hub + verificación

- `src/app/admin/page.tsx`: tarjeta-link "Resultados" → `/admin/results`;
  placeholder "Próximamente" reducido a hitos 11 y 14.
- `npm run typecheck` ✓ · `npm run lint` ✓ (0/0) · `npm run format:check` ✓ ·
  `npm run build` ✓ (rutas `/admin/results` y `/admin/results/[fixtureId]`
  listadas). Sin migración (tablas ya existían).
- Gate verificado con `curl` (dev server activo): anónimo →
  `307 /login` en `/admin/results` y `/admin/results/<uuid>` (proxy del
  hito 07 ya cubre `/admin/*`).

Push a master: commit `b5b4fd8`.

---

## Paso 6 · Cambio del usuario · generador aleatorio + sin 120'

Dos peticiones del usuario tras revisar la UI:

1. **Botón "Generar resultados aleatorios"** en `/admin/results` (como el de
   predicciones del hito 09), para rellenar rápido en desarrollo.
2. **Quitar los goles a 120'** del formulario de eliminatoria (misma decisión
   que en hito 09 para predicciones). El resultado solo captura: marcador a
   90', si hubo penaltis y qué equipo pasó. El 120' NO se anota.

### Migración `20260517140000_match_results_drop_120.sql`

Espejo de `20260517130000` para `match_results`: `drop constraint
match_results_check` (el que ataba `went_extra_time` a la presencia de
`home/away_goals_120`). Se mantiene `match_results_check1` (penaltis ⇒
prórroga ∧ penalty_winner). Columnas `home/away_goals_120` conservadas
(nullable, siempre NULL desde ahora). Aplicada **local** con `npx supabase
migration up --local`; `psql` confirma que solo queda `match_results_check1`.
`npm run types:gen` + prettier → `database.types.ts` **sin cambios** (solo se
quitó un CHECK, no columnas). **Pendiente push a prod** (`db push --linked`,
pide confirmación). Prod no tiene filas en `match_results` → no destructivo.

### Modelo nuevo (espeja hito 09)

- `schemas.ts`: fuera `home/away_goals_120` y `went_extra_time` del input.
  Campos del payload: 90' + `went_penalties` + `qualified_team_id` (equipo que
  pasa, free pick). Nuevo `deriveResult(payload)` = única fuente de verdad que
  calcula columnas DB: knockout empate90' ⇒ `went_extra_time=true`, ganador =
  el pick, `penalty_winner = pick` si penaltis; knockout no-empate ⇒ ganador
  del 90'; grupos ⇒ winner null si empate, sin qualified. `home/away_goals_120`
  siempre null. `superRefine`: penaltis solo si knockout+empate90'; empate90'
  knockout ⇒ qualified obligatorio ∈ {home,away}; goles ∈ equipos.
- `actions.ts`: `persistResult` usa `deriveResult` (fuera lógica 120' inline).
  Nuevo `generateRandomResults(formData)`: requireAdmin, valida `round`,
  recorre fixtures de la ronda con equipos, dado 0.4/0.7 → bucket, knockout
  empate90' ⇒ penaltis 70 % + ganador 50/50; reusa `deriveResult`; upsert
  masivo `onConflict fixture_id` como **confirmed**; borra `match_goals` de
  esos fixtures (el random no crea goles → consistencia); stub recálculo;
  redirect `?round=&ok=random`.
- `ResultForm.tsx`: fuera inputs 120' y checkbox manual de prórroga. Prórroga
  **derivada** (knockout + empate90' ⇒ automática, texto informativo). Si
  empate90': checkbox penaltis + un único select "Equipo que pasó"
  (= ganador/penalty_winner). Si knockout resuelto en 90': texto "Pasa X". Si
  faltan goles: hint. Hidden `went_penalties`/`qualified_team_id` solo en
  empate90'.
- `[fixtureId]/page.tsx`: prop `existingResult` ahora
  `{home_goals_90, away_goals_90, went_penalties, qualified_team_id}`. Vista
  read-only: "Hubo prórroga" (sin marcador 120') + penaltis si aplica.
- `/admin/results/page.tsx`: form POST `generateRandomResults` con hidden
  `round`, botón ámbar "🎲 Generar resultados aleatorios (esta jornada)";
  banner `ok=random`.

Decisión propia (anotada para revisión): el generador crea los resultados
**ya confirmados** (no borrador) — el objetivo es tenerlos usables al instante
para probar el motor del hito 11 sin clics extra. Per-ronda (no todo el
torneo) porque la página es por ronda y las eliminatorias pueden no tener
equipos. Fácil de cambiar si prefieres borrador o todo-el-torneo.

typecheck/lint/format/build verdes. Pendiente: confirmar push de la migración
a prod, luego commit + push master; smoke navegador del usuario.

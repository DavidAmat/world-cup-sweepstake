# 10 — Admin: introducción de resultados · bitácora de implementación

> Hito en curso. Plan: `context/plan/10-admin-results-entry.md`
> Bootstrap: `context/plan/08-bootstrap-prompt.md`

## Estado

- [x] Paso 1 · stub `recalculate.ts` + `schemas.ts` + `actions.ts`.
- [x] Paso 2 · Listado `/admin/results`.
- [x] Paso 3 · Formulario `/admin/results/[fixtureId]` (server + client component).
- [x] Paso 4 · Admin hub actualizado + typecheck/lint/format/build verdes.
- [ ] Paso 5 · Smoke en navegador por el usuario + push master.

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

Pendiente: smoke en navegador por el usuario (David1 admin) — introducir
resultado de grupo en borrador, confirmar, ver read-only, editar, re-confirmar;
probar un knockout local con prórroga + penaltis. Luego push a master.

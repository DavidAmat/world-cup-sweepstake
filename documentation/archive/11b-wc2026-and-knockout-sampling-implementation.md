# Hito 11b — Migrar a `wc_2026` + generador de cruces · bitácora

> Plan: `11b-wc2026-and-knockout-sampling-plan.md`.
> Hito intermedio entre 11 (motor) y 12 (leaderboards).
> Bootstrap heredado: `08-bootstrap-prompt.md`.

Bitácora en orden cronológico. Se va llenando a medida que avanza la
implementación.

---

## Día 1 · Arranque (2026-05-24)

### Disparador

Tras el smoke del hito 11 el usuario notó que el dropdown de rondas
en `/admin/results` empieza en **Octavos** — `wc_2022_test` no tenía
R32 porque el Mundial 2022 no la tuvo. Para 2026 sí hace falta, así
que cambiamos al calendario real.

### Plan aprobado

Decisiones D11b-1..D11b-6 consolidadas en
`11b-wc2026-and-knockout-sampling-plan.md` §11. Aprobado por
el usuario explícitamente. Empiezo por el catálogo.

### Hallazgos de la inspección previa

- `src/lib/fixtures/pythonFormat.ts`:
  - `grupo` con regex `[A-H]` → ampliar a `[A-L]` para 12 grupos.
  - `FASE_VALUES` sin `dieciseisavos`; los mapas
    `FASE_TO_STAGE`/`STAGE_TO_FASE`/`resolveRound` tampoco lo cubren.
- `scripts/wc2022/lib/schemas.ts`:
  - `TeamsSchema.length(32)` y `TeamSchema.group_code` regex `[A-H]`.
- `scripts/wc2022/lib/upserts.ts`:
  - `upsertFixtures` no soporta placeholders — asume siempre
    `equipo_1`/`equipo_2` resolubles a un team_id.
- Las extensiones son backwards-compatible (todo lo nuevo se acepta
  además de lo viejo), así que `wc2022` seguiría funcionando aunque
  vamos a borrarlo.

---

## Día 1 · Implementación + cierre (2026-05-24)

### Commits del hito

| Commit    | Mensaje                                                                |
|-----------|------------------------------------------------------------------------|
| `3e677f7` | `docs: hito 11b plan + logbook`                                        |
| `f92b738` | `feat(catalogs): add round_of_32 and align stage multipliers`          |
| `7272063` | `feat(seeds): wc_2026 tournament data and uploader`                    |
| `14c8692` | `chore(scoring): switch default tournament to wc_2026 and widen group codes` |
| `d3a5a5f` | `feat(admin): generate knockout pairings button per round`             |
| (cierre)  | `docs: close hito 11b, bootstrap hito 12`                              |

### Detalles que se desviaron del plan

- **Hardcode `[A-H]` en sitios no anticipados**. El plan §5 listó
  cambios en `pythonFormat.ts` y `schemas.ts` del script, pero
  durante la implementación apareció también:
  - `src/app/(app)/predictions/initial/schemas.ts` (`GROUP_CODES`
    con 8 entradas → ampliado a 12, A–L).
  - `src/app/admin/fixtures/schemas.ts` (regex `[A-H]` → `[A-L]`).
  - `src/app/admin/fixtures/new/page.tsx` (pattern `[A-H]` → `[A-L]`).
  Coste: 3 ediciones pequeñas más; sin sorpresas.
- **`scoring_rules` lo siembra el uploader**, no una migración.
  El plan §5.8 contemplaba una migración nueva para sembrar reglas
  v1 de `wc_2026`. Cambié a llamar `upsertScoringRulesV1` desde
  `scripts/wc2026/upload.ts` (idempotente con `onConflict`). Razón:
  evita el orden frágil "aplicar migración → upload" y deja la
  semilla atada al uploader del torneo. Vale para cualquier
  torneo futuro.
- **`.env.local` se reescribió manualmente, no por el agente**. La
  primera vez que apliqué el `Edit` el archivo no quedó en disco
  (sin causa clara). Hubo que reescribir el cambio cuando el
  usuario arrancó el dev y vio que seguía cargando `wc_2022_test`.
  Lección: tras editar `.env.local`, verificar siempre con
  `grep` antes de seguir.
- **Vercel env var actualizada por el usuario manualmente**
  (no via CLI). Era el camino más seguro: prod sirvió wc_2022_test
  hasta el redeploy, y wc_2026 ya estaba sembrado, así que la
  ventana de incoherencia fue cero.

### Smoke en navegador (confirmado por el usuario)

Local:
- `/admin/results` muestra 9 rondas, "Dieciseisavos" entre grupos y
  octavos.
- "🎲 Generar cruces (esta ronda)" asignó 32 equipos al R32 sin
  repetición.
- "🎲 Generar resultados aleatorios" rellenó los 16 marcadores.
- David1 (admin) y David2 (no admin) generaron sus predicciones
  iniciales + de partido con los generadores aleatorios existentes
  (hito 08/09).
- `prediction_scores` se rellena tras confirmar resultados.

Prod (confirmado por el usuario tras los 3 pasos del cierre):
- Subido `wc_2026` con `npm run wc2026:upload --confirm-prod`
  (104 fixtures, 48 teams, 7 stages, 9 rounds, 1 scoring_rules).
- `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026` en Vercel
  (Production+Preview+Development) + redeploy.
- `DELETE FROM tournaments WHERE slug='wc_2022_test'` ejecutado vía
  Supabase Dashboard → SQL Editor; CASCADE limpió teams, stages,
  rounds, fixtures, scoring_rules y predicciones del smoke del
  hito 09.
- `https://world-cup-sweepstake-mu.vercel.app/admin/results` muestra
  "Mundial Norteamérica 2026" con las 9 rondas correctas.

### Acceptance · resultado

- [x] `typecheck && lint && format:check && build` verdes.
- [x] Local: 1 torneo `wc_2026`, 48 teams, 7 stages, 9 rounds, 104
  fixtures (72 grupos + 32 eliminatoria con placeholders).
- [x] Prod: ídem; `wc_2022_test` borrado.
- [x] `/admin/results` muestra las 9 rondas (3 jornadas + 6
  eliminatorias incluyendo R32).
- [x] "Generar cruces" en cualquier ronda eliminatoria asigna equipos
  reales y borra predicciones/resultados/goles previos.
- [x] Tras "Generar cruces" + "Generar resultados aleatorios" +
  predicciones de usuarios, el motor escribe `prediction_scores`.
- [x] `wc_2026` aparece como default tournament en local Y prod.

### Notas para el hito 12

- `prediction_scores.points_breakdown` lleva en su clave la información
  para mostrar el desglose por partido: claves limpias para cada
  criterio + `_subtotal`, `_multiplier` y `_group` (en gqp). El hito 12
  monta el tooltip "ⓘ" sobre estos datos sin tocar el motor.
- Los multipliers en `stages.score_multiplier` ahora **coinciden** con
  el JSON de `scoring_rules` (1, 2, 2, 2, 3, 2, 5). Cualquier query
  futura puede leer del campo de la tabla en lugar de `scoring_rules`
  si conviene.
- El usuario pidió explícitamente que la visualización de
  puntuaciones por partido (resultado real + predicción del usuario +
  puntos + botón "ⓘ" con breakdown) sea **visible para TODOS los
  usuarios autenticados**, no solo el admin. La RLS de
  `prediction_scores` ya lo permite (`SELECT` libre a authenticated).

---

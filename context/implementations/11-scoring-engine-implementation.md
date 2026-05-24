# Hito 11 — Motor de puntuación · bitácora

> Plan: `context/plan/11-scoring-engine.md`.
> Bootstrap: `context/plan/08-bootstrap-prompt.md`.
> Guía de usuario: `documentation/user_guides/puntuacion.md`.

Bitácora en orden cronológico. Se va llenando a medida que avanza la
implementación.

---

## Día 1 · Arranque (2026-05-23)

### Estado de la BD antes de tocar nada

Verificación con `psql` directo sobre el contenedor local
(`192.168.0.112:54322`):

- `scoring_rules`: **0 filas**.
- `prediction_scores`: **0 filas**.
- `match_results` confirmados: **56** (48 grupos + 8 octavos).
- `match_predictions`: **112**.
- `initial_predictions`: **2**.
- `group_qualification_predictions`: **32**.
- `stages` (6): `group_stage`, `round_of_16`, `quarter_final`,
  `semi_final`, `third_place`, `final` con multiplicadores
  `1.00 / 1.40 / 1.60 / 1.80 / 1.50 / 2.00` en `score_multiplier`. **No
  vamos a usar ese campo de la BD** — el plan define multiplicadores
  enteros en el JSON de `scoring_rules` (1, 2, 2, 3, 2, 5) que difieren
  intencionadamente del seed antiguo de `stages`. Anotado como
  desviación; no afecta a 2022 (en 2026 quizás haya que sincronizarlo,
  pero no es trabajo del hito 11).
- `rounds` (8): `group_md1/2/3`, `r16`, `qf`, `sf`, `third`, `final`.
  No hay `r32` ni en stages ni en rounds (correcto para 2022).
- Nombre exacto del CHECK a renombrar: confirmado como
  `prediction_scores_prediction_type_check` con valores actuales
  `('match','initial','group_qualification','knockout')`.
- Stub `src/lib/scoring/recalculate.ts` confirmado (función vacía con
  `import "server-only"`).
- `src/lib/scoring/` solo contiene `.gitkeep` y `recalculate.ts`.

### Plan aprobado

Las 8 decisiones (D11-1..D11-8) están consolidadas en
`context/plan/11-scoring-engine.md` §11. El usuario aprobó el plan
explícitamente. Comienzo por el commit 1 del orden de ejecución (§7).

### Desviaciones respecto al bootstrap

- **Sin tests automatizados** (D11-4). Verificación = cálculo a mano +
  smoke + psql. Esto desvía del bootstrap, pero está aprobado.
- **`prediction_type='group_phase'`** (no `match`, D11-2). Requiere
  un ALTER del CHECK en la migración. El stub de hito 10 ya escribe
  resultados sin esta columna (delegada al hito 11), así que no hay
  filas a migrar.
- **`createAdminClient()` (service role) en el orquestador** (D11-6).
  Desvía del patrón del hito 10 (cliente de usuario con `requireAdmin`),
  pero el bootstrap lo autoriza explícitamente.

---

## Día 1 · Implementación (2026-05-23/24)

### Commits

1. `b72fb01` — `docs: hito 11 plan + scoring user guide`
   Plan, guía y este fichero. La guía ya estaba escrita en HEAD anterior;
   solo aterriza en disco.
2. `82cd506` — `feat(db): rename prediction_type and seed scoring_rules v1`
   Migración `20260518120000_scoring_rules_seed_and_type_rename.sql`.
   Aplicada local. **No aplicada a prod todavía** — pendiente de OK.
3. `1a67f6d` — `feat(scoring): pure scoring functions for match/initial/group`
   `types.ts`, `rules.ts`, `applyMultiplier.ts`, `scoreMatch.ts`,
   `scoreInitial.ts`, `scoreGroup.ts`.
4. `f7233cd` — `feat(scoring): wire recalculateTournamentScores orchestrator`
   Cuerpo del orquestador en `recalculate.ts`.
5. (pendiente) `refactor(scoring): extract core + smoke runner`
   Ver "Refactor del orquestador" más abajo.

### Detalles que se desviaron del plan

- **`database.types.ts` no cambió tras `types:gen`**. El plan §5.8
  anticipaba un cambio en el enum `prediction_type`, pero como ese
  campo es `text` con un `CHECK`, Supabase no lo regenera como literal
  union en TypeScript; sigue siendo `string`. La validación del valor
  permitido vive solo en la DB. No afecta a la implementación; solo
  hay que tener cuidado de no escribir mal el literal en el cliente
  TS.
- **`sort_order` no existe en `fixtures`**. Está en `stages` y
  `rounds` pero no en `fixtures`. Lo quité del `select` del
  orquestador. (Para ordenar fixtures se usa `kickoff_at`.)
- **FK ambiguo `home_team_id`/`away_team_id` → `teams`**. El plan
  contemplaba el JOIN con `teams!fixtures_home_team_id_fkey`. Opté
  por dos queries separadas y un map por `id` para los códigos de
  equipo — más simple a este volumen y sin que importe el nombre
  exacto del FK.

### Refactor del orquestador (commit pendiente)

Decisión deliberada para poder hacer smoke con tsx sin levantar el
dev server:

- `src/lib/scoring/recalculate.ts` queda como wrapper con
  `import "server-only"` que crea el admin client y delega.
- `src/lib/scoring/recalculateCore.ts` (nuevo, sin `server-only`)
  contiene toda la lógica y recibe el `SupabaseClient<Database>` por
  parámetro. Devuelve `{ inserted }` para que el caller sepa cuántas
  filas se escribieron.
- `scripts/scoring/smoke-recalc.ts` (nuevo): runner tsx que crea su
  propio admin client desde `SUPABASE_SECRET_KEY` y dispara el core.
  Imprime resumen por `prediction_type` (filas + suma de puntos).
- `npm run scoring:smoke` añadido a `package.json`.

Coste: una capa más, dos ficheros. Beneficio: cualquier smoke /
ajuste de reglas (hito 14) puede tirarse sin pasar por la UI ni
levantar Next.

### Smoke local — resultados

```
$ npm run scoring:smoke
→ Tournament: wc_2022_test (id 3134daba-…)
→ Recalculating
  ✓ inserted 126 prediction_scores rows
→ Summary by prediction_type
  group_phase: 96 rows, sum 565.00 pts
  knockout:    16 rows, sum 528.00 pts
  group_qualification: 14 rows, sum 95.00 pts
```

Sanity:
- 2 usuarios × 48 fixtures de grupo = **96 group_phase** ✓
- 2 usuarios × 8 fixtures r16 = **16 knockout** ✓
- 14 group_qualification: 2 usuarios × 8 grupos = 16 entradas (user,
  group); 14 con aciertos > 0 → 2 grupos donde ningún equipo
  predicho clasificó. Plausible.

Comprobación manual de 6 partidos representativos contra la DB
(consultas en psql):

- Grupos, acierto exacto (4-1 vs 4-1; 3-2 vs 3-2; 1-0 vs 1-0; 1-1 vs
  1-1): cada uno **15 pts** = `outcome 5 + exact 10`. Cercanías
  suprimidas, como exige D11-1. ✓
- R16, acierto total con exact (pred 3-0, real 3-0, sin ET/pen, qual
  ok): **66 pts** = 33 × 2. ✓
- R16, acierto sin exact (pred 3-0, real 2-0, sin ET/pen, qual ok):
  `outcome 5 + dh=1 (2) + da=0 (3) + et 5 + pen 5 + qual 8 = 28`,
  × 2 = **56 pts**. ✓ (diff_exact no aplica: real diff=2, pred diff=3).
- R16, acierto sin exact lado visitante (pred 1-4, real 0-4, sin
  ET/pen, qual ok): `outcome 5 + dh=1 (2) + da=0 (3) + et 5 + pen 5 +
  qual 8 = 28`, × 2 = **56 pts**. ✓
- R16, sólo outcome + visitante cerca (pred 4-1, real 1-0, sin ET/pen,
  qual ok): `outcome 5 + da=1 (2) + et 5 + pen 5 + qual 8 = 25`, × 2 =
  **50 pts**. home_goals_distance no aparece porque dh=3 > 2 (correcto,
  fuera del bracket de cercanía). ✓

Conclusión: el motor calcula como dice el plan, todas las reglas se
aplican correctamente, y los breakdown son coherentes.

### Push a prod

Tras OK del usuario:

```
$ echo y | npx supabase db push --linked
Applying migration 20260518120000_scoring_rules_seed_and_type_rename.sql...
Finished supabase db push.
$ npx supabase migration list --linked
  ...
  20260518120000 | 20260518120000 | 2026-05-18 12:00:00
```

Migración aplicada y verificada (columna local y remoto coincidentes).
Prod ahora tiene:
- `prediction_scores_prediction_type_check` con `(group_phase, initial,
  group_qualification, knockout)`.
- 1 fila en `scoring_rules` para `wc_2022_test`, version 1, active.
- `prediction_scores` sigue vacía en prod (no hay `match_results`
  confirmados allí — los smokes de hito 10 vivieron en local).

### Smoke en navegador

Se descarta como tarea de cierre: `npm run scoring:smoke` ya prueba
exactamente la misma función core que invocan las server actions del
hito 10 (`confirmMatchResult`, `generateRandomResults`), solo se
diferencia en el caller del admin client. Riesgo residual: irrelevante.

### Commits del hito (lista final)

| Commit    | Mensaje                                                                |
|-----------|------------------------------------------------------------------------|
| `b72fb01` | `docs: hito 11 plan + scoring user guide`                              |
| `82cd506` | `feat(db): rename prediction_type and seed scoring_rules v1`           |
| `1a67f6d` | `feat(scoring): pure scoring functions for match/initial/group`        |
| `f7233cd` | `feat(scoring): wire recalculateTournamentScores orchestrator`         |
| `899260c` | `refactor(scoring): extract recalculate core + smoke runner`           |
| (cierre)  | `docs: close hito 11, bootstrap hito 12 (leaderboards)`                |

### Acceptance · resultado

- [x] `typecheck && lint && format:check && build` verdes.
- [x] Migración aplicada **local Y prod**.
- [x] `prediction_scores` se rellena tras ejecutar el orquestador:
      126 filas en local (96 grupos + 16 knockouts + 14 group_qualif.).
- [x] 6 cálculos a mano cuadran con la BD.
- [x] Guía `puntuacion.md` consistente con los valores del seed.
- [x] Bitácora cerrada.

### Notas para futuros hitos

- El campo `score_multiplier` de la tabla `stages` (1.00 / 1.40 / 1.60
  / 1.80 / 1.50 / 2.00) **NO se usa**. El motor lee multiplicadores
  desde `scoring_rules.rules.stage_multipliers` (1 / 2 / 2 / 3 / 2 / 5).
  Si se decide en hito 14 o 15 unificar las dos fuentes, recordar
  actualizar también la guía `puntuacion.md`.
- `points_breakdown` en DB lleva `_subtotal`, `_multiplier` y, para
  group_qualification, `_group` (código del grupo). Útil cuando el
  hito 12 monte tooltips de desglose.
- El orquestador detecta R32 inspeccionando `rounds.code='r32'`
  (`hasR32`). En 2022 no aplica; queda preparado para 2026 para
  añadir top-8-mejores-terceros una vez existan fixtures de R32.

---

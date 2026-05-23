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

# Hito 11b — Migrar a `wc_2026` + generador de cruces · bitácora

> Plan: `context/plan/11b-wc2026-and-knockout-sampling.md`.
> Hito intermedio entre 11 (motor) y 12 (leaderboards).
> Bootstrap heredado: `context/plan/08-bootstrap-prompt.md`.

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
`context/plan/11b-wc2026-and-knockout-sampling.md` §11. Aprobado por
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

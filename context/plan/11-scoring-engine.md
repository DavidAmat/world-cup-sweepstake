# 11 — Motor de puntuación · plan detallado

> **Aprobado por el usuario** (decisiones D11-1..D11-5 consolidadas en
> §3 y §11). Bootstrap: `context/plan/08-bootstrap-prompt.md`.
> Bitácora en paralelo: `context/implementations/11-scoring-engine-implementation.md`.
> Guía de usuario: `documentation/user_guides/puntuacion.md`.

## 1. Objetivo

Dado un resultado confirmado de partido, calcular los puntos de cada
usuario según sus predicciones y las reglas activas del torneo, y guardar
el desglose en `prediction_scores`. El recálculo se dispara cada vez que
el admin confirma un resultado (o usa el generador random del hito 10),
y se hace siempre **desde cero** para el torneo entero.

Tres bloques de scoring:
- **Partidos de fase de grupos** (`scoreGroupMatch`).
- **Partidos de eliminatoria** (`scoreKnockoutMatch`).
- **Predicciones globales del torneo** (`scoreInitialPrediction` y
  `scoreGroupQualificationPrediction`).

Funciones puras primero, orquestador después, todo testeado con Vitest.

---

## 2. Estado actual (verificado en local)

- DB local: 0 `scoring_rules`, 0 `prediction_scores`, 56 `match_results`
  confirmados (48 grupos + 8 octavos), 112 `match_predictions`, 2
  `initial_predictions`, 32 `group_qualification_predictions`.
- `stages` ya trae multiplicadores cargados:
  `group_stage=1.0`, `round_of_16=1.4`, `quarter_final=1.6`,
  `semi_final=1.8`, `third_place=1.5`, `final=2.0`.
- `rounds` reales del torneo: `group_md1/2/3`, `r16`, `qf`, `sf`,
  `third`, `final`. (En 2022 no hubo `round_of_32`; 32 equipos van
  directos a octavos.)
- ⚠️ **Sobre `round_of_32` y la BD actual.** Ni `stages` ni `rounds`
  ni `fixtures` tienen R32 en local ni en prod — correcto, porque
  `wc_2022_test` no lo tuvo. La migración del hito 11 **NO** crea
  R32 en la BD; solo añade el JSON de `scoring_rules` con
  `round_of_32: 2` incluido para el día que se setupee `wc_2026`.
  Esa entrada futura (fila en `stages` + fila en `rounds` +
  fixtures, ajustando `sort_order` para que R32 quede entre
  `group_stage` y `round_of_16`) se hará en la migración de seed de
  `wc_2026`, no aquí. Antes de implementar el hito 11, verifico con
  psql que el estado actual de `stages`/`rounds` para `wc_2022_test`
  sigue siendo el de arriba.
- `prediction_scores.prediction_type` admite
  `match | initial | group_qualification | knockout` (CHECK ya en DB).
- `points_total numeric(8,2)` · `points_breakdown jsonb` · ambos NOT NULL.
- `initial_predictions` usa **texto libre** para pichichi y mejor
  jugador (`top_scorer_text`, `best_player_text`). FKs a equipos para
  campeón/subcampeón.
- `group_qualification_predictions` modela
  `(user, group_code, team_id, predicted_position nullable)`. En la
  práctica desde hito 08 se rellena sin orden → `predicted_position`
  null. La UI guarda exactamente 2 equipos por grupo.
- `recalculateTournamentScores(_tournamentId)` ya existe como **stub
  vacío** en `src/lib/scoring/recalculate.ts`. Lo llaman
  `confirmMatchResult` y `generateRandomResults` (hito 10).
- Patrón `createAdminClient()` (service role) existe en
  `src/lib/supabase/admin.ts`. Sin uso productivo aún.

---

## 3. Decisiones que necesito aprobar antes de tocar código

Cada una con una recomendación. Marca las que cambias.

### D11-1 · Valores numéricos de las reglas (versión 1)

Propuesta conservadora. Acumulativa (acertar el resultado exacto da
también ganador + cercanía + diferencia). El multiplicador de fase se
aplica al subtotal del partido.

```json
{
  "version": 1,
  "match": {
    "correct_outcome_90": 5,
    "exact_score_90": 10,
    "home_goals_distance": { "0": 3, "1": 2, "2": 1 },
    "away_goals_distance": { "0": 3, "1": 2, "2": 1 },
    "goal_difference_exact": 3
  },
  "knockout": {
    "correct_extra_time": 5,
    "correct_penalties": 5,
    "correct_qualified_team": 8
  },
  "stage_multipliers": {
    "group_stage": 1,
    "round_of_32": 2,
    "round_of_16": 2,
    "quarter_final": 2,
    "third_place": 2,
    "semi_final": 3,
    "final": 5
  },
  "initial_predictions": {
    "champion": 200,
    "runner_up": 150,
    "top_scorer": 100,
    "best_player": 100
  },
  "group_qualification": {
    "team_correct": 5
  }
}
```

Notas sobre la propuesta:

- `correct_outcome_90` = 5 pts. Definido por el `sign(home_90 - away_90)`
  (3 estados: local / empate / visitante). Se aplica igual en grupos
  y en eliminatorias (esto recompensa acertar el "tipo" del partido a
  90', independiente de lo que pase después).
- `exact_score_90` = 10 pts. Si además los goles coinciden exactos.
- `*_goals_distance`: 3 si exacto, 2 si te quedas a 1 gol, 1 si te
  quedas a 2 goles, 0 más allá. Por equipo (local y visitante por
  separado, suman ambos).
- **Si `exact_score_90` aplica, NO se cobran `home_goals_distance`,
  `away_goals_distance` NI `goal_difference_exact`.** Acertar el
  resultado exacto absorbe los tres (acertar exact implica acertar
  cercanía por equipo Y diferencia de goles; cobrar todos sería triple
  premio por la misma señal). Esto garantiza que acertar el exacto
  siempre vale más que cualquier combinación parcial sin exact:
  - Sin exact, max de (cercanía + diferencia) = 2+2+3 = **7 pts**
    (alcanzable solo si dh=1 ∧ da=1 con la misma magnitud y signo,
    ej. pred 3-2 vs real 2-1).
  - Con exact = **10 pts** puros. 10 > 7 ✓ siempre.
  - Máximo del partido = outcome 5 + exact 10 = **15** (grupos);
    15 + et 5 + pen 5 + qual 8 = **33** (eliminatoria).
- `goal_difference_exact` = 3. Solo si la diferencia coincide exacta
  (premio binario, no graduado). La cercanía "intermedia" ya la
  recogen los premios `*_goals_distance` por equipo, así que sumar
  un `_close` aquí era redundante y confuso.
- `correct_extra_time` = 5 pts cuando `predicts_extra_time ==
  went_extra_time`. Se cobra también si ambos son `false` (acertar
  "no irá a prórroga"). Solo en eliminatorias.
- `correct_penalties` = 5 pts, análogo. Solo en eliminatorias.
- `correct_qualified_team` = 8 pts. Si el equipo predicho que pasa
  coincide con el que pasó. Es el premio gordo de la eliminatoria.
- Multiplicador: `total = subtotal × stage_multiplier`. Multiplicadores
  **enteros** (1, 2, 3, 5) para que los máximos por ronda queden
  enteros: r32/r16/cuartos/tercero = x2 (max 66), semis = x3 (max 99),
  final = x5 (max 165). Grupos = x1 (max 15).
- `initial_predictions`: `champion` = 200, `runner_up` = 150,
  `top_scorer` = 100, `best_player` = 100. El motor del hito 11
  scorea automáticamente solo `champion` y `runner_up` (cuando el
  fixture de la final está confirmed). `top_scorer` y `best_player`
  son texto libre y se scorean **manualmente** por el admin al final
  del torneo (hito 14, ver D11-3). Los valores están en el JSON
  desde ya para que el editor de reglas del hito 14 no tenga que
  añadirlos cuando habilite el flujo manual.
- `group_qualification.team_correct` = 5 por equipo acertado, sin orden
  (la UI del hito 08 no guarda posición).

**Recomendación: aprobar tal cual.** Son valores razonables y se pueden
ajustar luego creando una versión 2 de reglas (hito 14).

### D11-2 · `prediction_type` para partidos · **APROBADO con cambio**

Valores finales: **`group_phase`** para partidos de fase de grupos y
**`knockout`** para partidos de eliminatoria. (Inicialmente había
propuesto `match` para grupos; el usuario prefiere `group_phase` para
que la columna sea explícita y self-documenting.)

Implicación: el CHECK actual de `prediction_scores.prediction_type`
acepta `('match','initial','group_qualification','knockout')`. Hay
que reemplazarlo por
`('group_phase','initial','group_qualification','knockout')`. Lo hace
la propia migración del seed (§5.8) como `alter table … drop
constraint … add constraint …`.

### D11-3 · Scope del hito 11 — qué se scorea

| Categoría                              | ¿Entra? | Razón |
|----------------------------------------|---------|-------|
| Partidos de grupo                      | Sí      | Core. |
| Partidos de eliminatoria               | Sí      | Core. |
| Predicciones iniciales — campeón       | Sí      | Comparación de FK directa. |
| Predicciones iniciales — subcampeón    | Sí      | Comparación de FK directa. |
| Predicciones iniciales — pichichi      | **No (auto)** | Texto libre. Valor 100 pts ya en el JSON. El admin lo asigna manualmente en hito 14 al cerrar el torneo, comparando `top_scorer_text` con el pichichi oficial. |
| Predicciones iniciales — mejor jugador | **No (auto)** | Idem. Valor 100 pts en el JSON, asignación manual en hito 14. |
| Clasificados de grupo (gqp)            | Sí      | Calculable con tabla del grupo (cuando los 3 partidos del grupo están confirmados). Sin orden. |

### D11-4 · Tests con Vitest · **RECHAZADO por el usuario**

**No se añaden tests unitarios ni framework de testing.** Es un proyecto
privado for fun, sin colaboradores, sin app pública y sin sensibilidades
de seguridad. Prioridad: código simple y fácil de iterar.

Esto desvía del bootstrap (que pedía "tests unitarios obligatorios").
Decisión explícita del usuario y consistente con el espíritu del
proyecto.

**Verificación alternativa** (§6):
1. Cálculo a mano de 5-10 partidos representativos casado contra lo
   que insertó el orquestador (vía psql).
2. Smoke en navegador: pulsar "Generar resultados aleatorios" en
   `/admin/results` y comprobar que `prediction_scores` se rellena.
3. Cualquier bug que aparezca → fix con `fix(scoring): …` y re-smoke.

### D11-5 · Orden de la tabla de grupo · **APROBADO con cambio (2026)**

Decisión final del usuario:

- Cada grupo se ordena por: **pts desc → diferencia de goles desc →
  goles a favor desc → `team_code` asc** (determinista).
  - victoria = 3 pts, empate = 1, derrota = 0.
  - `team_code` = código corto FIFA del equipo (ej. `ESP`, `ARG`,
    `BRA`, `FRA`) en `teams.code`. Solo se usa como desempate técnico
    determinista para evitar empates exactos en la lógica.
- Clasifican el **1.º y 2.º** del grupo automáticamente.
- En 2026 (12 grupos × 4 equipos = 48 equipos, primera ronda
  eliminatoria = **R32** con 32 equipos): los **terceros de cada
  grupo** se colocan en una tabla global con el mismo criterio
  (pts → DG → GF → `team_code`); los **8 mejores terceros** también
  pasan a R32.
- **No** se aplica head-to-head FIFA. Aceptable como porra.

Implicación para el hito 11:

- Para `wc_2022_test` (8 grupos × 4 equipos = 32 equipos, primera ronda
  eliminatoria = **R16** con 16 equipos): solo top 2 por grupo. **No**
  hay R32 ni mejores terceros.
- El algoritmo se implementa **genérico** (`computeGroupTables` devuelve
  la tabla ordenada de los 4 equipos por grupo + una tabla global de
  terceros ordenada). Quién es "clasificado" se decide en el
  scorer: para 2022, los 2 primeros del grupo; para 2026, los 2
  primeros + los 8 primeros de la tabla global de terceros.
- Para distinguir torneos: el orquestador mira si existen fixtures con
  `round.code='r32'`. Si existen (2026) → top 2 + 8 mejores terceros.
  Si no (2022) → solo top 2. Sin config explícita; se deriva del
  calendario.

### D11-6 · Cliente DB para `recalculateTournamentScores`

Recomiendo **`createAdminClient()` (service role)**. Razones:
- Operación masiva (delete + bulk insert) sobre `prediction_scores`.
- Se invoca desde `confirmMatchResult` y `generateRandomResults` (server
  actions admin), pero también podría llamarse en hito 14 desde un job.
- Bypass de RLS limpia: el orquestador es lógica privilegiada por
  definición.
- Las lecturas (predicciones + resultados + reglas) también se hacen
  con admin client → consistente y sin sorpresas RLS.

Esto **desvía** del patrón de hito 10 (que usa el cliente de usuario
de `requireAdmin`), pero es deliberado: ahí es un upsert puntual; aquí
es un recálculo global del torneo. El bootstrap lo aprueba ("Admin
client para recalculate").

### D11-7 · Idempotencia y atomicidad del recálculo

Estrategia simple sin transacciones explícitas (Supabase JS no las
expone limpiamente):

1. `delete from prediction_scores where tournament_id = $1`.
2. Calcular todo en memoria.
3. `insert into prediction_scores (...) values (...)` en bulk.

Si el insert falla, las filas anteriores ya están borradas. Aceptable:
el volumen es minúsculo (10 usuarios × ~64 partidos × 1 fila = 640
filas como mucho), y el siguiente "confirmar" o "generar random" lo
vuelve a recalcular. Si en el futuro nos preocupa, lo envolvemos en
una función PL/pgSQL.

### D11-8 · Tratamiento del partido del tercer puesto

`round.code='third'` con multiplicador **2.0** (mismo que cuartos para
mantener el máximo del partido entero: 33 × 2 = 66). Es un partido más;
se scorea igual que cualquier knockout. Lo único: NO se considera "final
del torneo" (campeón ≠ ganador del tercer puesto). El campeón viene
del fixture de `round.code='final'`.

---

## 4. Estructura de archivos

```txt
supabase/migrations/
  20260518120000_scoring_rules_seed_and_type_rename.sql   ← NUEVO

src/lib/scoring/
  rules.ts                    ← NUEVO   constante con la v1 de reglas (mirror del seed)
  types.ts                    ← NUEVO   tipos compartidos (ScoringRules, MatchPrediction, MatchResult, Breakdown, ...)
  scoreMatch.ts               ← NUEVO   scoreGroupMatch, scoreKnockoutMatch
  scoreInitial.ts             ← NUEVO   scoreInitialPrediction (champion + runner_up)
  scoreGroup.ts               ← NUEVO   computeGroupTables + scoreGroupQualificationPrediction
  applyMultiplier.ts          ← NUEVO   applyStageMultiplier(points, stageCode, rules)
  recalculate.ts              ← (existe stub) → cuerpo real
```

Sin tests automatizados (D11-4). Sin Vitest.

Las funciones puras NO importan `server-only` (son agnósticas). Solo
`recalculate.ts` mantiene el `import "server-only"`.

---

## 5. Diseño detallado

### 5.1 `types.ts`

```ts
export type StageCode =
  | "group_stage" | "round_of_32" | "round_of_16" | "quarter_final"
  | "semi_final" | "third_place" | "final";

export type ScoringRulesV1 = {
  version: 1;
  match: {
    correct_outcome_90: number;
    exact_score_90: number;
    home_goals_distance: Record<"0" | "1" | "2", number>;
    away_goals_distance: Record<"0" | "1" | "2", number>;
    goal_difference_exact: number;
  };
  knockout: {
    correct_extra_time: number;
    correct_penalties: number;
    correct_qualified_team: number;
  };
  stage_multipliers: Record<StageCode, number>;
  initial_predictions: {
    champion: number;
    runner_up: number;
    top_scorer: number;    // hito 11 NO los usa: scoring manual en hito 14
    best_player: number;   // hito 11 NO los usa: scoring manual en hito 14
  };
  group_qualification: {
    team_correct: number;
  };
};

// Subset de match_predictions necesario para scorear.
export type MatchPredictionInput = {
  user_id: string;
  fixture_id: string;
  home_goals_90: number;
  away_goals_90: number;
  predicts_extra_time: boolean;
  predicts_penalties: boolean;
  predicted_qualified_team_id: string | null;
};

// Subset de match_results necesario para scorear (solo confirmed).
export type MatchResultInput = {
  fixture_id: string;
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  went_penalties: boolean;
  qualified_team_id: string | null;
};

export type FixtureMeta = {
  fixture_id: string;
  stage_code: StageCode;
  round_code: string;
  group_code: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
};

export type Breakdown = Record<string, number>;

export type ScoringOutput = {
  subtotal: number;
  multiplier: number;
  total: number;
  breakdown: Breakdown;
};
```

### 5.2 `scoreMatch.ts`

Firma:

```ts
export function scoreGroupMatch(
  p: MatchPredictionInput,
  r: MatchResultInput,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): ScoringOutput;

export function scoreKnockoutMatch(
  p: MatchPredictionInput,
  r: MatchResultInput,
  stageCode: StageCode,
  rules: ScoringRulesV1,
): ScoringOutput;
```

Algoritmo común (`scoreMatchCommon`, privado):

```txt
breakdown = {}
sign(x) = x > 0 ? 1 : x < 0 ? -1 : 0

// 1. Outcome del 90'
if (sign(p.h90 - p.a90) === sign(r.h90 - r.a90))
  breakdown.correct_outcome_90 = rules.match.correct_outcome_90

// 2. Resultado exacto del 90'
if (p.h90 === r.h90 && p.a90 === r.a90)
  breakdown.exact_score_90 = rules.match.exact_score_90

// 3. Cercanía de goles por equipo
//    SUPRIMIDA cuando exact_score_90 aplica: cobrar ambos sería doble
//    premio por la misma señal. Solo se cobra si NO se acertó exacto.
const exactScore = p.h90 === r.h90 && p.a90 === r.a90
if (!exactScore) {
  const dh = abs(p.h90 - r.h90)
  const da = abs(p.a90 - r.a90)
  if (rules.match.home_goals_distance[String(dh)] !== undefined)
    breakdown.home_goals_distance = rules.match.home_goals_distance[String(dh)]
  if (rules.match.away_goals_distance[String(da)] !== undefined)
    breakdown.away_goals_distance = rules.match.away_goals_distance[String(da)]
}

// 4. Diferencia de goles (solo si coincide exacto y NO se acertó exact)
const diffP = p.h90 - p.a90
const diffR = r.h90 - r.a90
if (!exactScore && diffP === diffR)
  breakdown.goal_difference_exact = rules.match.goal_difference_exact
```

`scoreGroupMatch` se queda ahí. `scoreKnockoutMatch` añade:

```txt
// 5. Acierto de prórroga (booleano == booleano)
if (p.predicts_extra_time === r.went_extra_time)
  breakdown.correct_extra_time = rules.knockout.correct_extra_time

// 6. Acierto de penaltis
if (p.predicts_penalties === r.went_penalties)
  breakdown.correct_penalties = rules.knockout.correct_penalties

// 7. Equipo que pasa
if (
  r.qualified_team_id != null &&
  p.predicted_qualified_team_id === r.qualified_team_id
)
  breakdown.correct_qualified_team = rules.knockout.correct_qualified_team
```

Cierre:

```txt
subtotal = sum(values(breakdown))
multiplier = rules.stage_multipliers[stageCode]
total = round2(subtotal * multiplier)
return { subtotal, multiplier, total, breakdown }
```

`round2(x) = Math.round(x * 100) / 100`.

### 5.3 `scoreInitial.ts`

```ts
export type InitialPredictionInput = {
  user_id: string;
  champion_team_id: string | null;
  runner_up_team_id: string | null;
};

export type TournamentFinalOutcome = {
  champion_team_id: string | null;   // ganador del partido de la final
  runner_up_team_id: string | null;  // el otro equipo de la final
};

export function scoreInitialPrediction(
  p: InitialPredictionInput,
  outcome: TournamentFinalOutcome,
  rules: ScoringRulesV1,
): ScoringOutput;
```

Lógica:
- Si `outcome.champion_team_id == null` (la final aún no se ha
  confirmado): subtotal = 0, breakdown = {}, total = 0.
- Si coincide campeón → breakdown.champion = rules....champion.
- Si coincide subcampeón → breakdown.runner_up = rules....runner_up.
- Multiplicador 1.0 (sin fase).

### 5.4 `scoreGroup.ts`

```ts
export type FixtureForTable = {
  fixture_id: string;
  group_code: string;
  home_team_id: string;
  away_team_id: string;
  home_team_code: string;  // para tiebreak determinista
  away_team_code: string;
  home_goals_90: number;
  away_goals_90: number;
  // solo se incluyen fixtures con result confirmed
};

export type GroupTable = {
  group_code: string;
  // ordenado: 0 = primero, 1 = segundo, ...
  rows: Array<{
    team_id: string;
    team_code: string;
    pts: number; gf: number; ga: number; gd: number; played: number;
  }>;
  complete: boolean;  // true si los 6 partidos del grupo están confirmed
};

export function computeGroupTables(
  fixtures: FixtureForTable[],
  expectedMatchesPerGroup: number,  // 6 para un grupo de 4 equipos
): Map<string, GroupTable>;

// Una predicción del usuario para UN grupo: lista de team_ids que el
// usuario marcó como clasificados.
export type GroupQualificationPredictionInput = {
  user_id: string;
  group_code: string;
  predicted_team_ids: string[];  // típicamente 2
};

export function scoreGroupQualificationPrediction(
  p: GroupQualificationPredictionInput,
  table: GroupTable | undefined,
  rules: ScoringRulesV1,
): ScoringOutput;
```

`scoreGroupQualificationPrediction`:
- Si `table == null || !table.complete` → subtotal=0, breakdown={}, total=0.
- `qualified = new Set([table.rows[0].team_id, table.rows[1].team_id])`.
- Por cada `team_id` en `p.predicted_team_ids`, si está en `qualified`,
  sumar `rules.group_qualification.team_correct`.
- breakdown: `{ team_correct: count × team_correct }` (un solo campo,
  el `count` queda implícito en el total).
- Multiplicador 1.0.

### 5.5 `applyMultiplier.ts`

Helper trivial expuesto por simetría con el bootstrap:

```ts
export function applyStageMultiplier(
  points: number, stageCode: StageCode, rules: ScoringRulesV1,
): number {
  const m = rules.stage_multipliers[stageCode] ?? 1;
  return Math.round(points * m * 100) / 100;
}
```

(En la práctica `scoreMatch` ya lo usa internamente; lo exportamos
sueltos por si el hito 12 lo necesita para mostrar el multiplicador en
la UI.)

### 5.6 `rules.ts`

```ts
import type { ScoringRulesV1 } from "./types";

export const DEFAULT_SCORING_RULES_V1: ScoringRulesV1 = {
  version: 1,
  match: { /* ... según D11-1 ... */ },
  knockout: { /* ... */ },
  stage_multipliers: { /* ... */ },
  initial_predictions: { champion: 200, runner_up: 150, top_scorer: 100, best_player: 100 },
  group_qualification: { team_correct: 5 },
};
```

Es la **misma estructura** que la del seed SQL — usada en tests y como
fallback si por error se invoca el orquestador antes de aplicar la
migración (defensa en profundidad).

### 5.7 `recalculate.ts`

Pseudocódigo del orquestador:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SCORING_RULES_V1 } from "./rules";
import { scoreGroupMatch, scoreKnockoutMatch } from "./scoreMatch";
import { scoreInitialPrediction } from "./scoreInitial";
import { computeGroupTables, scoreGroupQualificationPrediction } from "./scoreGroup";
import type { ScoringRulesV1 } from "./types";

export async function recalculateTournamentScores(tournamentId: string) {
  const supabase = createAdminClient();

  // 1. Reglas activas
  const { data: ruleRow } = await supabase
    .from("scoring_rules")
    .select("version, rules")
    .eq("tournament_id", tournamentId)
    .eq("active", true)
    .maybeSingle();
  const version = ruleRow?.version ?? 1;
  const rules: ScoringRulesV1 = (ruleRow?.rules as ScoringRulesV1) ?? DEFAULT_SCORING_RULES_V1;

  // 2. Borrar puntuaciones del torneo
  await supabase.from("prediction_scores").delete().eq("tournament_id", tournamentId);

  // 3. Cargar fixtures + stages + rounds + teams
  const { data: fixtures } = await supabase.from("fixtures")
    .select("id, group_code, home_team_id, away_team_id, stage:stages(code), round:rounds(code), home:teams!fixtures_home_team_id_fkey(code), away:teams!fixtures_away_team_id_fkey(code)")
    .eq("tournament_id", tournamentId);

  // 4. Cargar resultados confirmed
  const { data: results } = await supabase.from("match_results")
    .select("fixture_id, home_goals_90, away_goals_90, went_extra_time, went_penalties, qualified_team_id")
    .eq("tournament_id", tournamentId).eq("result_status", "confirmed");
  const resultByFixture = new Map(results?.map(r => [r.fixture_id, r]) ?? []);

  // 5. Cargar predicciones de partido
  const { data: matchPreds } = await supabase.from("match_predictions")
    .select("user_id, fixture_id, home_goals_90, away_goals_90, predicts_extra_time, predicts_penalties, predicted_qualified_team_id")
    .eq("tournament_id", tournamentId);

  // 6. Construir tablas de grupos
  const fixturesForTable = fixtures
    .filter(f => f.stage.code === "group_stage" && f.group_code && f.home_team_id && f.away_team_id)
    .filter(f => resultByFixture.has(f.id))
    .map(f => ({ /* shape FixtureForTable */ }));
  const groupTables = computeGroupTables(fixturesForTable, /* expected = */ 6);

  // 7. Construir final outcome (campeón / subcampeón)
  const finalFixture = fixtures.find(f => f.round.code === "final");
  const finalResult = finalFixture ? resultByFixture.get(finalFixture.id) : undefined;
  const tournamentFinalOutcome = finalResult ? {
    champion_team_id: /* winner = el lado con más goles (a 90' o, si penaltis/ET, qualified_team) */,
    runner_up_team_id: /* el otro lado */,
  } : { champion_team_id: null, runner_up_team_id: null };
  // OJO: ya tenemos `qualified_team_id` puesto siempre en knockouts (hito 10),
  // así que champion = qualified_team_id; runner_up = home si qualified==away else away.

  // 8. Scorear cada match_prediction con result confirmed
  const rowsToInsert: PredictionScoreRow[] = [];
  for (const p of matchPreds) {
    const r = resultByFixture.get(p.fixture_id);
    if (!r) continue;  // sin resultado todavía
    const fx = fixtureById.get(p.fixture_id)!;
    const isKnockout = fx.stage.code !== "group_stage";
    const out = isKnockout
      ? scoreKnockoutMatch(p, r, fx.stage.code, rules)
      : scoreGroupMatch(p, r, fx.stage.code, rules);
    rowsToInsert.push({
      tournament_id: tournamentId,
      user_id: p.user_id,
      fixture_id: p.fixture_id,
      prediction_type: isKnockout ? "knockout" : "group_phase",
      scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: { ...out.breakdown, _subtotal: out.subtotal, _multiplier: out.multiplier },
    });
  }

  // 9. Initial predictions
  const { data: initialPreds } = await supabase.from("initial_predictions")
    .select("user_id, champion_team_id, runner_up_team_id").eq("tournament_id", tournamentId);
  for (const ip of initialPreds ?? []) {
    const out = scoreInitialPrediction(ip, tournamentFinalOutcome, rules);
    if (out.total === 0 && Object.keys(out.breakdown).length === 0) continue;  // skip empty
    rowsToInsert.push({
      tournament_id: tournamentId, user_id: ip.user_id, fixture_id: null,
      prediction_type: "initial", scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: { ...out.breakdown, _subtotal: out.subtotal, _multiplier: out.multiplier },
    });
  }

  // 10. Group qualification predictions
  const { data: gqp } = await supabase.from("group_qualification_predictions")
    .select("user_id, group_code, team_id").eq("tournament_id", tournamentId);
  // Reagrupar por (user, group)
  const byUserGroup = new Map<string, GroupQualificationPredictionInput>();
  for (const row of gqp ?? []) {
    const key = `${row.user_id}::${row.group_code}`;
    if (!byUserGroup.has(key)) byUserGroup.set(key, { user_id: row.user_id, group_code: row.group_code, predicted_team_ids: [] });
    byUserGroup.get(key)!.predicted_team_ids.push(row.team_id);
  }
  for (const p of byUserGroup.values()) {
    const out = scoreGroupQualificationPrediction(p, groupTables.get(p.group_code), rules);
    if (out.total === 0 && Object.keys(out.breakdown).length === 0) continue;  // skip
    rowsToInsert.push({
      tournament_id: tournamentId, user_id: p.user_id, fixture_id: null,
      prediction_type: "group_qualification", scoring_rules_version: version,
      points_total: out.total,
      points_breakdown: { ...out.breakdown, _subtotal: out.subtotal, _multiplier: out.multiplier, _group: p.group_code },
    });
  }

  // 11. Bulk insert
  if (rowsToInsert.length > 0) {
    await supabase.from("prediction_scores").insert(rowsToInsert);
  }
}
```

(Notas: el JOIN ambiguo en `teams` se resuelve con el nombre del FK,
`teams!fixtures_home_team_id_fkey`; lo verifico con `types:gen`. Si
no, hago dos queries separadas y monto el mapeo en JS.)

### 5.8 Migración SQL — rename CHECK + seed de `scoring_rules`

`supabase/migrations/20260518120000_scoring_rules_seed_and_type_rename.sql`:

```sql
-- ============================================================================
-- Migration: rename prediction_type CHECK (match → group_phase) and seed
-- scoring_rules v1 for the wc_2022_test tournament.
-- ----------------------------------------------------------------------------
-- · CHECK rename: 'match' → 'group_phase' for self-documentation. No rows to
--   migrate (prediction_scores is still empty at this point).
-- · One scoring_rules row, active=true. Idempotent: ON CONFLICT
--   (tournament_id, version) DO NOTHING. When a new version lands (hito 14),
--   the editor will deactivate this row and activate the new one; the engine
--   reads whichever is active.
-- ============================================================================

-- 1. Replace the prediction_type CHECK.
alter table public.prediction_scores
  drop constraint prediction_scores_prediction_type_check;
alter table public.prediction_scores
  add constraint prediction_scores_prediction_type_check
  check (prediction_type in ('group_phase','initial','group_qualification','knockout'));

-- 2. Seed v1 rules.
insert into public.scoring_rules (tournament_id, version, rules, active)
select
  t.id,
  1,
  jsonb_build_object(
    'version', 1,
    'match', jsonb_build_object(
      'correct_outcome_90', 5,
      'exact_score_90', 10,
      'home_goals_distance', jsonb_build_object('0', 3, '1', 2, '2', 1),
      'away_goals_distance', jsonb_build_object('0', 3, '1', 2, '2', 1),
      'goal_difference_exact', 3
    ),
    'knockout', jsonb_build_object(
      'correct_extra_time', 5,
      'correct_penalties', 5,
      'correct_qualified_team', 8
    ),
    'stage_multipliers', jsonb_build_object(
      'group_stage', 1,
      'round_of_32', 2,
      'round_of_16', 2,
      'quarter_final', 2,
      'third_place', 2,
      'semi_final', 3,
      'final', 5
    ),
    'initial_predictions', jsonb_build_object(
      'champion', 200,
      'runner_up', 150,
      'top_scorer', 100,
      'best_player', 100
    ),
    'group_qualification', jsonb_build_object('team_correct', 5)
  ),
  true
from public.tournaments t
where t.slug = 'wc_2022_test'
on conflict (tournament_id, version) do nothing;
```

Verificación del nombre exacto del constraint (en local antes de
ejecutar la migración):

```bash
PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres \
  -c "\d public.prediction_scores"
```

Si el constraint no se llama exactamente
`prediction_scores_prediction_type_check`, ajustar el `drop constraint`.

Aplicación: `npx supabase migration up --local`, luego `npm run
types:gen` (los tipos sí cambian aquí: el enum de `prediction_type`
en `database.types.ts` se actualiza con `group_phase`) + prettier.
Push a prod **tras tu OK** con `echo y | npx supabase db push --linked`.

---

## 6. Verificación (en lugar de tests)

Sin Vitest (D11-4). La verificación se hace con cálculo a mano + psql
+ smoke en navegador. Casos de referencia para casar contra la BD tras
ejecutar el orquestador:

### 6.1 Casos de cálculo a mano · grupos (`prediction_type='group_phase'`)

Multiplicador 1.0. Regla: si `exact_score` aplica, NO se cobran
`home/away_goals_distance` NI `goal_difference_exact` (D11-1).

- Pred 2-1 vs real 2-1 → outcome 5 + exact 10 = **15** (dh/da/diff
  suprimidas por acierto exacto).
- Pred 3-1 vs real 2-1 → outcome 5 + dh=1 (2) + da=0 (3) + diff_exact
  NO (real diff=1, pred diff=2) = **10**.
- Pred 1-1 vs real 2-1 → outcome NO (empate vs local) + dh=1 (2) + da=0
  (3) + diff_exact NO (real 1, pred 0) = **5**.
- Pred 0-3 vs real 2-1 → **0**.
- Pred 1-1 vs real 1-1 → outcome 5 + exact 10 = **15**.
- Pred 3-2 vs real 2-1 (acierto sin exact con cercanía y diff): outcome
  5 + dh=1 (2) + da=1 (2) + diff_exact 3 = **12**. ⚠ Confirma el techo
  sin exact: 12 < 15 (exact) ✓.

### 6.2 Casos de cálculo a mano · eliminatoria (r16, multiplicador 2)

Máximo absoluto teórico de un partido de r16 (acierto total con exact):
outcome 5 + exact 10 + et 5 + pen 5 + qual 8 = **33** subtotal × 2 =
**66**. (Acierto exacto suprime dh/da/diff_exact.)

- Decidido en 90'. Pred 1-0 + et=false + pen=false + qual=home,
  real 1-0 + et=false + pen=false + qual=home → 33 × 2 = **66**.
- Empate 90' + prórroga + penaltis. Pred 1-1 + et=true + pen=true +
  qual=A, real 1-1 + et=true + pen=true + qual=A → 33 × 2 = **66**.
- Empate 90' SIN penaltis (decidido en prórroga). Pred 1-1 + et=true +
  pen=false + qual=B, real 1-1 + et=true + pen=false + qual=B → 33 ×
  2 = **66**.
- Acertaste exacto+et+pen pero fallaste qualified. Pred 1-1 + et=true
  + pen=false + qual=A, real 1-1 + et=true + pen=false + qual=B →
  outcome 5 + exact 10 + et 5 + pen 5 = **25** × 2 = **50**.

Aplicado a otras rondas (mismo subtotal 33 si acierto total con exact):
r32 = 66 · cuartos = 66 · tercer puesto = 66 · semis = 99 · final = 165.

### 6.3 Casos de cálculo a mano · initial (`prediction_type='initial'`)

- Sin final confirmada → 0 pts (no se inserta fila).
- Acierta campeón y subcampeón → 200 + 150 = **350**.
- Acierta solo campeón → **200**.
- Acierta solo subcampeón → **150**.
- Pred campeón=X subcampeón=Y, real campeón=Y subcampeón=X → **0**
  (las posiciones cuentan).
- Pichichi (100 pts) / mejor jugador (100 pts): **NO** los calcula el
  motor del hito 11. Quedan para hito 14 (admin los asigna a mano al
  cerrar el torneo, comparando los textos libres con el pichichi y
  mejor jugador oficiales).

### 6.4 Casos de cálculo a mano · group_qualification

Tabla de Grupo A de Catar 2022 (verificable en psql):
- NED 7 pts (G2 E1 P0, +5 -1), SEN 6 (2-0-1, +5 -4), ECU 4 (1-1-1,
  +4 -3), QAT 0 (0-0-3, +1 -7).
- Top 2 = NED, SEN.

Casos por usuario:
- Pred {NED, SEN} → 5 + 5 = **10**.
- Pred {NED, ECU} → **5**.
- Pred {ECU, QAT} → **0**.
- Grupo con menos de 6 fixtures confirmados → no se inserta fila.

### 6.5 Smoke en navegador

1. `make fecha FECHA=` (volver a fecha real, sin lock simulado).
2. Confirmar que la migración aplicó y hay 1 fila en `scoring_rules`.
3. Abrir `/admin/results`, ir a una ronda con resultados, pulsar
   "🎲 Generar resultados aleatorios" → debe disparar el recálculo.
4. Verificar en psql:
   - `select prediction_type, count(*), sum(points_total) from
     prediction_scores group by 1`.
   - Cuadrar el total de algún usuario con cálculo a mano de 2-3
     partidos.

---

## 7. Plan de ejecución (orden de commits)

Cada paso es un commit. Push a master tras cada uno (no PR).

1. **Plan + guía + bitácora inicial.** Este fichero +
   `documentation/user_guides/puntuacion.md` (con dos secciones grupos
   / eliminatoria + máximos) + abrir
   `context/implementations/11-scoring-engine-implementation.md`.
   Commit: `docs: hito 11 plan + scoring user guide`.

2. **Migración: CHECK rename + seed `scoring_rules`.** Aplicar local;
   types:gen + prettier (sí hay diff: enum de `prediction_type`).
   Verificar con psql. Push a prod **tras tu OK**.
   Commit: `feat(db): rename prediction_type and seed scoring_rules v1`.

3. **Funciones puras de scoring.**
   `src/lib/scoring/{types,rules,scoreMatch,scoreInitial,scoreGroup,applyMultiplier}.ts`.
   typecheck/lint/format/build verdes.
   Commit: `feat(scoring): pure scoring functions for match/initial/group`.

4. **Orquestador `recalculateTournamentScores`.** Sustituir el stub.
   typecheck/lint/format/build verdes.
   Commit: `feat(scoring): wire recalculateTournamentScores orchestrator`.

5. **Smoke local.** `/admin/results` → "Generar resultados aleatorios"
   → comprobar en psql que `prediction_scores` se rellena y casa con
   los cálculos a mano de §6. Anotar en bitácora. (Si hay bug, fix con
   `fix(scoring): …`.)

6. **Cierre.** Bitácora cerrada; bootstrap del hito 12.
   Commit: `docs: close hito 11`.

---

## 8. Riesgos y mitigaciones

- **Ambigüedad de FKs en JOIN de `fixtures`**: `home_team_id` y
  `away_team_id` apuntan ambos a `teams`. La sintaxis
  `teams!fixtures_home_team_id_fkey` exige el nombre exacto del FK,
  que `types:gen` documenta. Si me da problemas, hago dos queries
  separadas y monto el mapeo en JS (más simple, mismo rendimiento a
  10 usuarios).
- **Volumen de inserts**: ~10 usuarios × 64 partidos = 640 filas
  por recálculo. Supabase JS acepta arrays grandes sin problema.
- **Reglas faltantes en DB**: fallback a `DEFAULT_SCORING_RULES_V1` en
  el orquestador. Si pasara en prod sería un bug, pero el sistema
  sigue funcionando y los puntos serían los esperados (porque el
  fallback es el mismo objeto que el seed).
- **Empates en la tabla de grupo más allá de pts/GD/GF**: tiebreak
  determinista por código de equipo asc. Aceptable como porra; FIFA
  usaría h2h. Lo documentamos como limitación conocida.
- **Recálculo concurrente**: `confirmMatchResult` y
  `generateRandomResults` pueden dispararse a la vez. Es muy poco
  probable en una porra de 10 amigos con un solo admin; si pasa, el
  "último gana" porque cada recálculo borra e inserta. No me preocupo.
- **Final con `qualified_team_id`**: ya verificado en local que la
  fila r16 confirmada tiene `qualified_team_id` siempre. El motor
  asume que cualquier knockout `confirmed` lo trae no-null. Si
  encuentro alguna NULL, defensivo: skip qual+et+pen del breakdown.

---

## 9. Acceptance del hito 11

- `npm run typecheck && npm run lint && npm run format:check && npm
  run build` verdes.
- Migración aplicada local Y prod.
- Tras pulsar "Confirmar y recalcular" o "Generar resultados
  aleatorios" en `/admin/results`, la tabla `prediction_scores` queda
  poblada con filas para cada `(user, fixture)` con resultado
  confirmed (`group_phase` / `knockout`), más una fila `initial` por
  usuario (si la final está confirmed) y filas `group_qualification`
  por (user, group) cuando el grupo tenga sus 6 partidos confirmed.
- Cálculo a mano de 5-10 partidos representativos casa con lo
  insertado (referencia: §6.1 y §6.2).
- Guía `documentation/user_guides/puntuacion.md` consistente con los
  valores del seed.
- Bitácora `11-scoring-engine-implementation.md` cerrada con
  decisiones, desviaciones y commits.

---

## 10. Lo que no se hace en este hito

- Editor de reglas (hito 14).
- Leaderboards / desgloses / gráfico de evolución (hito 12).
- Scoring de pichichi / mejor jugador (texto libre — hito 14, lo hace
  el admin manualmente al final del torneo).
- Snapshots de leaderboard (`leaderboard_snapshots`) — se ven en
  hito 12.
- UX de la guía de puntuación con pestañas + tooltip "i" por partido +
  gráfico de barras horizontales (ver §12) → hito 12/13.
- Optimización: siempre se recalcula todo el torneo.

---

## 11. Decisiones aprobadas (consolidadas)

| ID    | Decisión |
|-------|----------|
| D11-1 | Valores v1: `correct_extra_time=5`, `correct_penalties=5`, `correct_qualified_team=8`. Iniciales: `champion=200`, `runner_up=150`, `top_scorer=100`, `best_player=100` (los dos últimos los asigna el admin manualmente en hito 14, ver D11-3). **`exact_score_90` suprime `home/away_goals_distance` Y `goal_difference_exact`** (los 3 miden la misma señal). Sin exact, max de cercanía+diff = 7 → exact (10) siempre vale más. Multiplicadores **enteros** (r32/r16/cuartos/tercero = x2, semis = x3, final = x5) → todos los máximos por ronda son enteros: 15 (grupos), 66 (r32/r16/cuartos/tercero), 99 (semis), 165 (final). Sincronizado con `puntuacion.md`. |
| D11-2 | `prediction_type` = **`group_phase`** (grupos) y **`knockout`** (eliminatoria). Requiere ALTER del CHECK en la migración. |
| D11-3 | Scope: dentro grupos + eliminatorias + champion/runner_up + gqp. Fuera pichichi/mejor jugador (hito 14, manual). |
| D11-4 | **NO** Vitest, **NO** tests automatizados. Verificación = cálculo a mano + smoke. |
| D11-5 | Tabla: pts → DG → GF → team_code asc. Top 2 directos. En 2026, además, 8 mejores terceros (tabla global de terceros con mismo criterio). En 2022: solo top 2 (8 grupos × 2 = 16 a R16). El algoritmo deriva el modo del calendario (existencia de fixtures `r32`: 2026 sí, 2022 no). |
| D11-6 | `createAdminClient()` (service role) en el orquestador. |
| D11-7 | Delete + bulk insert sin transacción explícita. Volumen minúsculo. |
| D11-8 | `third` (tercer puesto) se scorea como cualquier knockout con multiplicador 2.0 (mismo que cuartos, para mantener máximo entero 66). NO cuenta para campeón/subcampeón. |

---

## 12. UX futura — anotada para hito 12/13

El usuario quiere estas piezas de UX que **no entran en hito 11**
pero conviene tenerlas registradas para no perderlas:

### 12.1 Guía pública con dos pestañas

Página accesible para todos los usuarios (probablemente `/reglas` o
`/puntuacion`). Dos pestañas:

1. **Partido de fase de grupos.** Ejemplo completo con tabla
   "criterio · resultado · puntos" como la del final de
   `documentation/user_guides/puntuacion.md`. Indicar el **máximo
   posible** del partido (15 pts × 1 = 15, con la regla de que
   exact_score suprime dh/da/diff).
2. **Partido de eliminatoria.** Varios sub-ejemplos:
   - Decidido en 90'.
   - Empate 90' + prórroga sin penaltis.
   - Empate 90' + prórroga + penaltis.
   - Acierto parcial (outcome OK pero qualified fallado).

   Para cada sub-ejemplo, su tabla de breakdown. Indicar el **máximo
   posible** del partido aplicando el multiplicador (r32/r16/cuartos/
   tercero: 33 × 2 = 66; semis: 33 × 3 = 99; final: 33 × 5 = 165 —
   todos enteros). Incluir explicación de los puntos por prórroga,
   penaltis y equipo que pasa, y dejar claro que acertar el resultado
   exacto absorbe la cercanía por equipo Y la diferencia de goles.

### 12.2 Tooltip "i" por partido en la vista de predicciones jugadas

En cada partido ya jugado de la página de predicciones del usuario
(`/predictions/matches`, `/my-scores`, donde aplique), junto al total
de puntos, un icono **i** que abre un popup/tooltip con la tabla de
breakdown del partido del usuario: criterio · resultado · puntos.
Datos vienen de `prediction_scores.points_breakdown` (que el motor del
hito 11 ya rellena).

### 12.3 Gráfico de barras horizontales por partido

En la página personal de puntuaciones (`/my-scores`), una barra
horizontal por cada partido con resultado confirmado: longitud =
`points_total / max_possible` del partido. Permite ver de un vistazo
qué partidos acertó mucho el usuario y cuáles falló. Implementación
candidata: Recharts (`BarChart` horizontal) o div + width%.

`max_possible` se deriva en JS de las reglas activas y el stage del
partido (no se guarda en DB).

---

## 13. Próximo paso

Plan aprobado por el usuario (D11-1..D11-8 + UX anotada). Cuando me
diga "adelante", empiezo por el commit 1 (este plan + guía actualizada
+ bitácora) y voy en orden.

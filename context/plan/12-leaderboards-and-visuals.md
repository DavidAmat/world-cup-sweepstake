# Hito 12 — Leaderboards, evolución y desglose por partido

> Plan detallado del hito 12. Lo escribo en paralelo a la bitácora
> (`context/implementations/12-leaderboards-and-visuals-implementation.md`).

---

## 1. Objetivo

Cualquier usuario autenticado puede ver:

1. **Clasificación general** del torneo (todos los participantes, puntos
   totales).
2. **Comparativas**:
   - Por **jornada** (round): qué sacó cada usuario en cada jornada y
     acumulado.
   - Por **fase** (stage): grupos / dieciseisavos / octavos / cuartos /
     tercer puesto / semifinales / final.
   - Por **categoría** (qué tipo de predicción aporta a su total).
   - Por **partido concreto**: lo que predijo cada participante y los
     puntos que sacó en ese partido + breakdown.
3. **Evolución** por jornada (gráfico).
4. **Vista personal** `/my-scores` con barras horizontales por partido
   (= `points_total / max_possible`) y breakdown.
5. **Tooltip "ⓘ"** en cada partido bloqueado o jugado dentro de
   `/predictions/matches`, con la tabla de breakdown del usuario.

UI 100% en español. Datos vía cliente de usuario (RLS lo permite, ver
§3 del bootstrap).

---

## 2. Estado actual (verificado)

- `prediction_scores` tiene **229 filas** en local tras `npm run
  scoring:smoke`. Distribución:
  - `group_phase`: 144 filas (707 pts).
  - `knockout`: 64 filas (2009 pts).
  - `initial`: 1 fila (200 pts).
  - `group_qualification`: 20 filas (105 pts).
- 3 perfiles: David1 (admin), David2, David3. David3 no tiene scores
  (sin predicciones todavía → caso "0 puntos").
- `points_breakdown` ya lleva `_subtotal`, `_multiplier` y, para
  group_qualification, `_group`. Resto de claves: ver §1 del bootstrap.
- RLS de `prediction_scores`: `SELECT` libre para `authenticated`.
- `leaderboard_snapshots` existe pero queda **vacía**: con 10 usuarios
  × ~104 fixtures las agregaciones on-the-fly son baratas.

---

## 3. Decisiones técnicas

1. **No nuevas dependencias.** Gráficos en HTML+CSS (barras) y SVG
   inline en server component (evolución). Sin Recharts.
2. **Sin vistas SQL ni migraciones nuevas.** Toda la lógica en JS sobre
   las filas que devuelve Supabase. Pivotaje en TS.
3. **Cliente de usuario** (`createClient()` server-side), no admin.
4. **`max_possible` por partido** se deriva en JS de las reglas activas
   y el stage. Helper en `src/lib/scoring/maxPoints.ts`.
5. **Categorías** para el desglose, derivadas del breakdown:
   - **Resultados de partido** (suma de `correct_outcome_90 +
     exact_score_90 + home_goals_distance + away_goals_distance +
     goal_difference_exact`, sin multiplicar).
   - **Cercanía de goles** (solo `home_goals_distance +
     away_goals_distance`).
   - **Resultado exacto** (`exact_score_90`).
   - **Eliminatorias extra** (`correct_extra_time + correct_penalties +
     correct_qualified_team`).
   - **Predicciones iniciales** (`champion + runner_up`; futuros
     `top_scorer + best_player` cuando los meta el admin).
   - **Clasificados de grupo** (`team_correct`).
   - El multiplicador se aplica fila a fila: cada categoría agrega
     `(subkey × _multiplier)` cuando aplica.
6. **Tooltip "ⓘ"** sólo en partidos con scoring confirmado (existe fila
   en `prediction_scores`). Si el fixture está locked sin resultado
   confirmado, el icono no aparece todavía.
7. **Bottom destacado** = último usuario por puntos totales. Si hay
   empate en la cola, se destacan todos los empatados.

---

## 4. Rutas y archivos

Rutas nuevas (todas server components salvo el popover del tooltip):

```
/clasificacion                              → ranking general + tabs
/clasificacion/jornada/[roundCode]          → comparativa por jornada
/clasificacion/fase/[stageCode]             → comparativa por fase
/clasificacion/partido/[fixtureId]          → comparativa por partido
/clasificacion/evolucion                    → gráfico acumulado
/my-scores                                  → vista personal
```

Estructura física:

```
src/lib/scoring/
  maxPoints.ts            ← max_possible por stage + por partido
  breakdownLabels.ts      ← labels en español + orden de criterios
  leaderboard.ts          ← agregaciones reutilizables (queries + group-by)

src/components/scoring/
  BreakdownTable.tsx      ← tabla criterio · resultado · puntos (server)
  BreakdownPopover.tsx    ← cliente: abre/cierra al click en ⓘ
  PointsBar.tsx           ← barra horizontal CSS (server)
  EvolutionChart.tsx      ← SVG inline (server)

src/app/(app)/clasificacion/
  page.tsx                              ← /clasificacion (general + tabs)
  jornada/[roundCode]/page.tsx
  fase/[stageCode]/page.tsx
  partido/[fixtureId]/page.tsx
  evolucion/page.tsx
  Tabs.tsx                              ← navegación entre secciones (link puro)

src/app/(app)/my-scores/
  page.tsx
```

Updates:

- `src/components/layout/Header.tsx` → enlace a `Clasificación` y
  `Mi puntuación`.
- `src/app/(app)/dashboard/page.tsx` → tarjetas con accesos directos
  a `/clasificacion` y `/my-scores`.
- `src/app/(app)/predictions/matches/MatchesForm.tsx` → si `f.locked`
  y existe `prediction_scores`, renderizar el icono **ⓘ** junto al
  badge "Bloqueado", con `BreakdownPopover`.

---

## 5. Algoritmos

### 5.1 Leaderboard general

```ts
// pseudo
rows = supabase.prediction_scores.select(user_id, points_total).eq(tournament_id);
profiles = supabase.profiles.select(user_id, display_name, initials);
profilesAll = profiles                           // incluye a quienes no han puntuado
totals = groupBy(rows, user_id) → sum(points_total)
ranking = profilesAll.map(p => ({...p, total: totals.get(p.user_id) ?? 0}))
       .sort(desc total, asc display_name)
```

Top = ranking[0]; bottom = todos los empatados al peor total. Empates
mantienen la misma posición visual ("=").

### 5.2 Por jornada

```ts
// queries
fixtures = supabase.fixtures.select(id, round_id).eq(tournament_id);
rounds   = supabase.rounds.select(id, code, name, sort_order).eq(tournament_id);
scores   = supabase.prediction_scores.select(user_id, fixture_id, points_total, prediction_type)
                                   .eq(tournament_id);

// pivot
pointsByUserRound = Map<user, Map<roundCode, number>>;
for s in scores:
  if s.prediction_type === "group_phase" || s.prediction_type === "knockout":
    add(pointsByUserRound, s.user_id, roundOf(s.fixture_id), s.points_total)
```

Se pinta tabla con usuarios como filas y rondas como columnas, +
columna "Total partidos" (que es la suma de todas las rondas) y +
columna "Total general" (incluyendo initial + group_qualification).

Sólo cuenta rondas con al menos un partido con `match_result`
confirmado (= alguna fila en `prediction_scores` con ese round). Para
el resto, columna gris "—".

### 5.3 Por fase

Igual a 5.2 pero el pivote es por `stage_code`. Filas con
`prediction_type ∈ {group_phase, knockout}`.

### 5.4 Por categoría

Iteramos `prediction_scores` y, según `prediction_type` y las claves
del breakdown, repartimos el `points_total` en buckets:

- **Resultados de partido** (group_phase + knockout):
  `correct_outcome_90 + exact_score_90 + home_goals_distance +
  away_goals_distance + goal_difference_exact` (todos × `_multiplier`).
- **Eliminatorias extra**: `correct_extra_time + correct_penalties +
  correct_qualified_team` (× `_multiplier`).
- **Predicciones iniciales**: `champion + runner_up`.
- **Clasificados de grupo**: `team_correct`.

(Nota: el motor del hito 11 desactiva `home_goals_distance/away/diff`
cuando hay `exact_score_90`. Por tanto la suma de categorías cuadra
con `points_total` salvo redondeos numéricos.)

### 5.5 Comparativa por partido

```ts
fixture       = supabase.fixtures.select(...).eq(id, fixtureId).single();
result        = supabase.match_results.select(...).eq(fixture_id).eq(status='confirmed');
predictions   = supabase.match_predictions.select(...).eq(fixture_id);
scoresForFx   = supabase.prediction_scores.select(...).eq(fixture_id);
profiles      = supabase.profiles.select(...);
```

Render: cabecera con el resultado real, tabla por usuario con
`predicción · puntos · breakdown` (cada fila con su propio
`BreakdownPopover`).

### 5.6 Evolución (SVG inline)

```ts
acumulado[user][round_sort_order] = sum(points_total) over scores with round.sort_order ≤ N
```

Gráfico: eje X = sort_order, eje Y = acumulado; una polilínea por
usuario + un círculo con iniciales en el último punto conocido.
Implementado como SVG inline (un solo `<svg>` server-rendered, sin
JS).

### 5.7 Vista personal `/my-scores`

- Cards de **totales por categoría** (las 4 categorías de 5.4) en la
  parte superior, con el total general en grande.
- Barras horizontales por partido con resultado confirmado:
  - X: 0 → `max_possible(stage)`.
  - Fill: `points_total`.
  - Etiqueta: "España 2 - Inglaterra 1 · 33/66" + ⓘ.
- Ordenadas por `sort_order` de la ronda (cronológico).

`max_possible` por stage (de `documentation/user_guides/puntuacion.md`):

```ts
group_stage   → 15
round_of_32   → 66
round_of_16   → 66
quarter_final → 66
third_place   → 66
semi_final    → 99
final         → 165
```

(Para `group_qualification` el "máximo" del slot es 5; para `initial`
campeón=200, subcampeón=150; no se grafican como barras de partido,
sólo agregadas.)

---

## 6. UX y navegación

- Header gana dos enlaces nuevos: "Clasificación" → `/clasificacion`,
  "Mi puntuación" → `/my-scores`. Caben sin reflow.
- Dashboard añade 2 tarjetas (Clasificación, Mi puntuación) al grid.
- Página `/clasificacion`:
  - Header con tabs (links): General · Por jornada · Por fase · Por
    categoría · Evolución.
  - "General" muestra el podio (top destacado verde, bottom rosa).
  - Cada tab apunta a `/clasificacion[/jornada|fase|categoria|evolucion]`
    o renderiza secciones inline cuando no haya parámetros (preferido
    para minimizar rutas dinámicas — ver §4).
- `/clasificacion/partido/[fixtureId]` se enlaza desde:
  - El tooltip de partido en `/my-scores`.
  - Cada fila de "Por jornada" → click en la cabecera del partido.
  - Cada fixture en `/predictions/matches/public` (icono "🏆 ver
    puntos") cuando hay scoring.

---

## 7. Verificación

Sin tests automatizados. Voy a verificar:

1. **psql**: cuadrar totales (suma global, por usuario, por categoría)
   contra `prediction_scores`.
2. `npm run typecheck && npm run lint && npm run format:check && npm
   run build`.
3. Visualmente queda al usuario (el agente no testea la UI).

Comandos de cuadre (los lanza el agente al final):

```sql
-- Totales por usuario (debe coincidir con la columna "Total" del leaderboard)
select p.display_name, sum(s.points_total) as total
from prediction_scores s
join profiles p on p.user_id = s.user_id
join tournaments t on t.id = s.tournament_id
where t.slug = 'wc_2026'
group by p.display_name
order by total desc;

-- Totales por usuario y prediction_type
select p.display_name, s.prediction_type, sum(s.points_total)
from prediction_scores s
join profiles p on p.user_id = s.user_id
join tournaments t on t.id = s.tournament_id
where t.slug = 'wc_2026'
group by p.display_name, s.prediction_type
order by p.display_name, s.prediction_type;
```

---

## 8. Plan de ejecución (orden de commits)

1. Plan + bitácora (este fichero + el log inicial).
2. Helpers de scoring: `maxPoints.ts`, `breakdownLabels.ts`,
   `leaderboard.ts`. Sin UI todavía.
3. Componentes: `BreakdownTable`, `BreakdownPopover`, `PointsBar`,
   `EvolutionChart`.
4. `/clasificacion` (general + secciones inline para jornada/fase/
   categoría).
5. `/clasificacion/partido/[fixtureId]`.
6. `/clasificacion/evolucion`.
7. `/my-scores`.
8. Tooltip "ⓘ" en `MatchesForm`.
9. Navegación: Header + dashboard.
10. Verificación SQL + typecheck/lint/build + push a master.

(El usuario pidió commit+push final al terminar todo el hito.)

---

## 9. Riesgos

- **`points_total` es `numeric(8,2)`** → llega como `string` de
  Supabase. Convertir con `Number()`/`parseFloat()`.
- **Profiles sin scores** (David3) → tienen que aparecer en
  leaderboard con 0 puntos.
- **Rondas todavía con placeholders "TBD"** (R16, QF, SF, third,
  final) → no aparecerán en las columnas hasta que se generen sus
  resultados.
- **Multiplicador en el breakdown**: las claves "individuales" del
  breakdown ya están **sin multiplicar** (son subtotales por
  criterio); el motor sólo aplica el multiplicador a `points_total`
  via `total = subtotal × multiplier`. Hay que recordarlo en
  `BreakdownTable`: cada fila muestra el valor base + nota con el
  multiplicador y el total al pie.

---

## 10. Out of scope (queda para 13+)

- `/resultados` público y stats por selección → hito 13.
- Reset y editor de reglas → hito 14.
- Diseño visual final + paleta de colores → hito 15.

---

## 11. Próximo paso

Implementación. Ya no espero aprobación (orden directa del usuario:
"Implementa y haz commit+push al final"). Bitácora se va llenando en
paralelo.

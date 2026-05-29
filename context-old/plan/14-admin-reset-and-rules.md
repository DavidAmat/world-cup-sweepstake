# Hito 14 — Admin: reset y reglas

Referencia de alto nivel: `context/plan/01-plan.md` §"Hito 14".
Bitácora paralela: `context/implementations/14-admin-reset-and-rules-implementation.md`.

---

## Alcance

Dos páginas nuevas bajo `/admin/*`:

1. `/admin/reset` — borrar datos de un torneo con confirmación literal "BORRAR".
2. `/admin/reglas` — versionar, editar y activar reglas de puntuación.

Ambas ya quedan cubiertas por el gate de `proxy.ts` (redirige a login / dashboard según rol). No se añade `requireAdmin()` en la página server, pero sí en cada server action.

---

## Archivos a crear / modificar

```
src/app/admin/reset/
  page.tsx          ← server component
  actions.ts        ← server actions (resetTournamentData)
  ResetModal.tsx    ← client component (modal + input "BORRAR")

src/app/admin/reglas/
  page.tsx          ← server component
  actions.ts        ← server actions (duplicate, saveDraft, activate, recalculate)
  RulesEditor.tsx   ← client component (form con inputs numéricos)

src/app/admin/page.tsx   ← añadir 2 tarjetas nuevas (reset + reglas)
```

---

## 1 · `/admin/reset`

### page.tsx

Server component. Carga:

- `tournaments` ordenados por `name` (para el dropdown).
- El torneo por defecto (`getDefaultTournament()`).

Renderiza:

```
<h1>Reset de datos de torneo</h1>
<p>Descripción de riesgo / qué no se borra (master data, reglas).</p>

<form> <!-- GET, no action -->
  <select name="tournament">...</select>  ← dropdown de torneos
</form>

Checkboxes (con nombres descriptivos en español):
  □ Predicciones iniciales (initial_predictions)
  □ Predicciones de partido (match_predictions)
  □ Clasificados de grupo (group_qualification_predictions)
  □ Resultados de partidos (match_results + match_goals)
  □ Puntuaciones calculadas (prediction_scores)
  □ Snapshots de leaderboard (leaderboard_snapshots)

<button> Restablecer datos seleccionados → abre ResetModal </button>
```

El estado del modal (abierto/cerrado + lista de tablas seleccionadas) vive en el client component `ResetModal` que envuelve los checkboxes y el botón.

### ResetModal.tsx (client)

Props:
- `tournamentId: string`
- `tournamentName: string`

Internamente:
- `useState` para el texto del input.
- El botón "Confirmar reset" queda `disabled` hasta que `input.value === 'BORRAR'`.
- Al submit, llama la server action `resetTournamentData` vía `<form action={resetTournamentData}>`.
- Los checkboxes son `<input type="checkbox" name="tables[]" value="...">` dentro del form.

Modal: `position: fixed`, `z-50`, overlay semitransparente. Sin librerías externas — `createPortal` como en `BreakdownPopover` si hay riesgo de `overflow-hidden`. En `/admin/reset` no hay ancestros con overflow oculto; se puede usar CSS normal.

### actions.ts — `resetTournamentData(formData)`

```ts
"use server";
export async function resetTournamentData(formData: FormData) {
  const { supabase } = await requireAdmin();  // admin client
  
  const confirmText = formData.get("confirm")?.toString();
  if (confirmText !== "BORRAR") throw new Error("Confirmación incorrecta");
  
  const tournamentId = formData.get("tournament_id")?.toString();
  if (!tournamentId) throw new Error("tournament_id requerido");
  
  const tables = formData.getAll("tables[]").map(String);
  
  // Orden de borrado para respetar FKs:
  // 1. prediction_scores (FK → prediction_type, fixture_id, user_id)
  // 2. leaderboard_snapshots (FK → tournament_id, user_id, round_id)
  // 3. match_goals (FK → match_results via fixture_id + tournament_id)
  // 4. match_results (FK → fixtures)
  // 5. match_predictions (FK → fixtures, users)
  // 6. initial_predictions (FK → tournaments, users)
  // 7. group_qualification_predictions (FK → tournaments, users, teams)

  const ORDER = [
    "prediction_scores",
    "leaderboard_snapshots",
    "match_goals",
    "match_results",
    "match_predictions",
    "initial_predictions",
    "group_qualification_predictions",
  ];

  // mapping: checkbox value → tabla(s) a borrar
  const TABLE_MAP: Record<string, string[]> = {
    initial_predictions:               ["initial_predictions"],
    match_predictions:                 ["match_predictions"],
    group_qualification_predictions:   ["group_qualification_predictions"],
    match_results:                     ["match_goals", "match_results"],
    prediction_scores:                 ["prediction_scores"],
    leaderboard_snapshots:             ["leaderboard_snapshots"],
  };

  const toDelete = new Set<string>();
  for (const t of tables) TABLE_MAP[t]?.forEach(t2 => toDelete.add(t2));
  
  for (const table of ORDER) {
    if (!toDelete.has(table)) continue;
    await supabase.from(table as any).delete().eq("tournament_id", tournamentId);
  }

  revalidatePath("/clasificacion", "layout");
  revalidatePath("/my-scores");
  revalidatePath("/predictions", "layout");
  revalidatePath("/admin/results");
  revalidatePath("/admin/reset");

  redirect("/admin/reset?ok=reset&tournament=" + tournamentId);
}
```

**Nota sobre match_goals**: la tabla tiene FK a `match_results` implícita por `fixture_id + tournament_id`, así que se borra antes. Si tiene `ON DELETE CASCADE` desde `match_results`, no haría falta borrarla explícitamente si borramos results, pero lo hacemos igualmente por consistencia.

---

## 2 · `/admin/reglas`

### page.tsx

Server component. Carga:

- Torneo por defecto (`getDefaultTournament()`).
- Todas las `scoring_rules` del torneo, ordenadas `version desc`.

Renderiza lista de tarjetas: una por versión.

Cada tarjeta muestra:
- `v{version}` + badge "Activa" (verde) / "Borrador" (zinc).
- Fecha de creación formateada.
- Botón "Duplicar y editar" → server action, redirect con `?editing={newId}`.
- Si `active = false`: botón "Activar esta versión" → server action.
- Si es la versión activa: botón "Recalcular ahora" → server action.
- Botón "Editar borrador" (solo si `active = false`) → abre `RulesEditor` inline.

El parámetro `?editing={id}` controla qué fila tiene el editor expandido (server-side, no estado cliente).

### RulesEditor.tsx (client)

Props:
- `ruleId: string`
- `defaultValues: ScoringRulesV1`

Form con inputs numéricos agrupados en secciones colapsables o directamente visibles:

**Sección "Partido (90')"**
| Campo | Input |
|-------|-------|
| Resultado correcto a 90' | `correct_outcome_90` |
| Marcador exacto a 90' | `exact_score_90` |
| Distancia goles local (0/1/2) | 3 inputs |
| Distancia goles visitante (0/1/2) | 3 inputs |
| Diferencia de goles exacta | `goal_difference_exact` |

**Sección "Eliminatorias"**
| correct_extra_time | correct_penalties | correct_qualified_team |

**Sección "Multiplicadores por fase"**
7 inputs (uno por stage: group_stage, round_of_32, round_of_16, quarter_final, semi_final, third_place, final).

**Sección "Predicciones iniciales"**
champion / runner_up / top_scorer / best_player

**Sección "Clasificados de grupo"**
team_correct

Validación cliente con Zod (mismo shape `ScoringRulesV1`). Botón "Guardar borrador" (disabled si `active`).

### actions.ts

```ts
"use server";

// Crea nueva fila copiando JSON del origen, version+1, active=false
export async function duplicateScoringRules(formData: FormData) { ... }

// Actualiza el JSON de una fila con active=false (no toca la activa)
export async function saveScoringRulesDraft(formData: FormData) { ... }

// Pone active=true en la fila elegida, active=false en el resto del torneo
// Transaccional: update all false primero, luego update target true
export async function activateScoringRules(formData: FormData) { ... }

// Llama recalculateTournamentScores del wrapper de recalculate.ts
export async function recalculateScoringRules(formData: FormData) { ... }
```

`activateScoringRules` no tiene una RPC transaccional — usa el admin client y ejecuta:
1. `update scoring_rules set active=false where tournament_id=? and id != ?`
2. `update scoring_rules set active=true where id=?`

Si falla el paso 2 (improbable), la BD queda sin versión activa. El motor tiene fallback a `DEFAULT_SCORING_RULES_V1` en `recalculateCore.ts`. Riesgo asumible sin necesitar RPC extra.

---

## 3 · `/admin/page.tsx` — tarjetas nuevas

Reemplazar el bloque "Próximamente" por dos tarjetas reales:
- **Reset de datos** → `/admin/reset` — descripción breve.
- **Reglas de puntuación** → `/admin/reglas` — descripción breve.

---

## Acceptance

1. Reset borra solo las tablas marcadas del torneo elegido y deja intactas las del otro torneo (verificar con psql antes y después).
2. Crear versión nueva de reglas con `correct_outcome_90 = 7` → activar → recalcular → `prediction_scores` sube coherentemente (verificar SQL).
3. Literal "BORRAR" es obligatorio: el botón submit permanece deshabilitado hasta que el input sea exacto. La server action verifica de nuevo.

---

## Notas de implementación

- El admin client (`src/lib/supabase/admin.ts`) bypasa RLS, necesario para borrar filas de otros usuarios.
- No hay migración nueva: `scoring_rules` ya tiene `id, tournament_id, version, active, rules, created_at, updated_at`.
- `revalidatePath("/clasificacion", "layout")` revalida todas las sub-rutas de `/clasificacion/*`.
- Commit separado por `/admin/reset` y `/admin/reglas`.

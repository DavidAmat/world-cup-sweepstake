# 10 — Admin: introducción de resultados

> Estado: **PENDIENTE DE APROBACIÓN**
> Bootstrap: `context/plan/08-bootstrap-prompt.md`

---

## 1. Decisiones (D10-x)

**D10-1: Sin migración.**
Las tablas `match_results`, `match_goals` y `player_match_stats` ya existen
(migración `20260508164810`) con la estructura correcta. El hito 10 no añade
columnas ni constraints.

Resumen de los CHECK relevantes:
- `match_results_check`: `went_extra_time=true ↔ home/away_goals_120 NOT NULL`
- `match_results_check1`: `went_penalties=true → went_extra_time=true AND penalty_winner_team_id NOT NULL`
- `match_goals_period_check`: period ∈ {first_half, second_half, extra_time_first,
  extra_time_second, unknown} (nullable)
- `match_goals_minute_check`: minute ∈ [0, 130] (nullable)

**D10-2: Dos rutas admin.**
- `/admin/results` — listado de fixtures por ronda con estado del resultado.
- `/admin/results/[fixtureId]` — formulario de resultado por fixture.

**D10-3: Modo lectura cuando confirmed.**
Si `result_status = 'confirmed'` y la URL no lleva `?edit=1`, la página
`/admin/results/[fixtureId]` renderiza en modo solo lectura (resumen del
marcador + lista de goles). Un botón "Editar resultado" añade `?edit=1` como
searchParam (link simple, no acción). No hay redirect. Patrón del hito 09.

**D10-4: Client component `ResultForm.tsx`.**
El formulario dinámico (añadir/quitar goles, toggle prórroga/penaltis) requiere
un client component. Precedente: `MatchesForm.tsx` (hito 09) e
`ImportClient.tsx` (hito 07). El server component carga datos y pasa props;
las server actions viven en `actions.ts`.

**D10-5: Campos del formulario de resultado.**
- Sección "90'": `home_goals_90`, `away_goals_90` (number inputs, min 0).
- Solo en knockout: checkbox `went_extra_time`.
  - Si ET: inputs `home_goals_120`, `away_goals_120` + checkbox `went_penalties`.
  - Si penalties: select `penalty_winner_team_id` (opciones: equipo local / visitante).
- `winner_team_id` y `qualified_team_id` se derivan **server-side** en la
  action, no los introduce el admin:
  - Con penaltis: `winner = penalty_winner_team_id`
  - Sin penaltis, con ET: `winner = equipo con más goles a 120'` (null si empate,
    caso imposible en fútbol real pero no rechazado)
  - Sin ET: `winner = equipo con más goles a 90'` (null si empate en grupos; en
    knockout el empate a 90' debe llevar a ET, pero no se fuerza aquí — el admin
    sabe lo que hace)
  - `qualified_team_id = winner_team_id` para knockouts, null para grupos.

**D10-6: Gestión de goles (replace total).**
En cada guardado (draft o confirmed) la action hace:
1. `DELETE FROM match_goals WHERE fixture_id = ?`
2. `INSERT` de los goles nuevos.

Los goles se envían serializados en un hidden field `goals_json` (JSON array).
Estructura de cada gol:
```ts
{
  team_id: string;           // UUID del equipo (home o away)
  player_id: string | null;  // UUID del jugador; null = sin asignar
  minute: number | null;     // 0-130
  period: string | null;     // enum o null → 'unknown' en DB
  own_goal: boolean;
  penalty_goal: boolean;
}
```
Los goles son opcionales (se puede confirmar sin anotar ninguno).

**D10-7: `player_match_stats` fuera de scope.**
No se rellena en el hito 10. Progresiva, no bloquea el scoring.

**D10-8: Service role en admin actions.**
Las actions usan `createAdminClient()` (service role) para bypass de RLS.
`requireAdmin()` se llama primero para obtener `userId` (usado en `created_by`).

**D10-9: Stub de recálculo.**
`src/lib/scoring/recalculate.ts` → función vacía, llamada solo desde
`confirmMatchResult`. El motor real es el hito 11.

**D10-10: Dos server actions.**
- `saveMatchResult(formData)` — `requireAdmin`, upsert `match_results` con
  `result_status='draft'`, replace `match_goals`. No llama al stub.
- `confirmMatchResult(formData)` — igual pero `result_status='confirmed'`, luego
  llama a `recalculateTournamentScores(tournament_id)`.

Ambas redirigen a `/admin/results/[fixtureId]?ok=saved|confirmed` o
`?error=<msg>`.

**D10-11: Navegación.**
`src/app/admin/page.tsx` — añadir tarjeta-link "Resultados" → `/admin/results`.
No se modifica `Header.tsx` (la sección admin se navega desde `/admin`).

---

## 2. Archivos a crear / modificar

### Nuevos
```
src/lib/scoring/
  recalculate.ts                    ← stub vacío

src/app/admin/results/
  page.tsx                          ← listado por ronda
  actions.ts                        ← saveMatchResult, confirmMatchResult
  schemas.ts                        ← Zod

src/app/admin/results/[fixtureId]/
  page.tsx                          ← server component: carga datos
  ResultForm.tsx                    ← client component: form dinámico
```

### Modificados
```
src/app/admin/page.tsx              ← añadir tarjeta "Resultados"
```

---

## 3. Pasos de implementación

### Paso 1 — Back-end: stub + schemas + actions

**1a.** `src/lib/scoring/recalculate.ts` — stub vacío.

**1b.** `src/app/admin/results/schemas.ts` — Zod:
- `GoalSchema` → valida un gol (team_id uuid, player_id uuid|null, minute
  int|null, period enum|null, own_goal bool, penalty_goal bool).
- `MatchResultPayloadSchema` → valida el payload completo con `superRefine`
  que espeja los dos CHECK de `match_results`.
- Helper `readResultPayload(formData)` → coerce FormData a tipos y parse.

**1c.** `src/app/admin/results/actions.ts` — `saveMatchResult` y
`confirmMatchResult` (delegan en `persistResult(formData, status)`).

### Paso 2 — Listado `/admin/results`

`src/app/admin/results/page.tsx`:
- `requireAdmin()` + `getDefaultTournament()`.
- Query fixtures con join a rounds, stages, home/away teams y LEFT JOIN a
  `match_results` (para obtener `result_status` y marcador si existe).
- Dropdown de ronda por `?round=<code>` (GET form); default = primera ronda.
- Tabla: partido (home vs away), kickoff Madrid, badge estado resultado
  (sin resultado / borrador / confirmado), marcador si existe, link
  "Introducir/Ver resultado".
- Badge de estado usa el `Badge` existente: zinc → "Sin resultado", amber →
  "Borrador", emerald → "Confirmado".

### Paso 3 — Formulario `/admin/results/[fixtureId]`

**`page.tsx`** (server component):
- `requireAdmin()`.
- Carga fixture con stage/round/home_team/away_team. Si fixture sin dos
  equipos → mensaje "Partido sin equipos asignados aún".
- Carga `match_results` y `match_goals` existentes (pueden ser null/[]).
- Carga jugadores del equipo local y visitante.
- Si `result_status='confirmed'` y `searchParams.edit !== '1'`: render
  read-only (resumen de marcador + lista de goles + botón "Editar resultado").
- En caso contrario: render `<ResultForm>` con props.

**`ResultForm.tsx`** (`"use client"`):

Props:
```ts
type Props = {
  fixture: { id, is_knockout, home_goals_90?... }; // meta del fixture
  homeTeam: { id, code, display_name };
  awayTeam: { id, code, display_name };
  homePlayers: { id, display_name }[];
  awayPlayers: { id, display_name }[];
  existingResult: MatchResult | null;
  existingGoals: Goal[];
};
```

Estado interno: `goals: GoalEntry[]`, `wentET: boolean`, `wentPen: boolean`.

UI:
1. Sección "Resultado a 90'": dos number inputs (min=0).
2. Si is_knockout:
   - Checkbox "¿Fue a prórroga?" → `wentET`.
   - Si `wentET`: dos number inputs 120' + checkbox "¿Fueron a penaltis?" →
     `wentPen`.
   - Si `wentPen`: select "Equipo que ganó en penaltis" (home / away).
3. Sección "Goles" (siempre visible):
   - Lista de filas; cada fila: select equipo (home/away) → filtra el select
     de jugador; input minuto; select período; checkboxes own_goal / penalty_goal;
     botón "✕" remove.
   - Botón "Añadir gol".
4. Hidden fields: `fixture_id`, `home_team_id`, `away_team_id`, `is_knockout`,
   `went_extra_time` (value "1" si wentET), `went_penalties` (value "1" si
   wentPen), `goals_json`.
5. Dos botones con `formAction`:
   - "Guardar borrador" → `saveMatchResult`
   - "Confirmar y recalcular" → `confirmMatchResult`

> Nota: `went_extra_time` y `went_penalties` se envían como hidden inputs cuando
> son true (igual que el patrón de hito 09 con disabled checkboxes), para
> garantizar que el server recibe el valor correcto incluso si el checkbox
> no se envía cuando unchecked.

### Paso 4 — Admin hub y verificación final

- `admin/page.tsx`: añadir tarjeta "Resultados".
- `npm run typecheck && npm run lint && npm run format:check && npm run build`.

### Paso 5 — Smoke + push

- Smoke local:
  1. Navegar a `/admin/results` → ver fixtures con "Sin resultado".
  2. Entrar en un fixture de grupos → rellenar 2-1 + añadir 3 goles → "Guardar
     borrador" → badge "Borrador" en el listado.
  3. "Confirmar y recalcular" → modo lectura.
  4. "Editar resultado" → formulario de nuevo → cambiar marcador → guardar borrador
     → re-confirmar.
  5. (Opcional) fixture de eliminatorias local: probar ET + penaltis.
- Push directo a master.

---

## 4. Esqueletos de código representativos

### `recalculate.ts`
```ts
// stub — hito 11 implementará el motor real
export async function recalculateTournamentScores(_tournamentId: string): Promise<void> {}
```

### `schemas.ts` (extracto)
```ts
import { z } from "zod";

const PERIODS = ["first_half", "second_half", "extra_time_first", "extra_time_second", "unknown"] as const;

export const GoalSchema = z.object({
  team_id: z.string().uuid(),
  player_id: z.string().uuid().nullable(),
  minute: z.number().int().min(0).max(130).nullable(),
  period: z.enum(PERIODS).nullable(),
  own_goal: z.boolean(),
  penalty_goal: z.boolean(),
});

export const MatchResultPayloadSchema = z
  .object({
    fixture_id: z.string().uuid(),
    home_team_id: z.string().uuid(),
    away_team_id: z.string().uuid(),
    is_knockout: z.boolean(),
    home_goals_90: z.number().int().min(0),
    away_goals_90: z.number().int().min(0),
    went_extra_time: z.boolean(),
    home_goals_120: z.number().int().min(0).nullable(),
    away_goals_120: z.number().int().min(0).nullable(),
    went_penalties: z.boolean(),
    penalty_winner_team_id: z.string().uuid().nullable(),
    goals: z.array(GoalSchema),
  })
  .superRefine((d, ctx) => {
    if (d.went_extra_time && (d.home_goals_120 == null || d.away_goals_120 == null))
      ctx.addIssue({ code: "custom", message: "Con prórroga debes introducir los goles a 120'" });
    if (!d.went_extra_time && (d.home_goals_120 != null || d.away_goals_120 != null))
      ctx.addIssue({ code: "custom", message: "Sin prórroga no puede haber goles a 120'" });
    if (d.went_penalties && !d.went_extra_time)
      ctx.addIssue({ code: "custom", message: "No puede haber penaltis sin prórroga" });
    if (d.went_penalties && !d.penalty_winner_team_id)
      ctx.addIssue({ code: "custom", message: "Con penaltis debes indicar el equipo ganador" });
    if (!d.went_penalties && d.penalty_winner_team_id != null)
      ctx.addIssue({ code: "custom", message: "Sin penaltis no puede haber ganador por penaltis" });
  });
```

### `actions.ts` (esqueleto)
```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { recalculateTournamentScores } from "@/lib/scoring/recalculate";
import { MatchResultPayloadSchema } from "./schemas";

const SELF = (id: string) => `/admin/results/${id}`;

async function persistResult(formData: FormData, status: "draft" | "confirmed") {
  const { user } = await requireAdmin();
  const supabase = createAdminClient();
  const tournament = await getDefaultTournament();

  const fixtureId = formData.get("fixture_id") as string;
  const raw = {
    fixture_id: fixtureId,
    home_team_id: formData.get("home_team_id") as string,
    away_team_id: formData.get("away_team_id") as string,
    is_knockout: formData.get("is_knockout") === "1",
    home_goals_90: Number(formData.get("home_goals_90") ?? NaN),
    away_goals_90: Number(formData.get("away_goals_90") ?? NaN),
    went_extra_time: formData.get("went_extra_time") === "1",
    home_goals_120: formData.get("home_goals_120") !== "" && formData.get("home_goals_120") != null
      ? Number(formData.get("home_goals_120")) : null,
    away_goals_120: formData.get("away_goals_120") !== "" && formData.get("away_goals_120") != null
      ? Number(formData.get("away_goals_120")) : null,
    went_penalties: formData.get("went_penalties") === "1",
    penalty_winner_team_id: (formData.get("penalty_winner_team_id") as string) || null,
    goals: JSON.parse((formData.get("goals_json") as string) ?? "[]"),
  };

  const parsed = MatchResultPayloadSchema.safeParse(raw);
  if (!parsed.success)
    redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(parsed.error.errors[0].message)}`);

  const d = parsed.data;

  // Derive winner and qualified
  let winnerTeamId: string | null = null;
  if (d.went_penalties) {
    winnerTeamId = d.penalty_winner_team_id;
  } else if (d.went_extra_time) {
    if (d.home_goals_120! > d.away_goals_120!) winnerTeamId = d.home_team_id;
    else if (d.away_goals_120! > d.home_goals_120!) winnerTeamId = d.away_team_id;
  } else {
    if (d.home_goals_90 > d.away_goals_90) winnerTeamId = d.home_team_id;
    else if (d.away_goals_90 > d.home_goals_90) winnerTeamId = d.away_team_id;
  }
  const qualifiedTeamId = d.is_knockout ? winnerTeamId : null;

  const { error: resErr } = await supabase.from("match_results").upsert(
    {
      tournament_id: tournament.id,
      fixture_id: d.fixture_id,
      home_goals_90: d.home_goals_90,
      away_goals_90: d.away_goals_90,
      went_extra_time: d.went_extra_time,
      home_goals_120: d.home_goals_120,
      away_goals_120: d.away_goals_120,
      went_penalties: d.went_penalties,
      penalty_winner_team_id: d.penalty_winner_team_id,
      winner_team_id: winnerTeamId,
      qualified_team_id: qualifiedTeamId,
      result_status: status,
      created_by: user.id,
    },
    { onConflict: "fixture_id" },
  );
  if (resErr) redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(resErr.message)}`);

  // Replace goals
  await supabase.from("match_goals").delete().eq("fixture_id", fixtureId);
  if (d.goals.length > 0) {
    const goalRows = d.goals.map((g) => ({
      tournament_id: tournament.id,
      fixture_id: d.fixture_id,
      team_id: g.team_id,
      player_id: g.player_id,
      minute: g.minute,
      period: g.period ?? "unknown",
      own_goal: g.own_goal,
      penalty_goal: g.penalty_goal,
    }));
    const { error: goalsErr } = await supabase.from("match_goals").insert(goalRows);
    if (goalsErr) redirect(`${SELF(fixtureId)}?error=${encodeURIComponent(goalsErr.message)}`);
  }

  if (status === "confirmed") await recalculateTournamentScores(tournament.id);

  revalidatePath("/admin/results");
  revalidatePath(SELF(fixtureId));
  redirect(`${SELF(fixtureId)}?ok=${status}`);
}

export async function saveMatchResult(formData: FormData) {
  await persistResult(formData, "draft");
}

export async function confirmMatchResult(formData: FormData) {
  await persistResult(formData, "confirmed");
}
```

---

## 5. Criterios de aceptación

1. El admin puede navegar a `/admin/results`, ver fixtures de una jornada con
   su estado (sin resultado / borrador / confirmado) y cambiar de jornada con
   el dropdown.
2. Entrando en un fixture de grupos: rellenar 2-1 + añadir goles → "Guardar
   borrador" persiste con `result_status='draft'` y redirige al formulario
   con banner de éxito.
3. "Confirmar y recalcular" persiste con `result_status='confirmed'` → la
   página muestra vista solo lectura.
4. "Editar resultado" abre de nuevo el formulario editable.
5. En un fixture de eliminatorias local: probar prórroga + penaltis.
6. El listado `/admin/results` refleja el estado actualizado (badge correcto).
7. `typecheck` / `lint` / `format:check` / `build` verdes.
8. Sin migración nueva.

---

## 6. Fuera de scope

- Motor de puntuación (hito 11).
- Página pública de resultados `/results` (hito 13).
- `player_match_stats` (hito 13+).
- Reset de datos (hito 14).

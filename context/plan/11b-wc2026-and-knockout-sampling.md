# 11.5 — Migrar a `wc_2026` + generador de cruces eliminatorios · plan detallado

> Hito intermedio entre 11 (motor) y 12 (leaderboards). El usuario lo
> pidió tras detectar que el dropdown de rondas en `/admin/results`
> empieza en octavos (el torneo de prueba era 2022, sin R32).
> Bitácora paralela:
> `context/implementations/11b-wc2026-and-knockout-sampling-implementation.md`.

## 1. Objetivo

Dejar de usar `wc_2022_test` y arrancar con el calendario real del
Mundial **2026** (48 equipos en 12 grupos, primera ronda eliminatoria
= **R32**, dieciseisavos). Añadir un botón en cada ronda eliminatoria
de `/admin/results` que genera los cruces emparejando equipos al azar
(sin continuidad real entre rondas), para agilizar el testing.

Esto NO cambia el motor de scoring del hito 11 — el orquestador ya
está preparado para R32 (`hasR32` en `recalculateCore.ts`). Solo:

- Cambia los datos sembrados (torneo, equipos, fixtures, stages,
  rounds).
- Añade una server action + un botón en la UI admin.

## 2. Decisiones aprobadas por el usuario

| ID    | Decisión |
|-------|----------|
| D11b-1 | **Equipos**: los 48 que dio el usuario, distribuidos en grupos A–L (cuatro por grupo). Códigos FIFA estándar; nombres en español ("México", "Países Bajos", "República Democrática del Congo"…). |
| D11b-2 | **Calendario de grupos**: J1=29-may-2026, J2=03-jun-2026, J3=10-jun-2026. Todos los partidos de una jornada caen el mismo día a 18:00 Madrid. Pares de cada jornada por la fórmula estándar FIFA: J1 (1-2, 3-4), J2 (1-3, 4-2), J3 (4-1, 2-3) donde el subíndice es la posición del equipo en la lista del grupo. |
| D11b-3 | **Calendario de eliminatorias**: R32=20-jun, R16=24-jun, QF=28-jun, SF=30-jun, 3rd-place y Final=01-jul. Todos a 18:00 Madrid. Sin equipos asignados (placeholders `"TBD"`). |
| D11b-4 | **Borrar `wc_2022_test`** local Y prod (CASCADE). Sin backup; los smokes se reproducen en `wc_2026`. |
| D11b-5 | **Botón "Generar cruces (esta ronda)"** visible en cada ronda eliminatoria (R32, R16, QF, SF, 3rd, Final). Cada pulsación re-emparejea ESA ronda, sample sin reposición entre los 48 equipos. Botón global de "Generar todo el bracket" NO entra en este hito. |
| D11b-6 | **`is_test=true`** para `wc_2026` por ahora. Lo cambiaremos a `false` cuando empiece la porra real. |

### Detalles que decido yo (corrígeme si discrepas)

- **Hora de los partidos**: 18:00 hora de Madrid para todos los
  fixtures (consistente con el hito 06).
- **Códigos FIFA**: tres letras, mayúsculas. La tabla `teams` usa
  `citext`, así que MEX = mex; lo guardo en mayúsculas por consistencia.
- **Confederación**: no la guardo en la BD (la tabla `teams` no tiene
  ese campo). Si en el futuro hace falta, ya se añadirá.
- **`group_qualifiers_per_group`**: 2 (igual que 2022). En 2026 además
  pasan los 8 mejores terceros, pero esa lógica vive en
  `recalculateCore` y no en este campo.
- **Catálogo `src/lib/fixtures/catalogs.ts`**: añado `round_of_32` /
  `r32` al hardcode. Actualizo `score_multiplier` de los stages para
  que coincidan con el JSON v1 (1, 2, 2, 2, 3, 2, 5). El comentario
  ya dice que el motor manda; el catálogo es para el admin/seeder.
- **`points_breakdown` y `prediction_scores`**: se borrarán de local
  al hacer CASCADE de `wc_2022_test`. Tras subir `wc_2026`, no habrá
  predicciones todavía (el flujo "predicción → confirmar → recalcular"
  arranca desde cero). El smoke se hace con
  `generateRandomMatchPredictions` para usuarios test + admin
  confirma resultados + ver scores.

## 3. Distribución de equipos por grupo

Tal cual lo dio el usuario:

| Grupo | 1 | 2 | 3 | 4 | Códigos FIFA |
|-------|---|---|---|---|--------------|
| A | México | Sudáfrica | Corea del Sur | Chequia | MEX, RSA, KOR, CZE |
| B | Canadá | Bosnia y Herzegovina | Catar | Suiza | CAN, BIH, QAT, SUI |
| C | Brasil | Marruecos | Haití | Escocia | BRA, MAR, HAI, SCO |
| D | Estados Unidos | Paraguay | Australia | Turquía | USA, PAR, AUS, TUR |
| E | Alemania | Curazao | Costa de Marfil | Ecuador | GER, CUW, CIV, ECU |
| F | Países Bajos | Japón | Suecia | Túnez | NED, JPN, SWE, TUN |
| G | Bélgica | Egipto | Irán | Nueva Zelanda | BEL, EGY, IRN, NZL |
| H | España | Cabo Verde | Arabia Saudí | Uruguay | ESP, CPV, KSA, URU |
| I | Francia | Senegal | Irak | Noruega | FRA, SEN, IRQ, NOR |
| J | Argentina | Argelia | Austria | Jordania | ARG, ALG, AUT, JOR |
| K | Portugal | República Democrática del Congo | Uzbekistán | Colombia | POR, COD, UZB, COL |
| L | Inglaterra | Croacia | Ghana | Panamá | ENG, CRO, GHA, PAN |

**Códigos FIFA elegidos cuando hay ambigüedad:**

- Costa de Marfil → CIV (no IVC).
- Catar → QAT.
- Curazao → CUW.
- República Democrática del Congo → COD.
- Cabo Verde → CPV.
- Bosnia y Herzegovina → BIH.
- Argelia → ALG (no DZA — código olímpico; FIFA usa ALG).
- Países Bajos → NED.
- Sudáfrica → RSA.

Si alguno de estos códigos no te gusta, dilo antes de la migración.

### Pares por jornada (formato canónico)

Sea cada grupo G = [T1, T2, T3, T4]:

- **Jornada 1**: `T1 vs T2`, `T3 vs T4`
- **Jornada 2**: `T1 vs T3`, `T4 vs T2`
- **Jornada 3**: `T4 vs T1`, `T2 vs T3`

Cada equipo juega exactamente 3 veces (uno por jornada). Esto sigue
el patrón FIFA estándar.

## 4. Calendario de fixtures

72 partidos de grupos:

- **J1 — 29-mayo-2026 18:00 Madrid** · 24 partidos (2 por grupo × 12).
- **J2 — 03-junio-2026 18:00 Madrid** · 24 partidos.
- **J3 — 10-junio-2026 18:00 Madrid** · 24 partidos.

32 fixtures eliminatorias (con placeholders `"TBD"`):

- **R32 — 20-junio-2026 18:00** · 16 fixtures.
- **R16 — 24-junio-2026 18:00** · 8 fixtures.
- **QF — 28-junio-2026 18:00** · 4 fixtures.
- **SF — 30-junio-2026 18:00** · 2 fixtures.
- **3rd Place — 01-julio-2026 18:00** · 1 fixture.
- **Final — 01-julio-2026 18:00** · 1 fixture.

**Total: 104 fixtures.**

> El CHECK de `fixtures` exige `home_team_id IS NOT NULL OR
> home_placeholder IS NOT NULL` (lo mismo para away). Para las
> eliminatorias sin equipos uso `home_placeholder = "TBD"` y
> `away_placeholder = "TBD"`. Cuando el admin pulse "Generar cruces",
> la server action sobrescribe `home/away_team_id` y deja los
> placeholders intactos (no es problemático; podría limpiarlos si
> quieres). **Decisión**: los limpio (`NULL`) cuando asigno equipos,
> para que la UI no muestre "TBD vs TBD" al lado de los nombres
> reales.

## 5. Estructura de archivos

```txt
data/seeds/wc_2026/
  tournament.json                ← NUEVO
  teams.json                     ← NUEVO   (48 entradas)
  fixtures.json                  ← NUEVO   (104 entradas)

scripts/wc2026/
  upload.ts                      ← NUEVO   (mirror de scripts/wc2022/upload.ts)
  download.ts                    ← NUEVO   (mirror; útil para diff)
  lib/paths.ts                   ← NUEVO   (paths -> data/seeds/wc_2026)

src/lib/fixtures/catalogs.ts     ← MOD     +round_of_32 +r32, multipliers (1,2,2,2,3,2,5)

src/app/admin/results/
  page.tsx                       ← MOD     (botón "Generar cruces" en knockouts)
  actions.ts                     ← MOD     (server action generateKnockoutPairings)

src/lib/scoring/recalculateCore.ts  ← MOD  (comentario "wc_2022_test" → "wc_2026")
scripts/scoring/smoke-recalc.ts  ← MOD     (fallback slug)
.env.local                       ← MOD     (slug -> wc_2026)
```

### Vercel

`NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2026` en
`Production`/`Preview`/`Development`. Lo cambias tú tras el OK (el
agente no toca la consola de Vercel; lo dejo como instrucción).

## 6. Diseño detallado

### 6.1 Catálogo `src/lib/fixtures/catalogs.ts`

```ts
export const STAGES = [
  { code: "group_stage",   name: "Fase de grupos",          sort_order: 1, score_multiplier: 1.0 },
  { code: "round_of_32",   name: "Dieciseisavos de final",  sort_order: 2, score_multiplier: 2.0 },
  { code: "round_of_16",   name: "Octavos de final",        sort_order: 3, score_multiplier: 2.0 },
  { code: "quarter_final", name: "Cuartos de final",        sort_order: 4, score_multiplier: 2.0 },
  { code: "semi_final",    name: "Semifinales",             sort_order: 5, score_multiplier: 3.0 },
  { code: "third_place",   name: "Tercer y cuarto puesto",  sort_order: 6, score_multiplier: 2.0 },
  { code: "final",         name: "Final",                   sort_order: 7, score_multiplier: 5.0 },
] as const;

export const ROUNDS = [
  { code: "group_md1", name: "Jornada 1",                stage_code: "group_stage",   sort_order: 1 },
  { code: "group_md2", name: "Jornada 2",                stage_code: "group_stage",   sort_order: 2 },
  { code: "group_md3", name: "Jornada 3",                stage_code: "group_stage",   sort_order: 3 },
  { code: "r32",       name: "Dieciseisavos de final",   stage_code: "round_of_32",   sort_order: 4 },
  { code: "r16",       name: "Octavos de final",         stage_code: "round_of_16",   sort_order: 5 },
  { code: "qf",        name: "Cuartos de final",         stage_code: "quarter_final", sort_order: 6 },
  { code: "sf",        name: "Semifinales",              stage_code: "semi_final",    sort_order: 7 },
  { code: "third",     name: "Tercer puesto",            stage_code: "third_place",   sort_order: 8 },
  { code: "final",     name: "Final",                    stage_code: "final",         sort_order: 9 },
] as const;
```

Notas:

- `score_multiplier` ahora coincide con el JSON de `scoring_rules`.
  Cualquier herramienta admin que lo muestre verá los valores
  correctos. El motor de scoring sigue leyendo de `scoring_rules`
  (autoridad final), pero al menos la BD y el código no se
  contradicen.
- Las migraciones del hito 06 que usan `STAGES` siguen funcionando:
  `upsertStages` itera el array y `INSERT … ON CONFLICT DO UPDATE`
  por `(tournament_id, code)`. Para `wc_2022_test` (si se mantuviera)
  añadiría una fila nueva `round_of_32`. **Pero vamos a borrar
  wc_2022_test antes**, así que ese caso no se da.

### 6.2 Seeds JSON

`tournament.json`:

```json
{
  "slug": "wc_2026",
  "name": "Mundial Norteamérica 2026",
  "year": 2026,
  "status": "active",
  "is_test": true,
  "predictions_open_until": null,
  "group_qualifiers_per_group": 2
}
```

`teams.json`: 48 entradas con la misma estructura que wc_2022:

```json
{
  "external_id": "wc2026_team_mex",
  "code": "MEX",
  "canonical_name": "México",
  "display_name": "México",
  "aliases": ["México", "Mexico", "MEX"],
  "group_code": "A"
}
```

`fixtures.json` usa el "Python format" que el script `wc2022:upload`
ya entiende (lo lee con `PythonMatchesSchema`):

```json
{
  "external_id": "wc2026_md1_a_mex_rsa",
  "stage_code": "group_stage",
  "round_code": "group_md1",
  "group_code": "A",
  "home_team": "México",
  "away_team": "Sudáfrica",
  "kickoff_at_madrid": "2026-05-29T18:00",
  "venue": null
}
```

Para los partidos eliminatorios uso placeholders en lugar de `home_team`/`away_team`:

```json
{
  "external_id": "wc2026_r32_01",
  "stage_code": "round_of_32",
  "round_code": "r32",
  "group_code": null,
  "home_placeholder": "TBD",
  "away_placeholder": "TBD",
  "kickoff_at_madrid": "2026-06-20T18:00",
  "venue": null
}
```

**Verificación previa**: confirmar que `PythonMatchesSchema` acepta
`home_placeholder`/`away_placeholder` y que `upsertFixtures` los
inserta. Si no, **extiendo el schema y el upsert** (cambio acotado,
una clave nueva).

### 6.3 Script `scripts/wc2026/upload.ts`

Copia literal del de wc_2022 con `PATHS` apuntando a
`data/seeds/wc_2026/`. La `lib/` (`schemas`, `env`, `supabase`,
`upserts`, `log`) se reutiliza tal cual.

Si el formato de placeholders requiere extender `upsertFixtures`,
hago el cambio en `scripts/wc2022/lib/upserts.ts` (compartido) — pero
de forma backwards-compatible.

**`package.json`**: añadir `wc2026:upload` y `wc2026:download`.

### 6.4 Borrado de `wc_2022_test`

```sql
delete from tournaments where slug = 'wc_2022_test';
```

CASCADE limpia: `teams`, `stages`, `rounds`, `fixtures`,
`match_results`, `match_goals`, `match_predictions`,
`initial_predictions`, `group_qualification_predictions`,
`scoring_rules`, `prediction_scores`,
`leaderboard_snapshots`. **Ejecuto en local primero**, verifico
`select count(*) from tournaments` = 0. Luego prod tras tu OK.

### 6.5 Server action `generateKnockoutPairings(roundCode)`

En `src/app/admin/results/actions.ts`:

```ts
"use server";

export async function generateKnockoutPairings(roundCode: string) {
  await requireAdmin();
  const supabase = await createServerClient();   // user client, RLS admin
  const tournament = await getDefaultTournament();

  // 1. fixtures de la ronda objetivo en este torneo (ordenadas por kickoff_at)
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("id, round:rounds(code)")
    .eq("tournament_id", tournament.id)
    .order("kickoff_at");
  const targetFixtures = (fixtures ?? []).filter(f => f.round.code === roundCode);
  if (targetFixtures.length === 0) {
    return { ok: false, error: `No hay fixtures para la ronda ${roundCode}` };
  }

  // 2. todos los equipos del torneo
  const { data: teams } = await supabase
    .from("teams")
    .select("id, code")
    .eq("tournament_id", tournament.id);
  if (!teams || teams.length < targetFixtures.length * 2) {
    return { ok: false, error: "No hay suficientes equipos" };
  }

  // 3. sample sin reposición usando Math.random (server action,
  //    NO server component — no aplica react-hooks/purity)
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, targetFixtures.length * 2);

  // 4. UPDATE por fixture
  const updates = targetFixtures.map((fx, i) => ({
    id: fx.id,
    home_team_id: picked[2 * i].id,
    away_team_id: picked[2 * i + 1].id,
    home_placeholder: null,
    away_placeholder: null,
  }));

  // Bulk upsert por id; PostgREST no permite UPDATE con array,
  // así que vamos por Promise.all de updates individuales.
  // Volumen: máx 16 (R32) → trivial.
  const errors = [];
  for (const u of updates) {
    const { error } = await supabase
      .from("fixtures")
      .update({
        home_team_id: u.home_team_id,
        away_team_id: u.away_team_id,
        home_placeholder: u.home_placeholder,
        away_placeholder: u.away_placeholder,
      })
      .eq("id", u.id);
    if (error) errors.push(error.message);
  }
  if (errors.length > 0) return { ok: false, error: errors.join("; ") };

  revalidatePath("/admin/results");
  return { ok: true, paired: targetFixtures.length };
}
```

Notas:

- **No** dispara el recálculo de scoring (los partidos siguen sin
  resultado).
- **No** toca match_results, match_predictions ni prediction_scores.
- Si la ronda ya tenía equipos asignados, los sobrescribe — eso es
  exactamente lo que pides para regenerar.
- **CONSIDERACIÓN**: si las predicciones ya existen para esa ronda
  (`match_predictions` apuntando a esos fixture_id), quedarían con
  `predicted_qualified_team_id` apuntando a un equipo viejo. Plan:
  borrar también las predicciones de partido de los fixtures de esa
  ronda antes de re-emparejar.
  - **Decisión**: sí, borro `match_predictions` y `match_results` de
    los fixtures de la ronda al regenerar cruces. Esto se documenta
    en el botón ("regenerar reinicia predicciones y resultados de
    esta ronda"). Si la ronda no tenía nada, el borrado es no-op.
  - Si el recálculo de scoring ya había corrido, el orquestador en
    su próxima invocación recalculará desde cero como siempre.

### 6.6 Botón en `/admin/results`

En el listado de ronda, añadir junto al botón "🎲 Generar resultados
aleatorios" otro:

```tsx
{isKnockoutRound && (
  <form action={generateKnockoutPairings.bind(null, roundCode)}>
    <button type="submit"
      className="..."
      onClick={confirm("Esto reasignará equipos a esta ronda y borrará las predicciones y resultados existentes de esta ronda. ¿Continuar?")}>
      🎲 Generar cruces (esta ronda)
    </button>
  </form>
)}
```

(El `confirm` es client-side; uso un `<ConfirmButton>` como el patrón
existente — verificarlo en el código de hito 10. Si no existe,
implemento inline con `useState`/portal o uso `onSubmit={(e) =>
{...}}`).

`isKnockoutRound = roundCode in {"r32","r16","qf","sf","third","final"}`.

### 6.7 Actualizar referencias hard-coded

- `scripts/scoring/smoke-recalc.ts` línea 21: fallback de slug a
  `"wc_2026"`.
- `src/lib/scoring/recalculateCore.ts` línea 271: comentario
  `wc_2022_test` → `wc_2026`.
- `src/app/(app)/predictions/initial/schemas.ts` línea 4: comentario
  `wc_2022_test` → `wc_2026`.

## 7. Plan de ejecución (commits)

1. **Plan + bitácora**. Este fichero + bitácora vacía.
   `docs: hito 11b plan + logbook`.

2. **Catálogo actualizado** (`catalogs.ts` con R32 y multipliers
   alineados al JSON). Build/typecheck/lint/format verdes.
   `feat(catalogs): add round_of_32 and align stage multipliers`.

3. **Seeds JSON de wc_2026** (tournament.json, teams.json,
   fixtures.json). Sin upload todavía.
   `feat(seeds): wc_2026 tournament, teams, fixtures`.

4. **Script `wc2026:upload` + extensión de schema** (si placeholders
   no estaban soportados). Probarlo en local.
   `feat(scripts): wc2026 upload script + placeholder support`.

5. **Borrar wc_2022_test local**. Verificar con psql.
   No es commit (es operación BD).

6. **Subir wc_2026 a local** con `npm run wc2026:upload`. Verificar
   en psql: 1 torneo, 48 teams, 7 stages, 9 rounds, 104 fixtures.
   No es commit (operación BD).

7. **Cambiar default slug** en `.env.local` (no se commitea — está
   en .gitignore) y actualizar fallbacks/comentarios.
   `chore(scoring): switch default tournament to wc_2026`.

8. **Server action `generateKnockoutPairings` + botón en UI**.
   typecheck/lint/format/build verdes.
   `feat(admin): generate knockout pairings button per round`.

9. **Smoke local**: pulsar "Generar cruces" en R32 → "Generar
   resultados aleatorios" en R32 → verificar `prediction_scores`.
   Repetir para R16 y final. No commit.

10. **Borrar wc_2022_test prod** (tras OK). Subir wc_2026 a prod
    (`npm run wc2026:upload -- --confirm-prod`). Cambiar slug en
    Vercel (lo haces tú; te lo recuerdo).

11. **Cierre**. Bitácora cerrada, bootstrap del hito 12 actualizado
    para reflejar wc_2026.
    `docs: close hito 11b, refresh hito 12 bootstrap`.

## 8. Riesgos y mitigaciones

- **Schema `PythonMatchesSchema` no acepta placeholders**. Mitigación:
  extiendo `home_placeholder`/`away_placeholder` como opcionales y
  exijo `(home_team XOR home_placeholder)`. Cambio acotado.
- **`upsertFixtures` falla con `homeTeam` nulo**. Mitigación: si la
  función actual asume `home_team` siempre presente, hago un fork
  defensivo y le paso `null` cuando hay placeholder. Verifico antes
  de ejecutar.
- **Predicciones existentes en local apuntando a `wc_2022_test`**: ya
  no existen tras CASCADE. Tras subir `wc_2026`, ningún usuario tiene
  predicciones; toca rellenarlas con
  `generateRandomMatchPredictions` desde
  `/predictions/matches` o llamando a la server action.
- **Vercel auto-deploy entre el push del código y la actualización
  de Vercel env var**: durante esa ventana corta, la app prod intenta
  leer `wc_2022_test` (que ya no existe) → fallo en lookups.
  Mitigación: pasos 10-12 en orden inverso. **Primero** actualizo la
  env var en Vercel, **después** subo el seed a prod, **después**
  borro el torneo viejo en prod, **último** push del código. Lo
  detallo en la bitácora cuando ejecute.
- **`is_admin()` RLS**: la server action `generateKnockoutPairings`
  usa el cliente de usuario tras `requireAdmin()`. RLS de `fixtures`
  exige admin para `update` — esto funciona porque el usuario llamando
  YA es admin. Si por algún motivo falla, se pasa al admin client.

## 9. Acceptance

- `typecheck && lint && format:check && build` verdes.
- Local: 1 torneo `wc_2026`, 48 teams, 7 stages, 9 rounds, 104
  fixtures (72 de grupos + 32 de eliminatoria con placeholders).
- Prod: ídem; `wc_2022_test` ya no existe.
- `/admin/results` dropdown muestra las 9 rondas (3 jornadas + 6
  eliminatorias incluyendo R32).
- Pulsar "Generar cruces" en cualquier ronda eliminatoria asigna
  equipos a los fixtures de esa ronda y limpia predicciones/resultados
  previos de esa ronda.
- Tras "Generar cruces" + "Generar resultados aleatorios" en R32, las
  `prediction_scores` no se modifican porque nadie tiene predicciones
  todavía (no es un bug; cuando algún usuario genere predicciones
  aleatorias en `/predictions/matches` y se confirme un resultado,
  el motor del hito 11 escribirá `prediction_scores` con
  `prediction_type='knockout'` y multiplicador R32 = 2).
- `wc_2026` aparece como default tournament en local Y prod.

## 10. Lo que NO entra

- Generar bracket completo con un solo botón (D11b-5).
- Editar el calendario desde la UI (eso lo da el panel de admin del
  hito 07 si hace falta).
- Continuidad real entre rondas (winners de R32 a R16): no, el
  usuario lo descartó explícitamente.
- Banderas en la UI: si surge la necesidad en hito 12/13.

## 11. Próximo paso

Pídeme "adelante" y empiezo por el commit 1 (plan + bitácora). Si
algún detalle de §3 (códigos FIFA o pares por jornada) no te
convence, dilo ahora — tras la subida a prod, cambiarlos requiere
re-upload.

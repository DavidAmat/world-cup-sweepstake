# 06 — Seeds e importación de master data · plan

> Hito 06 del roadmap (`01-plan.md` §7).
> Objetivo funcional: tener cargado en local **y** producción el master
> data del Mundial de Catar 2022 (`tournaments`, `teams`, `stages`,
> `rounds`, `fixtures`) **sin resultados de partidos**, listo para que
> los hitos 08–10 puedan operar.

---

## 0. Resumen ejecutivo

> **Modelo de datos**: Supabase es la única fuente de verdad de runtime.
> El JSON Python es un buffer de sync bidireccional: sirve para
> bootstrap inicial (upload) y como snapshot local que se puede
> regenerar desde la DB cuando el admin haya hecho cambios desde la web
> (download). Ver §11 para detalles.

1. Convertir el JSON Python existente
   (`data/partidos/2022/partidos_resultados_2022.json`, con resultados
   reales) en un JSON "neutro" donde **los campos de marcador, prórroga,
   penaltis y ganador se mantienen pero quedan en `null`**, y las fechas
   se rebasen a junio-julio 2026 con hora 18:00 Madrid (placeholders
   plausibles para testear el bloqueo de 24h). Esto se hace con un
   script Python pequeño y se versiona en repo.
2. Generar a mano dos JSONs canónicos de seed bajo `data/seeds/wc_2022/`:
   `tournament.json` y `teams.json`. **No habrá `fixtures.json` canónico**:
   el upload script lee directamente el JSON Python neutro y filtra por
   equipos resueltos. Esto desacopla los partidos del pipeline Python
   sin duplicar datos.
3. Implementar `scripts/wc2022/upload.ts` con `tsx` + admin client + Zod.
   Idempotente vía upsert por `external_id` / `(tournament_id, code)`.
4. Implementar `scripts/wc2022/download.ts` que regenera el JSON local
   desde Supabase (formato compatible con el upload). Esto cierra el
   loop bidireccional para cuando el admin edite cosas desde la web.
5. Validar en local con `npm run db:reset && npm run wc2022:upload` y
   probar el roundtrip (upload → modificar en Studio → download →
   diff).
6. Tras tu aprobación, ejecutar `wc2022:upload` contra producción con
   env vars inline + flag `--confirm-prod`.
7. **Sin tabla `players`**: el pichichi y el mejor jugador se
   gestionarán como texto libre en hito 08, validados manualmente por el
   admin al final del torneo. La tabla `players` queda vacía.
8. **Solo fase de grupos**: 48 fixtures iniciales. Las 16 eliminatorias
   se irán añadiendo al JSON Python por el admin (o creadas desde la UI
   admin en hito 07) conforme se conozcan los cruces. La identidad por
   `external_id` garantiza que las predicciones existentes no se rompen.

---

## 1. Lo que hay vs. lo que necesitamos

### 1.1 Pipeline Python existente

```
data/raw/
  FIFA World Cup 1930-2022 All Match Dataset.csv   ← fuente Kaggle
  team_names.py                                    ← traducción ES/aliases
  utils.py                                         ← normalización stage/grupo/winner
  analyze_results_2022.py                          ← extracción de results
  create_results_2022_json.ipynb                   ← orquestación
  resultados_2022_all.{csv,json}                   ← intermedio
data/partidos/
  fase_grupos/partidos_fase_grupos_2022.json       ← 48 partidos sin resultado, agrupados por jornada
  fase_grupos/partidos_fase_grupos_2026.json       ← 48 partidos del Mundial 2026 (no usado en este hito)
  fase_final/partidos_fase_final_2022.json         ← 16 partidos sin resultado, agrupados por fase
  2022/partidos_resultados_2022.json               ← 64 partidos CON resultados
  README.md                                        ← documenta el formato
```

### 1.2 Formato del JSON Python (validado)

Cada partido es un objeto plano. En `partidos_resultados_2022.json` (el
único que ya tiene los resultados rellenos):

```json
{
  "external_id": "wc2022_group_a_md1_001",
  "fase": "fase_grupos|octavos|cuartos|semis|tercer_puesto|final",
  "tipo_partido": "grupo|eliminatoria",
  "jornada": 1|2|3|null,
  "grupo": "A".."H"|null,
  "equipo_1": "<nombre ES>",
  "equipo_2": "<nombre ES>",
  "fecha": "2022-12-17 02:00:00",                 // hora local de Madrid, sin TZ
  "marcador_equipo_1_90_mins": int,
  "marcador_equipo_2_90_mins": int,
  "prorroga": bool,
  "penaltis": bool,
  "ganador": "<nombre ES>|empate"
}
```

Conteos verificados (`python3 -c "..."` en `data/partidos/2022/partidos_resultados_2022.json`):
- 64 partidos totales
- 48 en `fase_grupos`, 8 octavos, 4 cuartos, 2 semis, 1 tercer_puesto, 1 final
- 32 equipos únicos

### 1.3 Lo que falta y cómo lo cubrimos

| Lo que falta                                              | Cómo lo cubrimos                                                         |
|-----------------------------------------------------------|--------------------------------------------------------------------------|
| Listado canónico de los 32 equipos con grupo, código ISO  | Lo escribo a mano en `data/seeds/wc_2022/teams.json`. Datos públicos.    |
| JSON de fixtures sin resultados                           | Script Python `data/raw/strip_results_2022.py` que produce uno neutro.   |
| Catálogo de stages y rounds (6 + 8)                       | Hardcoded en el seeder TypeScript (estable y tipado).                    |
| Metadata del torneo                                       | Lo escribo a mano en `data/seeds/wc_2022/tournament.json`.               |

---

## 2. Decisiones cerradas (tras revisión)

### D1. Eliminatorias en el seed inicial → **decidido: NO insertarlas**

Decisión del autor: en 2026 ni siquiera conoceremos las fechas
exactas hasta que el sorteo final esté hecho, así que el flujo
correcto es que el admin vaya añadiendo los partidos eliminatorios al
JSON Python conforme se conozcan los cruces. Re-run del seeder los
inserta. La identidad por `external_id` garantiza que:
- Los partidos ya cargados antes (fase de grupos) no se modifican.
- Las predicciones de usuarios sobre esos partidos quedan intactas
  (ligadas por `fixture_id`, no por nombre).
- Los partidos nuevos (eliminatorias) se insertan limpiamente.

Implicación: el seeder filtra por `fase == "fase_grupos"` **únicamente
si el resto de campos no son válidos** (es decir, en realidad procesa
todo lo que venga en el JSON, pero al inicio el JSON solo trae fase de
grupos limpios). Más exacto: el seeder procesa **todos** los partidos
del JSON con `home_team_name` y `away_team_name` no nulos (los
eliminatorios sin equipo resuelto se saltan). Así el admin puede
añadir octavos al JSON cuando ya sepa "Países Bajos vs Estados Unidos"
y se cargarán automáticamente al re-ejecutar el seeder.

Conteos esperados al inicio (paso 4 del flujo):
- 1 tournament, 6 stages, 8 rounds, 32 teams, **48 fixtures**, 0
  match_results, 0 players.

### D2. Tabla `players` queda vacía

Confirmado en chat: **no se cargan jugadores**. Pichichi y mejor
jugador se manejan como texto libre en hito 08; el admin valida
manualmente al final. Implicación: las columnas
`initial_predictions.top_scorer_player_id` y `.best_player_id` quedan
como deuda técnica. En hito 08 las cambiaremos por `text` o las
ignoraremos. **Para este hito 06, las dejo como están** (son nullable,
no rompen nada).

### D3. `predictions_open_until` para el torneo de pruebas → **null**

El campo es nullable. Lo dejo en `null` por ahora. El lock de las
predicciones iniciales se decide en hito 08 (probablemente
`min(kickoff_at) - 24h` calculado on-the-fly).

### D4. `tsx` como devDependency → **sí**

Confirmado por el autor.

### D5. Cómo apuntar a producción → **inline env vars + --confirm-prod**

Confirmado por el autor:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qbphxsijmqortxhxlrnr.supabase.co \
SUPABASE_SECRET_KEY=sb_secret_xxx \
  npx tsx scripts/seed/wc-2022.ts --confirm-prod
```

El seeder rechaza cualquier URL que no sea local (`127.0.0.1`,
`192.168.0.112`, `localhost`) si no se pasa `--confirm-prod`.

---

## 3. Estructura de archivos propuesta

```
data/
  raw/
    strip_results_2022.py                          ← NUEVO. quita resultados, mantiene shape
  partidos/
    2022/
      partidos_resultados_2022.json                ← (ya existe) 64 con resultados
      partidos_2022_sin_resultados.json            ← NUEVO. output del strip script (64, todos sin resultados)
  seeds/
    wc_2022/                                       ← NUEVO. catálogos canónicos
      tournament.json                              ← metadata del torneo
      teams.json                                   ← 32 equipos con código ISO + grupo + alias

scripts/
  wc2022/                                          ← NUEVO
    upload.ts                                      ← entry point: JSON local → Supabase
    download.ts                                    ← entry point: Supabase → JSON local
    lib/
      env.ts                                       ← lee + valida env vars + flag --confirm-prod
      schemas.ts                                   ← Zod schemas (tournament/team/python-match)
      maps.ts                                      ← (fase, jornada) ↔ (stage_code, round_code)
      catalogs.ts                                  ← STAGES + ROUNDS hardcoded
      upserts.ts                                   ← funciones upsert por tabla
      paths.ts                                     ← rutas absolutas a los JSONs
      log.ts                                       ← logger con conteos

src/lib/supabase/admin.ts                          ← (ya existe, lo reutilizo tal cual)
package.json                                       ← añado scripts "wc2022:upload" / "wc2022:download", dep "tsx"
```

**No hay `data/seeds/wc_2022/fixtures.json`**: el seeder lee directamente
`data/partidos/2022/partidos_2022_sin_resultados.json` y traduce el
formato Python al formato SQL on-the-fly. Esto evita duplicar datos.

---

## 4. Detalle de cada componente

### 4.1 `data/raw/strip_results_2022.py`

Lee el JSON con resultados y produce uno con los mismos 64 objetos pero
con estos campos en `null`:

- `marcador_equipo_1_90_mins`
- `marcador_equipo_2_90_mins`
- `prorroga`
- `penaltis`
- `ganador`

El resto (`external_id`, `fase`, `tipo_partido`, `jornada`, `grupo`,
`equipo_1`, `equipo_2`, `fecha`) queda intacto. Output:
`data/partidos/2022/partidos_2022_sin_resultados.json`. Idempotente:
ejecutarlo dos veces produce el mismo fichero.

```python
# Esqueleto
NULLABLE_KEYS = ("marcador_equipo_1_90_mins", "marcador_equipo_2_90_mins",
                 "prorroga", "penaltis", "ganador")

def strip_results(records):
    out = []
    for r in records:
        copy = dict(r)
        for k in NULLABLE_KEYS:
            copy[k] = None
        out.append(copy)
    return out
```

Se ejecuta con `python data/raw/strip_results_2022.py` (no requiere
`uv`, solo stdlib). El output queda **commiteado** en el repo —
así el seeder TS no necesita Python para funcionar.

### 4.2 `data/seeds/wc_2022/tournament.json`

```json
{
  "slug": "wc_2022_test",
  "name": "Mundial Catar 2022 (test)",
  "year": 2022,
  "status": "active",
  "is_test": true,
  "predictions_open_until": null,
  "group_qualifiers_per_group": 2
}
```

(El `slug` coincide con `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG` del env.)

### 4.3 `data/seeds/wc_2022/teams.json`

Array de 32 objetos, uno por equipo, con esta forma:

```json
[
  {
    "external_id": "wc2022_team_arg",
    "code": "ARG",
    "canonical_name": "Argentina",
    "display_name": "Argentina",
    "aliases": ["Argentina", "ARG"],
    "group_code": "C"
  },
  ...
]
```

Reglas:
- `external_id`: `wc2022_team_<lowercase ISO>`. Estable e idempotente.
- `code`: ISO-3 oficial FIFA (ARG, BRA, CRO, …).
- `canonical_name`: nombre largo en español (`"Países Bajos"`,
  `"Estados Unidos"`, `"Corea del Sur"`).
- `display_name`: lo que se muestra en la UI (igual al canónico aquí).
- `aliases`: lista de variantes (en/es/abreviadas) para matching futuro.
- `group_code`: A–H.

Lista completa de los 32 equipos (la tengo, va dentro del JSON):

| Grupo | Equipos |
|-------|---------|
| A | Qatar, Ecuador, Senegal, Países Bajos |
| B | Inglaterra, Irán, Estados Unidos, Gales |
| C | Argentina, Arabia Saudí, México, Polonia |
| D | Francia, Australia, Dinamarca, Túnez |
| E | España, Costa Rica, Alemania, Japón |
| F | Bélgica, Canadá, Marruecos, Croacia |
| G | Brasil, Serbia, Suiza, Camerún |
| H | Portugal, Ghana, Uruguay, Corea del Sur |

### 4.4 Lectura del JSON Python por el seeder

El seeder lee `data/partidos/2022/partidos_2022_sin_resultados.json`
(salida del script Python) y, para cada elemento:

1. **Filtra**: descarta el partido si `home_team_name` o
   `away_team_name` no resuelven a un equipo conocido del torneo.
   En la práctica, eso significa que solo se cargan los partidos donde
   `equipo_1` y `equipo_2` están entre los 32 equipos del JSON
   `teams.json`. Los eliminatorios sin equipos resueltos quedan
   ignorados — el admin los irá llenando con nombres reales en el JSON.
2. **Traduce el formato** Python → SQL:
   - `equipo_1` → `home_team_name` (luego se resuelve a `home_team_id`)
   - `equipo_2` → `away_team_name` → `away_team_id`
   - `(fase, jornada)` → `(stage_code, round_code)` vía mapa
     (ver §4.6)
   - `grupo` → `group_code`
   - `fecha` → `kickoff_at` (con conversión de timezone, ver §4.5)
   - `external_id` → `external_id` (idempotencia)
3. **Inserta** vía upsert por `(tournament_id, external_id)`.

### 4.5 Timezones del JSON Python

Inspección de `partidos_resultados_2022.json`: el partido inaugural
Qatar–Ecuador aparece con `"fecha": "2022-11-20 02:00:00"`. El kickoff
oficial fue el **20-nov-2022 19:00 hora de Catar** (UTC+3) =
**18:00 hora de Madrid (CET, UTC+1)** = **17:00 UTC**. El campo
`02:00:00` no coincide con nada obvio.

Hipótesis: el pipeline Python lo guardó como datetime de Madrid en el
día siguiente (las 02:00 del 20-nov-2022 hora de Madrid = las 17:00 del
19-nov-2022 hora de Catar) — pero eso tampoco encaja porque el
partido fue el 20.

Acción: **verifico esto antes de seguir** ejecutando un mini-script
contra el JSON y dejaré la conclusión en la bitácora. Mientras tanto,
el seeder asume `Europe/Madrid` (CET/CEST) si no hay evidencia clara
en contra, y convierte a UTC al insertar:

```ts
import { fromZonedTime } from "date-fns-tz";   // o equivalente
const kickoffUtc = fromZonedTime(`${fecha}`, "Europe/Madrid");
```

Si tras la verificación los timestamps son obviamente erróneos (p.ej.
quedan a 02:00 UTC = 03:00 Madrid, lo que es absurdo para un partido
de mediodía), lo escalo y decidimos juntos cómo proceder antes de
sembrar producción.

### 4.5 `scripts/seed/lib/catalogs.ts`

```ts
export const STAGES = [
  { code: "group_stage",   name: "Fase de grupos",     sort_order: 1, score_multiplier: 1.0 },
  { code: "round_of_16",   name: "Octavos de final",   sort_order: 2, score_multiplier: 1.4 },
  { code: "quarter_final", name: "Cuartos de final",   sort_order: 3, score_multiplier: 1.6 },
  { code: "semi_final",    name: "Semifinales",        sort_order: 4, score_multiplier: 1.8 },
  { code: "third_place",   name: "Tercer y cuarto puesto", sort_order: 5, score_multiplier: 1.5 },
  { code: "final",         name: "Final",              sort_order: 6, score_multiplier: 2.0 },
] as const;

export const ROUNDS = [
  { code: "group_md1", name: "Jornada 1", stage_code: "group_stage",   sort_order: 1 },
  { code: "group_md2", name: "Jornada 2", stage_code: "group_stage",   sort_order: 2 },
  { code: "group_md3", name: "Jornada 3", stage_code: "group_stage",   sort_order: 3 },
  { code: "r16",       name: "Octavos de final", stage_code: "round_of_16",   sort_order: 4 },
  { code: "qf",        name: "Cuartos de final", stage_code: "quarter_final", sort_order: 5 },
  { code: "sf",        name: "Semifinales",      stage_code: "semi_final",    sort_order: 6 },
  { code: "third",     name: "Tercer puesto",    stage_code: "third_place",   sort_order: 7 },
  { code: "final",     name: "Final",            stage_code: "final",         sort_order: 8 },
] as const;
```

Los `score_multiplier` son **provisionales** y se ajustarán en hito 11.
Los pongo aquí solo para no dejar el campo en su default.

### 4.6 `scripts/seed/lib/maps.ts`

Resuelve `(fase, jornada)` del JSON Python a `(stage_code, round_code)`
del esquema SQL.

```ts
const FASE_TO_STAGE: Record<string, StageCode> = {
  fase_grupos:    "group_stage",
  octavos:        "round_of_16",
  cuartos:        "quarter_final",
  semis:          "semi_final",
  tercer_puesto:  "third_place",
  final:          "final",
};

function resolveRound(fase: string, jornada: number | null): RoundCode {
  if (fase === "fase_grupos") {
    if (jornada === 1) return "group_md1";
    if (jornada === 2) return "group_md2";
    if (jornada === 3) return "group_md3";
    throw new Error(`grupo sin jornada válida: ${jornada}`);
  }
  if (fase === "octavos") return "r16";
  if (fase === "cuartos") return "qf";
  if (fase === "semis") return "sf";
  if (fase === "tercer_puesto") return "third";
  if (fase === "final") return "final";
  throw new Error(`fase desconocida: ${fase}`);
}
```

(Cuando llegue el momento de añadir dieciseisavos para 2026, ampliamos
los mapas con `dieciseisavos → round_of_32 / r32`.)

### 4.7 `scripts/seed/lib/schemas.ts`

```ts
import { z } from "zod";

export const TournamentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string(),
  year: z.number().int(),
  status: z.enum(["draft", "active", "completed", "archived"]),
  is_test: z.boolean(),
  predictions_open_until: z.string().datetime().nullable(),
  group_qualifiers_per_group: z.number().int().min(1).max(4),
});

export const TeamSchema = z.object({
  external_id: z.string(),
  code: z.string().length(3),
  canonical_name: z.string(),
  display_name: z.string(),
  aliases: z.array(z.string()),
  group_code: z.string().regex(/^[A-H]$/),
});
export const TeamsSchema = z.array(TeamSchema).length(32);

// Schema del JSON Python (tras strip de resultados). Los campos de
// resultado son nullables pero deben existir para no perder shape.
export const PythonMatchSchema = z.object({
  external_id: z.string(),
  fase: z.enum(["fase_grupos", "octavos", "cuartos", "semis",
                "tercer_puesto", "final"]),
  tipo_partido: z.enum(["grupo", "eliminatoria"]),
  jornada: z.number().int().nullable(),
  grupo: z.string().regex(/^[A-H]$/).nullable(),
  equipo_1: z.string(),
  equipo_2: z.string(),
  fecha: z.string(),                                 // "YYYY-MM-DD HH:MM:SS"
  marcador_equipo_1_90_mins: z.number().int().nullable(),
  marcador_equipo_2_90_mins: z.number().int().nullable(),
  prorroga: z.boolean().nullable(),
  penaltis: z.boolean().nullable(),
  ganador: z.string().nullable(),
});
export const PythonMatchesSchema = z.array(PythonMatchSchema);
```

### 4.8 `scripts/seed/lib/upserts.ts`

Una función por tabla. Usan `supabase.from(...).upsert(rows, { onConflict: ... })`.
Devuelven los datos insertados/actualizados con sus IDs para encadenar.

```ts
async function upsertTeams(supabase, tournamentId, teams) {
  const rows = teams.map(t => ({ tournament_id: tournamentId, ...t }));
  const { data, error } = await supabase
    .from("teams")
    .upsert(rows, { onConflict: "tournament_id,external_id" })
    .select("id, code, display_name, external_id");
  if (error) throw error;
  return data;
}
```

Para fixtures, antes del upsert hay que **resolver los `team_id`s** a
partir de `home_team_name`/`away_team_name`, usando un `Map<string, uuid>`
construido de `teams.display_name → teams.id`. Si no encuentra match,
loguear claramente y abortar.

### 4.9 `scripts/seed/wc-2022.ts`

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../../src/lib/supabase/admin";
import { TournamentSchema, TeamsSchema, PythonMatchesSchema } from "./lib/schemas";
import { STAGES, ROUNDS } from "./lib/catalogs";
import { upsertTournament, upsertStages, upsertRounds,
         upsertTeams, upsertFixtures } from "./lib/upserts";
import { confirmTarget } from "./lib/env";

async function main() {
  await confirmTarget();              // logs target, exige --confirm-prod si no es local

  const tournament = TournamentSchema.parse(
    JSON.parse(readFileSync("data/seeds/wc_2022/tournament.json", "utf8")));
  const teams = TeamsSchema.parse(
    JSON.parse(readFileSync("data/seeds/wc_2022/teams.json", "utf8")));
  const pythonMatches = PythonMatchesSchema.parse(
    JSON.parse(readFileSync("data/partidos/2022/partidos_2022_sin_resultados.json", "utf8")));

  const supabase = createAdminClient();
  const t = await upsertTournament(supabase, tournament);
  const stages = await upsertStages(supabase, t.id, STAGES);
  const rounds = await upsertRounds(supabase, t.id, ROUNDS, stages);
  const teamRows = await upsertTeams(supabase, t.id, teams);
  const fixtureRows = await upsertFixtures(supabase, t.id, pythonMatches,
    { stages, rounds, teams: teamRows });

  console.log("seed completo");
  console.log({
    tournaments: 1, stages: stages.length, rounds: rounds.length,
    teams: teamRows.length, fixtures: fixtureRows.length,
    skipped_matches: pythonMatches.length - fixtureRows.length,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
```

`upsertFixtures` se encarga de:
- Filtrar partidos cuyos `equipo_1` / `equipo_2` no estén entre los 32
  equipos cargados (ej. eliminatorios todavía sin resolver).
- Aplicar los mapas `(fase, jornada) → (stage_code, round_code)`.
- Resolver `team_id` por `display_name` o por aliases.
- Convertir `fecha` de Madrid local a UTC.
- Upsert por `(tournament_id, external_id)`.

### 4.10 `package.json` — script

```json
"seed:wc2022": "tsx --env-file=.env.local scripts/seed/wc-2022.ts"
```

Para producción documento en la bitácora el comando inline:

```bash
NEXT_PUBLIC_SUPABASE_URL=<prod-url> \
SUPABASE_SECRET_KEY=<sb_secret_xxx> \
  npx tsx scripts/seed/wc-2022.ts --confirm-prod
```

---

## 5. Pasos de ejecución

### Paso 1 · Datos
1. Escribir `data/raw/strip_results_2022.py`. Ejecutarlo. Verificar que
   `data/partidos/2022/partidos_2022_sin_resultados.json` tiene 64
   objetos con los 5 campos en `null`. Commit.

### Paso 2 · JSONs canónicos
2. Crear `data/seeds/wc_2022/tournament.json`.
3. Crear `data/seeds/wc_2022/teams.json` (32 equipos).
   Commit "data: add wc_2022 tournament+teams seeds".

(No hay paso 4: el seeder lee el JSON Python neutro directamente y
filtra fase de grupos.)

### Paso 3 · Tooling
5. Añadir `tsx` con `npm install -D tsx`. Commit.
6. Crear `scripts/seed/wc-2022.ts` y sus libs. Commit
   "feat(seed): wc-2022 seeder".
7. Añadir script `seed:wc2022` a `package.json`. Commit junto con (6).

### Paso 4 · Verificación local
8. `npm run db:reset`.
9. `npm run seed:wc2022`. Verificar conteos esperados:
   - tournaments: 1
   - stages: 6
   - rounds: 8
   - teams: 32
   - fixtures: **48** (solo fase de grupos)
   - match_results: 0
   - players: 0
   - skipped_matches: 16 (los eliminatorios del JSON Python)
10. Re-ejecutar `npm run seed:wc2022` y comprobar que los conteos no
    cambian (idempotencia).
11. Verificación SQL spot:
    ```sql
    select count(*) from fixtures where tournament_id = (select id from tournaments where slug='wc_2022_test');
    select group_code, count(*) from teams where tournament_id = ... group by 1 order by 1;
    select round_id, count(*) from fixtures group by 1;  -- 16/16/16 por jornada
    ```

### Paso 5 · Producción
12. **Pedir confirmación al autor.**
13. Ejecutar el seeder contra producción con env vars inline.
14. Verificar conteos en Supabase Studio.
15. Bitácora final.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| El seeder corre por accidente contra prod | Flag obligatoria `--confirm-prod` cuando la URL no sea `127.0.0.1` ni `192.168.0.112`. |
| Los upserts duplican filas | `onConflict` apuntando a la unique constraint correcta de cada tabla. Verificación con re-run. |
| `team_name` del JSON no coincide con `display_name` de teams.json | Hago el matching con un `Map` y aborto loud si falla. Compruebo todos los nombres antes de commitear `fixtures.json`. |
| Timezones mal — predicciones se bloquean a horas raras | Verifico contra un partido conocido del 2022 antes de generar `fixtures.json`. Documento en la bitácora. |
| Campos NOT NULL del schema que no he previsto | Releeré las migraciones cuando vaya a escribir el seeder. |
| `score_multiplier` provisional contradiría el hito 11 | Lo dejo configurable; el hito 11 puede sobreescribirlos. |

---

## 7. Lo que NO entra en este hito

- Tabla `players` (jugadores). Se queda vacía.
- Páginas admin para editar fixtures (eso es hito 07).
- Cargar el calendario del Mundial 2026. (Existe el JSON, pero según
  el plan global el seed real de 2026 es post-validación de Catar.)
- Cargar resultados reales. Eso lo introduce el admin a mano en hito 10.
- Modificar el schema (`top_scorer_player_id` / `best_player_id`). Eso
  se hará en hito 08 cuando definamos cómo guardamos el pichichi.

---

## 8. Acceptance criteria

- [x] `data/partidos/2022/partidos_2022_sin_resultados.json` existe con
      48 partidos de fase de grupos (filtrados por el strip script) y
      los 5 campos de resultado en `null`.
- [x] `data/seeds/wc_2022/{tournament,teams}.json` validan contra los
      Zod schemas.
- [x] `npm run wc2022:upload` completo en local sin errores.
- [x] Conteos en local: 1 tournament, 6 stages, 8 rounds, 32 teams,
      48 fixtures, 0 match_results, 0 players.
- [x] Re-ejecutar el seeder no cambia los conteos.
- [x] Mismas verificaciones en producción.
- [x] Bitácora `06-seed-and-import-master-data-implementation.md`
      escrita en paralelo, no al final.

---

## 9. Próximo hito (preview)

Hito 07 — Admin: fixtures y jugadores. Páginas en `/admin/fixtures`
para que el admin pueda:
- Editar `kickoff_at` y `status` de un fixture.
- **Añadir** los partidos eliminatorios al JSON Python (o directamente
  desde la UI) cuando se conozcan los cruces. Re-run del seeder los
  importa por `external_id`.
- (Skipped: gestión de jugadores, ya que decidimos no usarlos.)

## 10. Workflow del admin para añadir eliminatorias (post-hito 06)

Una vez termine la fase de grupos del Mundial real:

1. El admin abre `data/partidos/2022/partidos_2022_sin_resultados.json`
   (o el del 2026).
2. Edita los partidos de octavos rellenando `equipo_1`/`equipo_2` con
   los equipos clasificados reales. Mantiene `external_id` original.
   Los campos de resultado siguen en `null`.
3. Commit + push.
4. Re-ejecuta `npm run wc2022:upload` (en prod con env vars inline).
5. El upload detecta los nuevos `external_id` con equipos resueltos y
   los inserta como nuevos fixtures. Los partidos ya existentes no se
   modifican (idempotencia).
6. Los usuarios pueden empezar a predecir los nuevos partidos en cuanto
   aparezcan en la UI (hito 09).
7. Repetir para cuartos, semis, tercer puesto y final.

## 11. Modelo de sync bidireccional JSON ↔ Supabase

**Principio**: Supabase es la **única fuente de verdad de runtime**.
La web siempre lee y escribe contra la DB. El JSON local es un buffer
de intercambio.

### Direcciones del sync

```
            wc2022:upload  ──>
JSON local                       Supabase
            <──  wc2022:download
```

- **Upload (JSON → DB)** — usado para:
  - Bootstrap inicial del torneo (este hito 06).
  - Edición batch: el admin edita el JSON masivamente (p.ej. añade los
    16 fixtures de eliminatorias de golpe) y sube todos los cambios
    con un solo comando.
  - Merge de cambios externos (p.ej. corrección de un dataset).

- **Download (DB → JSON)** — usado para:
  - Snapshot/backup local de lo que hay en producción.
  - Sincronizar el JSON local cuando el admin haya editado algo
    desde la UI web (un cambio de fecha, un nuevo equipo asignado a
    una eliminatoria, etc.). Sin esto, el JSON quedaría obsoleto y
    un próximo upload sobrescribiría los cambios web.

### Reglas de oro

- **Antes de un upload**, hacer `wc2022:download` o estar seguro de que
  no hay cambios pendientes en la DB que el JSON local no refleje.
  Si no, riesgo de pisar cambios del admin con un JSON obsoleto.
- **Ambos scripts son idempotentes**: ejecutarlos N veces produce el
  mismo estado.
- **El download NO toca la DB**, solo lee. Es seguro contra prod.
- **El upload SÍ escribe**. Necesita `--confirm-prod` para apuntar a
  prod.
- **Match key**: `external_id`. Es la columna estable que conecta JSON
  ↔ DB. **Nunca cambiar un `external_id` existente** o se romperá el
  vínculo y se duplicará el partido.

### Qué se sincroniza (alcance del upload/download)

| Tabla         | Upload | Download | Notas |
|---------------|--------|----------|-------|
| tournaments   | ✓      | (no)     | Datos canónicos en `tournament.json`. |
| stages        | ✓      | (no)     | Catálogo hardcoded en `catalogs.ts`. |
| rounds        | ✓      | (no)     | Catálogo hardcoded en `catalogs.ts`. |
| teams         | ✓      | (no)     | Datos canónicos en `teams.json`. |
| fixtures      | ✓      | ✓        | Sincronizado vía `partidos_*.json`. |
| match_results | (no)   | (futuro) | Hito 10 los introduce desde la UI. |
| match_goals   | (no)   | (futuro) | Hito 10. |
| predictions*  | (no)   | (no)     | Datos de usuario, no se serializan. |

Para el hito 06 implementamos el upload completo y el download solo de
`fixtures` (es lo único realmente bidireccional). El resto se cubrirá
si hace falta en hitos posteriores.

### Detección de divergencia

`wc2022:download` puede sacar dos modos:
- `--write`: sobreescribe el JSON local con la versión de la DB.
- por defecto: imprime un diff (qué partidos añadidos/modificados/
  borrados) sin tocar el fichero. Útil para "¿qué ha cambiado el admin
  desde la web?".

(Implementación del diff: simple comparación campo a campo del array
de fixtures por `external_id`.)

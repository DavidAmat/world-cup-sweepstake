# 09 — Predicciones de partidos · plan

> Hito 09 del roadmap (`01-plan.md` §7).
> Fuente funcional: PID §5.7 (form grupos vs eliminatorias), §5.8
> (vista pública), §4.4 (lock 24h), §4.2 (tabla `match_predictions`),
> §6.2 (criterios — se puntúan en hito 11, **aquí NO**).
> Bootstrap: `08-bootstrap-prompt.md`.

---

## 0. Resumen ejecutivo

Cada usuario predice **cada partido** del torneo:

- **Fase de grupos** → solo `home_goals_90` / `away_goals_90`.
- **Eliminatorias** → además: prórroga (sí/no) + `home_goals_120` /
  `away_goals_120`, penaltis (sí/no), y **equipo que pasa**
  (`predicted_qualified_team_id`).

Editable hasta **24 h antes del kickoff de ese partido**
(`is_fixture_locked`, PID §4.4). Pasado el lock: solo lectura y
público (la RLS de `match_predictions` ya lo permite). Sin scoring
(hito 11).

La capa de BD **ya existe** (`match_predictions` + RLS + CHECKs en
`20260508164810_predictions.sql`). El hito es sobre todo **UI +
server actions + reutilización**, más **una micro-migración** para
que `FECHA_ACTUAL` también simule el lock de partido.

**Extra pedido por el usuario** (D09-8): un botón **"Generar
predicciones aleatorias"** (**solo admin**) que rellena de golpe las
predicciones de todos los partidos no bloqueados, para poder probar
rápido sin teclear 56 marcadores. Lógica por dado de categoría de
resultado (40 % local / 30 % empate / 30 % visitante); en
eliminatorias el empate a 90' **siempre** lleva a prórroga.

Entregables que requieren tu visto bueno antes de tocar código:
(1) la **micro-migración** `is_fixture_locked → app_now()`,
(2) las **decisiones D09-1..D09-9**.

---

## 1. Estado verificado de la BD (local, leído hoy 2026-05-16)

```
tournament: wc_2022_test · 3134daba… · active
profiles:   3 → David1 (admin), David2 (player), David3 (player)
            (coinciden con context/usuarios/01-fake-users.json)
fixtures:   56 → 48 group_stage + 8 round_of_16
            TODOS con home_team_id y away_team_id (0 placeholders hoy)
            min(kickoff)=2026-06-11 20:00Z  max=2026-07-02 19:00Z
match_predictions: 0 filas
app_settings.fecha_actual = NULL  (.env.local FECHA_ACTUAL vacío → hora real)
```

Stages: `group_stage, round_of_16, quarter_final, semi_final,
third_place, final`. Rounds (sort_order): `group_md1` (Jornada 1),
`group_md2` (Jornada 2), `group_md3` (Jornada 3), `r16` (Octavos de
final), `qf`, `sf`, `third`, `final`. Hoy solo hay fixtures en
`group_md1/2/3` y `r16`.

`match_predictions` (migración `…_predictions.sql`, **no se recrea**):
`home_goals_90`/`away_goals_90` (not null, ≥0), `predicts_extra_time`
(default false), `home_goals_120`/`away_goals_120` (nullable, ≥0),
`predicts_penalties` (default false), `predicted_winner_team_id`,
`predicted_qualified_team_id` (FK teams, nullable), `unique
(fixture_id, user_id)`, **CHECKs**:

- prórroga=false ⇒ goles120 ambos NULL; prórroga=true ⇒ goles120
  ambos NOT NULL.
- penaltis=true ⇒ prórroga=true.

RLS de `match_predictions` (ya correcta para el hito):
`select` propia **o** `is_fixture_locked(fixture_id)` **o** admin;
`insert/update/delete` propia **y** `not is_fixture_locked`;
`admin_all`. Es decir: no necesito tocar RLS ni la tabla.

`is_fixture_locked(uuid)` hoy = `now() >= kickoff_at - 24h`
(`20260508164618_fixtures_and_results.sql`). **Usa `now()`, no
`app_now()`** → `FECHA_ACTUAL` NO simula el lock de partido todavía.

---

## 2. Decisiones a confirmar (D09-x)

Vinculantes una vez aprobadas. Marco mi recomendación.

- **D09-1 · Repuntar `is_fixture_locked` a `app_now()`
  (RECOMENDADO).** Micro-migración que hace `create or replace
  function public.is_fixture_locked` cambiando únicamente `now()` →
  `public.app_now()` (mismo cuerpo, misma firma, mismo `stable`).
  Así `FECHA_ACTUAL` / `make fecha` también mueven el lock de
  partido (igual que ya hace con las predicciones iniciales) y se
  puede probar el bloqueo sin esperar a junio. La RLS ya llama a esta
  función → el cambio se propaga gratis y sigue habiendo una sola
  fuente de verdad (app vía `rpc` == RLS). Firma intacta →
  `database.types.ts` no cambia (igual lo regenero + prettier por
  convención del repo). Alternativa descartada: una segunda función
  `is_fixture_locked_appnow` (duplica lógica, desincroniza RLS).

- **D09-2 · Rutas en inglés, UI en español** (igual que D08-8).
  `src/app/(app)/predictions/matches/` →
  `/predictions/matches` y `/predictions/matches/public`. Coherente
  con `/predictions/initial`, `/dashboard`, `/admin/fixtures`.

- **D09-3 · Navegación por ronda (jornada) con `?round=`.** Selector
  `<select>` en un `<form method="get">` (sin JS, patrón de la vista
  pública del hito 08 y de filtros de `/admin/fixtures`). Opciones =
  rounds del torneo que tienen ≥1 fixture, ordenadas por
  `sort_order`. Default: la **primera ronda con algún fixture no
  bloqueado**; si todas bloqueadas, la última. Una ronda por pantalla
  (≤ 8 partidos de grupo / 8 octavos): formulario manejable.

- **D09-4 · Grupos vs eliminatorias por `stage.code`.** `is_knockout
  = stage.code <> 'group_stage'`. Grupos: solo goles a 90'.
  Eliminatorias: + prórroga + goles 120 + penaltis + equipo que pasa.

- **D09-5 · Fixtures sin equipos (placeholders).** Si
  `home_team_id` o `away_team_id` es `null` (cruce no sorteado aún):
  la fila se **muestra deshabilitada** ("⏳ Equipos por definir — no
  se puede predecir todavía"), sin inputs, y el generador aleatorio
  (D09-8) la **salta**. Hoy en local no hay ninguno, pero el formato
  real 2026 sí tendrá octavos con placeholders hasta el sorteo; lo
  dejamos resuelto. (Alternativa "permitir solo goles": descartada —
  en eliminatorias necesitas el equipo que pasa; predecir goles sin
  saber quién juega no aporta y complica el scoring del hito 11.)

- **D09-6 · Lock por fixture en una sola query, vía `app_now()`.**
  Helper `src/lib/predictions/matchLock.ts`: llama a
  `syncAppNowFromEnv()` (igual que `initialLock.ts`) y a **un**
  `rpc("app_now")` → devuelve `appNow` (ISO de Postgres). El lock de
  cada fixture se calcula en JS: `locked = appNow >= kickoff_at -
  24h`. Es **exactamente** lo que evalúa `is_fixture_locked` tras
  D09-1 (misma fórmula, misma "now"), pero en **1 round-trip** en vez
  de N `rpc`. No usa `Date.now()` (la "now" viene de Postgres) →
  esquiva el gotcha Next 16 `react-hooks/purity`. El server action
  re-valida por fixture vía `rpc("is_fixture_locked", {p_fixture_id})`
  antes del upsert (defensa en profundidad; la RLS es la barrera
  real).

- **D09-7 · Un formulario por ronda (no por fixture).** `<form
  action={saveRoundMatchPredictions}>` con todos los fixtures **no
  bloqueados y con equipos** de la ronda y un único botón "Guardar
  jornada". Inputs nombrados con sufijo del fixture id
  (`h90_<fid>`, `a90_<fid>`, `et_<fid>`, `h120_<fid>`, `a120_<fid>`,
  `pen_<fid>`, `qual_<fid>`). Server action = `upsert` masivo
  `onConflict (fixture_id,user_id)`. Sin client components: en
  eliminatorias los campos de prórroga/penaltis/120' se muestran
  **siempre** (con etiqueta "solo si hay prórroga"); la coherencia la
  garantiza la validación Zod + CHECKs. Fixtures ya bloqueados de esa
  ronda se renderizan **solo lectura** en la misma lista (no
  redirect — gotcha streaming).

- **D09-8 · Botón "Generar predicciones aleatorias" (testing, SOLO
  ADMIN).** Server action `generateRandomMatchPredictions()` (botón
  en `/predictions/matches`, `<form action=…>` aparte; el botón y la
  acción se gatean con el rol admin — David1). Como aún hay que
  loguearse como cada usuario para que la porra tenga sentido, en la
  práctica rellena las predicciones **del admin logueado** para
  **todos** los fixtures del torneo **no bloqueados y con ambos
  equipos**. Algoritmo por fixture (decisión del usuario):

  1. **Dado de categoría del 90'**: 40 % gana local · 30 % empate ·
     30 % gana visitante.
  2. **Marcador del 90'** = sample del **grupo** que tocó:
     - *Local*: `1-0,2-0,2-1,3-0,3-1,3-2,4-0,4-1` …
     - *Empate*: `0-0,1-1,2-2,3-3`
     - *Visitante*: `0-1,0-2,1-2,0-3,1-3,2-3,0-4,1-4`
  3. **Fase de grupos**: el partido **termina ahí** (los grupos sí
     pueden acabar en empate). `predicts_extra_time=false`,
     `predicts_penalties=false`, `home/away_goals_120=null`,
     `predicted_qualified_team_id=null`,
     `predicted_winner_team_id=null`.
  4. **Eliminatorias**:
     - 90' **no empate** → el partido termina en 90'. Sin prórroga
       ni penaltis. `predicted_qualified_team_id` /
       `predicted_winner_team_id` = ganador del 90'.
     - 90' **empate** → **siempre hay prórroga**
       (`predicts_extra_time=true`). Dado de penaltis:
       `PENALTY_PROB = 0.70` → `predicts_penalties=true`. Dado de
       ganador (50/50 local/visitante) que decide
       `predicted_qualified_team_id`/`predicted_winner_team_id` **sea
       cual sea** el 120' ("da igual el resultado de la prórroga").
       Marcador 120' (CHECK obliga a que esté presente, ≥ 90'):
         · con penaltis → empate a 120' (= marcador del empate del
           90'): el partido se decide desde el punto de penalti.
         · sin penaltis (se gana en la prórroga) → el ganador del
           dado mete 1 gol más sobre el empate del 90' (no empate a
           120', coherente con "ganó en la prórroga").
  - Respeta por construcción los 2 CHECKs (prórroga⇔120 presentes;
    penaltis⇒prórroga) y el invariante D09-9. Usa el **server
    client** (RLS). Salta fixtures bloqueados/sin equipos.
    `revalidatePath` + `redirect(?ok=random)`. Etiquetado como
    herramienta de prueba en la UI; visible solo si `is_admin()`.
    `PENALTY_PROB` y la tabla 40/30/30 son constantes ajustables.

- **D09-9 · Invariante de coherencia 90'/prórroga (CONFIRMADO por el
  usuario).** En **fase de grupos** el partido puede acabar en empate
  a 90' y termina ahí. En **eliminatorias** un empate a 90' **obliga**
  a prórroga. La validación Zod cruzada (formulario manual) exige:
  - `predicts_extra_time` ⇒ `home_goals_90 == away_goals_90` (solo
    se va a prórroga desde un empate a 90').
  - eliminatoria **y** `home_goals_90 == away_goals_90` ⇒
    `predicts_extra_time = true` (un partido de eliminatoria no puede
    acabar empatado a 90').
  - `predicts_penalties` ⇒ `predicts_extra_time` (CHECK).
  - eliminatoria ⇒ `predicted_qualified_team_id` requerido y ∈
    {`home_team_id`, `away_team_id`}. Si **no** hay prórroga (90' no
    empate) ⇒ debe ser el ganador del 90'. Si hay prórroga **sin**
    penaltis ⇒ debe ser el ganador del 120'. Con penaltis ⇒ libre
    (cualquiera de los dos).
  - fase de grupos ⇒ sin prórroga, sin penaltis, sin equipo que pasa.

---

## 3. Micro-migración SQL propuesta (D09-1)

Fichero nuevo
`supabase/migrations/20260517120000_is_fixture_locked_app_now.sql`:

```sql
-- ============================================================================
-- Migration: is_fixture_locked → app_now()
-- ----------------------------------------------------------------------------
-- The per-fixture prediction lock (PID §4.4: now >= kickoff - 24h) was
-- defined against now(). Re-point it to public.app_now() so the FECHA_ACTUAL
-- testing override (app_settings.fecha_actual, hito 08) also simulates the
-- match-prediction lock. Same signature, same body shape, only now() changes.
-- RLS policies on match_predictions already call this function, so the
-- change propagates with no policy edits.
-- ============================================================================

create or replace function public.is_fixture_locked(p_fixture_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce(
    public.app_now() >= (
      select kickoff_at - interval '24 hours'
        from public.fixtures where id = p_fixture_id
    ),
    false
  )
$$;
```

Notas:

- **No** se recrea `match_predictions` ni su RLS ni `app_now()`.
  Solo `create or replace` de una función existente. Aditiva, no
  destructiva, sin pérdida de datos.
- Firma idéntica → `database.types.ts` no cambia. Aun así regenero
  con `npm run types:gen` + `npx prettier --write
  src/lib/supabase/database.types.ts` (convención del repo, deja
  `format:check` verde).
- Aplicación: `npx supabase migration up --local` (no `db:reset`).
  Verifico en psql que `is_fixture_locked` con `FECHA_ACTUAL` movido
  cambia de valor. Con tu OK: `echo y | npx supabase db push
  --linked` + `migration list --linked`.

---

## 4. Lógica de lock en la app

Helper nuevo `src/lib/predictions/matchLock.ts` (server-only),
espejo de `initialLock.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { syncAppNowFromEnv } from "@/lib/dates/appNow";

const LOCK_MS = 24 * 60 * 60 * 1000;

export type MatchLockState = {
  appNow: string;          // ISO de Postgres (real o FECHA_ACTUAL)
  fechaActual: string | null;
  overriding: boolean;
};

export async function getMatchLockState(): Promise<MatchLockState> {
  const { fechaActual, overriding } = await syncAppNowFromEnv();
  const supabase = await createClient();
  const { data } = await supabase.rpc("app_now");
  return { appNow: (data as string) ?? new Date().toISOString(), fechaActual, overriding };
}

export function isFixtureLocked(kickoffIso: string, appNowIso: string): boolean {
  return new Date(appNowIso).getTime() >= new Date(kickoffIso).getTime() - LOCK_MS;
}
```

`isFixtureLocked` reproduce exactamente `public.is_fixture_locked`
tras D09-1 (misma "now" de Postgres, misma resta de 24 h). Un solo
`rpc` por carga de página, no N. El banner "🧪 Fecha simulada" se
muestra con `overriding`/`fechaActual` (mismo componente visual que
el hito 08).

---

## 5. Rutas, páginas y componentes

```
src/app/(app)/predictions/matches/
  page.tsx            ← selector de ronda + form (abiertos) +
                         filas solo-lectura (bloqueados) + botón random
  actions.ts          ← saveRoundMatchPredictions, generateRandomMatchPredictions
  schemas.ts          ← Zod por fixture + lector de FormData
  public/
    page.tsx          ← vista pública comparativa por ronda
src/lib/predictions/
  matchLock.ts        ← helper de lock (rpc app_now + cálculo en JS)
supabase/migrations/
  20260517120000_is_fixture_locked_app_now.sql
```

### 5.1 `/predictions/matches` — formulario por ronda

Server Component. `requireAuth()` + `getDefaultTournament()` +
`getMatchLockState()`. Query: rounds del torneo (con
`sort_order`, join a `stages` para `code`/`name`), fixtures de la
ronda seleccionada (join `teams` home/away y `stages`,
`order by kickoff_at`), y las `match_predictions` del usuario para
esos fixtures.

- **Selector de ronda** (`?round=<code>`, form GET). Solo rounds con
  ≥1 fixture. Badge por fixture: `Abierto` (emerald) / `Bloqueado`
  (amber) según `isFixtureLocked(kickoff, appNow)`.
- **Por fixture**:
  - Sin equipos (D09-5): fila deshabilitada "⏳ Equipos por definir".
  - Bloqueado: solo lectura (marcador + extras si eliminatoria), sin
    inputs (no redirect — gotcha streaming Next 16).
  - Abierto + grupo: 2 inputs number `h90_<fid>` / `a90_<fid>`.
  - Abierto + eliminatoria: lo anterior + checkbox prórroga
    `et_<fid>`, inputs `h120_<fid>`/`a120_<fid>` ("solo si prórroga"),
    checkbox penaltis `pen_<fid>`, `<select>` equipo que pasa
    `qual_<fid>` (opciones: local / visitante).
- Un único `<form action={saveRoundMatchPredictions}>` envolviendo
  los fixtures editables + hidden `round`. Botón "Guardar jornada".
- **Solo si el usuario es admin** (`profiles.role === 'admin'` /
  `is_admin()`): bloque aparte `<form
  action={generateRandomMatchPredictions}>` con botón "🎲 Generar
  predicciones aleatorias (todas las jornadas)" + nota "Herramienta
  de prueba (admin): rellena al azar todos tus partidos no
  bloqueados". Banner `?ok=` / `?error=`.
- Banner "🧪 Fecha simulada" si `overriding`.

### 5.2 `actions.ts`

`saveRoundMatchPredictions(formData)`:

1. `requireAuth()`; `getDefaultTournament()`; leer `round` del form.
2. Cargar fixtures de esa ronda (id, kickoff, stage.code,
   home_team_id, away_team_id) + `getMatchLockState`.
3. Por cada fixture **con equipos y no bloqueado** presente en el
   form: parsear con Zod (`readFixturePayload`), aplicar validación
   cruzada (§6) según grupo/eliminatoria. Saltar fixtures sin datos
   (el usuario puede rellenar solo algunos).
4. Re-check lock por fixture vía `rpc("is_fixture_locked")` (defensa
   en profundidad). Si bloqueado → se omite con aviso.
5. `upsert` masivo en `match_predictions` `onConflict
   (fixture_id,user_id)` con el **server client** (RLS aplica).
6. `revalidatePath` de la ruta + `?round=` y la pública;
   `redirect(?round=<r>&ok=saved)`.

`generateRandomMatchPredictions()`: lógica D09-8. `requireAdmin()`
(gate de rol; si no admin → `?error=`); tournament +
`getMatchLockState`; cargar **todos** los fixtures del torneo con
`stages.code` y equipos; filtrar no bloqueados + con equipos;
construir filas aleatorias por el algoritmo D09-8 (dado 40/30/30 →
grupo de marcadores → eliminatoria con prórroga/penaltis) respetando
CHECKs + D09-9; `upsert` masivo (server client, escribe lo del admin
logueado); `revalidatePath`; `redirect(?ok=random)`. Reutiliza
`requireAdmin` de `src/lib/permissions/`.

### 5.3 `/predictions/matches/public` — vista pública

Server Component. `requireAuth` + tournament + `getMatchLockState`.
Selector de ronda igual que 5.1. Por fixture:

- **No bloqueado**: card "🔒 Se hará pública cuando se bloquee
  (24 h antes del partido — DD/MM/YYYY · HH:MM Madrid)". No se
  consultan predicciones ajenas (la RLS las ocultaría igualmente).
- **Bloqueado**: query de **todas** las `match_predictions` del
  fixture (la RLS las autoriza tras el lock), join `profiles`. Una
  card por usuario (scroll vertical, NO dropdown de usuarios — PID
  §5.8) con su marcador a 90' y, si eliminatoria, prórroga/penaltis/
  equipo que pasa. Usuario sin predicción → "— sin predicción —".

### 5.4 Navegación

- `Header.tsx`: el link "Predicciones" → `/predictions/initial` se
  mantiene; añado "Partidos" → `/predictions/matches`.
- `dashboard/page.tsx`: tarjeta/link a `/predictions/matches` y a su
  vista pública (coherente con las del hito 08).

---

## 6. Zod (`schemas.ts`)

```ts
const NonNegInt = z.coerce.number().int().nonnegative();

// Lo que se postea por fixture (campos con sufijo _<fid> en el form).
export const FixturePredictionSchema = z
  .object({
    fixture_id: z.string().uuid(),
    is_knockout: z.boolean(),
    home_goals_90: NonNegInt,
    away_goals_90: NonNegInt,
    predicts_extra_time: z.boolean(),
    home_goals_120: NonNegInt.nullable(),
    away_goals_120: NonNegInt.nullable(),
    predicts_penalties: z.boolean(),
    predicted_qualified_team_id: z.string().uuid().nullable(),
  })
  .refine((p) => !p.predicts_penalties || p.predicts_extra_time, {
    message: "No puede haber penaltis sin prórroga.",
  })
  .refine(
    (p) =>
      (!p.predicts_extra_time && p.home_goals_120 == null && p.away_goals_120 == null) ||
      (p.predicts_extra_time && p.home_goals_120 != null && p.away_goals_120 != null),
    { message: "Si hay prórroga, indica el resultado a 120'." },
  )
  .refine((p) => !p.predicts_extra_time || p.home_goals_90 === p.away_goals_90, {
    message: "Solo hay prórroga si el partido está empatado a 90'.", // D09-9
  })
  .refine(
    (p) => !p.is_knockout || p.home_goals_90 !== p.away_goals_90 || p.predicts_extra_time,
    { message: "En eliminatorias un empate a 90' obliga a prórroga." }, // D09-9
  )
  .refine((p) => !p.is_knockout || p.predicted_qualified_team_id != null, {
    message: "En eliminatorias debes indicar el equipo que pasa.",
  })
  .refine(
    (p) => p.is_knockout || (!p.predicts_extra_time && !p.predicts_penalties),
    { message: "En fase de grupos no hay prórroga ni penaltis." },
  );
```

Validación cruzada extra en el action (necesita la BD), D09-9:
`predicted_qualified_team_id ∈ {home_team_id, away_team_id}`; si **no**
hay prórroga ⇒ = ganador del 90'; si hay prórroga **sin** penaltis ⇒
= ganador del 120'; con penaltis ⇒ libre. Mensajes en español.

---

## 7. Pasos de ejecución

1. **Migración** §3. Crear fichero, `npx supabase migration up
   --local`, verificar en psql que `is_fixture_locked` responde a
   `FECHA_ACTUAL`. `npm run types:gen` + prettier. Enseñarte el diff.
   **Con tu OK**: `db push --linked` + `migration list --linked` +
   commit.
2. `src/lib/predictions/matchLock.ts`.
3. `schemas.ts` + `actions.ts` (`saveRoundMatchPredictions` +
   `generateRandomMatchPredictions`).
4. `/predictions/matches` page (selector ronda + form + filas
   solo-lectura + botón random).
5. `/predictions/matches/public` page.
6. Nav: Header + dashboard.
7. `npm run typecheck && npm run lint && npm run format:check &&
   npm run build`. Arreglar lo que salte.
8. Smoke local David1/David2/David3 (§8). Commits por unidad
   coherente (mensaje 1 línea, Conventional Commits, `Co-Authored-By:
   Claude`), push directo a master (Vercel autodeploy).
9. Bitácora `context/implementations/09-match-predictions-implementation.md`
   en paralelo desde el paso 1.

Migración a prod: te pido confirmación explícita antes de `db push`.

---

## 8. Pruebas (local, David1 admin / David2 / David3 players)

Hoy 2026-05-16, `FECHA_ACTUAL` vacío → los 56 fixtures abiertos
(primer lock 2026-06-10 20:00Z).

- David2 (player): `/predictions/matches`, Jornada 1 → rellena
  varios marcadores → "Guardar jornada" → recarga: persiste. **No**
  ve el botón de random (no admin). Octavos → prórroga/penaltis/
  equipo que pasa; validaciones:
  - penaltis sin prórroga → error.
  - prórroga sin 120' → error.
  - prórroga con 90' no empatado → error (D09-9).
  - eliminatoria con empate a 90' sin prórroga → error (D09-9).
  - eliminatoria sin equipo que pasa → error.
- David1 (admin): ve el botón "🎲 Generar predicciones aleatorias"
  → se rellenan todos SUS partidos no bloqueados; recargar varias
  jornadas y comprobar coherencia: grupos pueden acabar en empate y
  sin extras; octavos nunca empatan a 90' (si empatan → prórroga);
  penaltis ≈70 % de los que van a prórroga; equipo que pasa siempre
  presente en eliminatorias y consistente con el ganador.
- David3: rellena alguna jornada manualmente (verifica que un player
  también puede guardar sin el botón).
- `/predictions/matches/public` antes del lock → cada fixture "se
  hará pública al bloquear"; no se filtran ajenas (RLS).
- Mover el lock con `make fecha FECHA=2026-06-12T09:00` (tras
  Jornada 1, antes de octavos): Jornada 1 → filas solo lectura +
  badge Bloqueado, intento de guardar esos fixtures rechazado (RLS +
  check app); octavos → siguen editables. `/predictions/matches/
  public` → Jornada 1 muestra las cards de los 3 usuarios; octavos
  aún no. Banner "🧪 Fecha simulada" visible.
- `make fecha FECHA=` → vuelve a hora real, todo abierto otra vez.
- `requireAuth`: anónimo en `/predictions/matches[/public]` →
  `/login`.

> Los scripts de verificación throwaway (si hace falta) **solo**
> tocan filas de `match_predictions` de los `user_id` de test que
> ellos crean; **nunca** `delete` por `tournament_id` (incidente
> hito 08).

---

## 9. Acceptance criteria

- [ ] Micro-migración aplicada local + prod; `is_fixture_locked`
      usa `app_now()` (verificado con `FECHA_ACTUAL`); tipos
      regenerados + prettier (`format:check` verde).
- [ ] `/predictions/matches`: selector de ronda; grupos = solo 90';
      eliminatorias = +prórroga/120'/penaltis/equipo que pasa.
      Guarda y reedita por ronda hasta el lock (parcial OK).
- [ ] Validación cruzada Zod espejando los CHECK + D09-9, mensajes
      en español; el server re-valida el lock antes del upsert.
- [ ] Tras el lock por fixture: fila solo lectura (sin redirect);
      RLS rechaza writes; ese fixture pasa a público.
- [ ] `/predictions/matches/public`: por ronda, una card por usuario
      por fixture, solo visible cuando el fixture está bloqueado;
      no fuga de predicciones antes del lock (RLS).
- [ ] Botón "Generar predicciones aleatorias" **solo visible/ejecutable
      por admin**: rellena todos los partidos no bloqueados con dado
      40/30/30 → grupo de marcadores; eliminatorias: empate a 90' ⇒
      prórroga, penaltis ≈70 %, ganador siempre definido; grupos
      pueden empatar; respeta CHECKs e invariantes D09-9.
- [ ] Fixtures sin equipos: mostrados deshabilitados, no predecibles,
      saltados por el generador.
- [ ] UI español, coherente con `/predictions/initial`, `/rules`,
      `/admin/fixtures`. Reutiliza `getDefaultTournament`,
      `madridTime`, `Badge`, patrón `appNow`/`FECHA_ACTUAL`.
- [ ] `typecheck`/`lint`/`format:check`/`build` verdes. Probado
      local con David1/2/3; push a master desplegado.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `is_fixture_locked` re-point rompe RLS de `match_predictions` | Misma firma, mismo `stable`, solo `now()`→`app_now()`; RLS la llama por nombre, no cambia. Verificado en psql antes de `db push`. |
| N `rpc` por fixture (lento) | Un solo `rpc("app_now")`; el lock se calcula en JS con la misma fórmula que la función SQL (D09-6). |
| `Date.now()` → `react-hooks/purity` | La "now" viene de Postgres (`app_now`), no de `Date.now()` en el componente. |
| `redirect()` en server component streaming (gotcha hito 07) | Fixtures bloqueados/sin equipos se **renderizan** en modo lectura, no se redirige. |
| Generador random viola un CHECK | El generador construye los valores respetando los dos CHECK + D09-9 por construcción; además Zod valida antes del upsert. |
| Form por ronda muy grande | ≤8 fixtures por ronda; inputs `number` pequeños; un solo submit. |
| Borrado destructivo en verificación (incidente hito 08) | Scripts throwaway solo upsert/borran filas propias de test por `user_id`; nunca `delete` por `tournament_id`. |
| Octavos solo-local sin sorteo en 2026 | D09-5: fixtures sin equipos no predecibles; el generador los salta. |

---

## 11. Lo que NO entra

- Scoring de predicciones de partido (hito 11).
- Admin: introducción de resultados reales (hito 10).
- Selector de torneo (sigue `wc_2022_test`).
- Editar `kickoff_at` / lock desde UI (es `/admin/fixtures`, hito 07).
- Client components / toggles JS para mostrar-ocultar campos de
  prórroga (se muestran siempre con etiqueta; mejora opcional futura).

---

Cuando lo revises y me digas "adelante", empiezo por el paso 1
(micro-migración) y abro la bitácora en
`context/implementations/09-match-predictions-implementation.md`.

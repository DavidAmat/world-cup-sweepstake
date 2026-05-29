# 07 — Admin: fixtures · plan

> Hito 07 del roadmap (`01-plan.md` §7).
> Objetivo funcional: el admin puede ver, editar y crear `fixtures`
> desde la web, sin tocar la DB directamente y sin romper predicciones
> existentes.

---

## 0. Resumen ejecutivo

1. Cuatro páginas server-rendered bajo `/admin/fixtures`:
   - **Listado** (`/admin/fixtures`): tabla con los 48 fixtures de
     `wc_2022_test` (filtrable por jornada/ronda y por estado).
   - **Edición** (`/admin/fixtures/[id]`): formulario para editar
     `kickoff_at`, equipos asignados (o placeholders), `venue`, `status`.
     `external_id` se muestra en read-only.
   - **Creación individual** (`/admin/fixtures/new`): formulario para
     un fixture suelto. Mantenido como fallback manual.
   - **Importación masiva por JSON** (`/admin/fixtures/import`): el
     admin pega un JSON con N fixtures (por ejemplo los 8 octavos) y
     la UI los inserta de golpe. El JSON lo genera ChatGPT a partir
     de la lista oficial de partidos, usando el prompt versionado en
     `../implementations/admin-fixtures-json-import.md`. **Este es el camino real
     para añadir eliminatorias**; el form `new` queda como
     emergencia.
2. Todo persiste en Supabase. Nada se escribe en el JSON Python. La
   sincronización de vuelta al JSON la dispara el admin con
   `npm run wc2022:download --write` cuando quiera (D7 del hito 06).
3. Server actions con `requireAdmin()` + el server client de Supabase
   (la policy `fixtures_admin_all` permite todas las operaciones sobre
   `fixtures` al rol admin via RLS, así que no hace falta el admin
   client de service role aquí).
4. Validación con Zod en server actions y `react-hook-form` con
   `@hookform/resolvers/zod` en cliente cuando sea necesario.
5. UI en español, coherente con `/login`, `/register`, `/rules`,
   `/dashboard` (Tailwind, paleta `zinc`, sin librería de UI).
6. **No** se implementa gestión de jugadores (D2 del hito 06). El plan
   maestro §7 hito 07 menciona `/admin/players`, eso queda fuera.
7. Carpeta nueva ../implementations/ (raíz del repo) con el prompt versionado
   para ChatGPT. Es la fuente de verdad de qué formato espera la UI
   de import.

---

## 1. Decisiones cerradas (heredadas y nuevas)

### Heredadas del hito 06

- **D1** Solo fase de grupos al inicio. Hay 48 fixtures cargados, todos
  `stage=group_stage`. Los 16 de eliminatorias se irán creando con la
  UI de este hito (o vía JSON + `wc2022:upload`).
- **D2** No hay tabla `players`. Este hito ignora completamente
  jugadores.
- **D6** Las fechas son inventadas en junio 2026 a 18:00 Madrid. El
  admin podrá moverlas con la UI de este hito para testear el bloqueo
  de 24h.
- **D7** Sync bidireccional. La UI escribe en Supabase. El JSON solo
  refleja la DB tras `wc2022:download --write`.

### Nuevas (a confirmar contigo)

- **DH7-1 · `external_id` es read-only** una vez creado. La UI lo
  muestra como info pero no permite editarlo. Justificación: las
  predicciones que se hagan en hitos 08-09 se anclarán a la fila
  `fixtures.id` (FK), y `external_id` es el ancla para el round-trip
  JSON ↔ DB. Cambiarlo rompe ambos lados.
- **DH7-2 · No se permite borrar fixtures desde la UI en este hito.**
  Razón: el plan global pide "borrar fixtures con predicciones
  asociadas" como acción confirmable, pero como aún no hay
  predicciones, no es prioritario. Si más adelante hace falta, lo
  añadimos en el hito 14 (Reset y reglas). Por ahora: solo create +
  update.
- **DH7-3 · Cambio de `kickoff_at`**: la UI avisa si la fecha nueva
  está dentro de las próximas 24h (es decir, si el fixture quedaría
  bloqueado inmediatamente). Es solo un warning visual, no bloquea el
  guardado. El admin asume las consecuencias.
- **DH7-4 · Cambio de equipo** (`home_team_id` / `away_team_id`):
  como aún no hay predicciones, se permite sin restricciones. En el
  hito 09 (predicciones de partidos) y/o 14 (reset) añadiremos la
  validación: si el fixture tiene predicciones, mostrar warning o
  bloquear. Por ahora dejo un TODO comentado en el código (no helper
  vacío, solo un comentario inline).
- **DH7-5 · Status manual vs automático**: el campo `fixtures.status`
  tiene check (`scheduled|locked|completed|cancelled`). En este hito el
  admin lo cambia manualmente. El `locked` automático por kickoff_at se
  ata al hito 09 (vía la function `is_fixture_locked()` que ya existe,
  no por flipping el campo). Por defecto los 48 fixtures están en
  `scheduled`. Se permite `cancelled` manualmente. `completed` lo
  pondrá el hito 10 al confirmar resultado. La UI permite cambiarlo
  pero avisa: "normalmente esto lo gestiona el sistema".
- **DH7-6 · Asignación de equipos vs placeholders**: el constraint del
  schema obliga a tener `home_team_id OR home_placeholder` (idem
  away). La UI debe validar que al menos uno de los dos esté presente
  por lado. Para fase de grupos el equipo siempre estará asignado;
  para una eliminatoria recién creada, el admin puede usar
  placeholder (`"Ganador A"`, `"2.º C"`) hasta que conozca los cruces
  y luego editarla para asignar el equipo real.
- **DH7-7 · Selector de tournament**: hardcoded a
  `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG = wc_2022_test`. No hay aún UI
  para cambiar de torneo (solo hay uno). Cuando llegue Mundial 2026
  como torneo en paralelo, se añade un selector — fuera de alcance
  de este hito.

---

## 2. Lo que NO entra

- `/admin/players` y cualquier gestión de jugadores.
- Borrado de fixtures.
- Cambiar `external_id`.
- Selector de torneo (siempre `wc_2022_test`).
- Bulk operations (editar varios fixtures a la vez).
- Auto-lock de `status='locked'` por kickoff_at (lo hace el motor de
  RLS / hito 09, no la UI admin).
- Edición de `tournament`, `stages`, `rounds`, `teams` desde la web.
  Esos son datos canónicos que vienen del JSON. Si hay que tocarlos,
  se edita el JSON y se hace `wc2022:upload`.
- Auditoría / historial de cambios (sería bonito tener, no es
  prioritario).

---

## 3. Rutas y páginas

### 3.1 `/admin/fixtures` — listado

Archivo: `src/app/admin/fixtures/page.tsx` (Server Component, async).

**Query**:

```ts
// Read via the user-bound server client (admin RLS policy authorizes the read+write).
const { data: fixtures } = await supabase
  .from("fixtures")
  .select(`
    id, external_id, kickoff_at, status, group_code, venue,
    home_team:home_team_id(id, code, display_name),
    away_team:away_team_id(id, code, display_name),
    home_placeholder, away_placeholder,
    stage:stage_id(id, code, name, sort_order),
    round:round_id(id, code, name, sort_order)
  `)
  .eq("tournament_id", tournamentId)
  .order("kickoff_at", { ascending: true });
```

**Filtros** (vía `searchParams`, sin estado cliente):
- `?round=group_md1|group_md2|group_md3|r16|qf|sf|third|final`
- `?status=scheduled|locked|completed|cancelled`

Los selects son `<form method="get">` con submit on change (un
pequeño script inline o `<button type="submit">Filtrar</button>` —
prefiero el botón para evitar JS, coherente con cómo `/rules` y
`/login` hacen las cosas hasta ahora).

**Vista** (tabla simple, no paginada — 48 filas):

| jornada | external_id (link) | equipos | fecha (Madrid) | estado | acciones |
|---------|--------------------|---------|----------------|--------|----------|
| J1      | wc2022_group_a_md1_001 | Qatar vs Ecuador | 11/06/2026 18:00 | scheduled | Editar |

- `external_id` es un link a `/admin/fixtures/[id]` para editar.
- Si el fixture usa placeholders, mostrar el texto del placeholder en
  vez del equipo (estilo `'<Ganador A>'` en cursiva gris).
- Fecha formateada en `Europe/Madrid` con `Intl.DateTimeFormat`.
- Estado con badge de color (scheduled=zinc, locked=amber,
  completed=emerald, cancelled=rose).

**Cabecera**:
- Título "Fixtures".
- Botón "Añadir fixture" → `/admin/fixtures/new`.
- Contador "48 fixtures · 48 scheduled · 0 locked · …" como ayuda visual.

### 3.2 `/admin/fixtures/[id]` — edición

Archivo: `src/app/admin/fixtures/[id]/page.tsx` (Server Component) +
`src/app/admin/fixtures/[id]/EditForm.tsx` (Client Component si necesito
react-hook-form; si no, formulario plano con server action).

**Query inicial** (server side):
- El fixture concreto con joins (igual que arriba).
- Lista de teams del torneo (32 teams ordenados por display_name).
- Lista de stages + rounds para mostrar contexto (no editables aquí;
  cambio de stage/round sería raro tras crear el fixture y lo dejamos
  para `/new`).

**Campos editables** en el form:
- `kickoff_at` (input `datetime-local`, valor inicial convertido de
  UTC → Madrid). Submit lo vuelve a convertir a UTC en el server action.
- `home`: select de teams + opción "(placeholder)" → si se elige
  placeholder, muestra un input text para `home_placeholder`.
- `away`: igual.
- `venue` (text, opcional).
- `status` (select con los 4 valores, con un texto de ayuda debajo).

**Campos read-only** (en la página, no en el form):
- `external_id`.
- `stage` (code + name).
- `round` (code + name).
- `group_code`.
- `id` (uuid, en pequeño al pie).

**Botones**:
- "Guardar cambios" → `updateFixture` server action.
- "Cancelar" → link a `/admin/fixtures`.

**Warnings inline** (calculados server side y mostrados encima del form):
- Si `now >= kickoff_at - 24h`: "Este fixture está bloqueado para
  predicciones. Cambios en `kickoff_at` y equipos afectan a las reglas
  de bloqueo."
- Si `status === 'completed'` o `'cancelled'`: "Este fixture ya está
  finalizado/cancelado. Edita con cuidado."

### 3.3 `/admin/fixtures/import` — importación por JSON pegado

**El camino preferente para añadir eliminatorias.**

Archivo: `src/app/admin/fixtures/import/page.tsx` (Server Component
para la página, con un Client Component pequeño `ImportForm.tsx` para
el textarea + submit + render del informe de resultado).

**Flujo del admin**:
1. El admin abre la página oficial de partidos (FIFA, ESPN, lo que
   sea) y copia el listado de, por ejemplo, los 8 octavos con sus
   fechas y horas locales.
2. Va a ChatGPT, pega ese listado y le pasa el prompt versionado en
   `../implementations/admin-fixtures-json-import.md`.
3. ChatGPT devuelve un array JSON con N fixtures en el formato
   especificado.
4. El admin copia ese JSON, va a `/admin/fixtures/import`, lo pega
   en el textarea y pulsa "Validar y previsualizar".
5. La UI valida con Zod, resuelve equipos por nombre/alias, y muestra
   un preview en tabla:
   - Filas con `✓` (creará nuevo fixture)
   - Filas con `~` (actualizará un fixture existente por
     `external_id`)
   - Filas con `✗` (errores: equipo no encontrado, external_id
     malformado, etc.) — bloquean el insert
6. Si el preview es OK, pulsa "Confirmar e insertar" y la UI ejecuta
   un upsert masivo por `(tournament_id, external_id)`.
7. Tras éxito: redirect a `/admin/fixtures?ok=imported&n=<count>`.

**Formato del JSON aceptado** (el mismo del pipeline Python, así no
divergen el script `wc2022:upload` y la UI):

```json
[
  {
    "external_id": "wc2022_r16_001",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Países Bajos",
    "equipo_2": "Estados Unidos",
    "fecha": "2026-06-29T18:00:00",
    "venue": null
  }
]
```

Notas sobre el formato:
- Es un **array** en raíz (1..N elementos). El payload de Python
  también lo es.
- Acepta los mismos `fase` y mapeo a stage/round que el script.
- `fecha`: ISO local Madrid sin TZ (string `"YYYY-MM-DDTHH:mm:ss"`).
  Mismo criterio que `scripts/wc2022/lib/maps.ts` pero usando `Intl`
  para CET/CEST automático.
- `tipo_partido` y `jornada` pueden ser null en eliminatorias.
- **Permitir placeholders en `equipo_1`/`equipo_2`**: si el valor
  no resuelve a un team conocido pero parece un placeholder (p.ej.
  empieza por "Ganador", "Perdedor", "2.º", etc.), se acepta como
  `home_placeholder`/`away_placeholder`. Esto permite cargar la
  estructura del cuadro de eliminatorias antes de saber los cruces
  concretos. **Pero**: si claramente es nombre de equipo y no
  resuelve (typo), el preview marca error rojo y bloquea.
- Los campos de resultado (`marcador_*`, `prorroga`, `penaltis`,
  `ganador`) son **ignorados** si vienen en el JSON. Este hito no
  toca `match_results`.

**Reglas de matching** (orden de preferencia para resolver
`equipo_X` → team):
1. Exact match contra `teams.display_name` (case-insensitive).
2. Exact match contra `teams.canonical_name`.
3. Exact match contra cualquier elemento de `teams.aliases`.
4. Si nada matchea Y la cadena empieza por una palabra que indica
   placeholder (lista hardcoded: "Ganador", "Perdedor", "Segundo",
   "Tercero", "2.º", "1.º", "Winner", "Runner-up", etc.), se trata
   como placeholder.
5. Si nada matchea y no parece placeholder → error.

**Server action** `importFixtures(formData)` que:
1. `requireAdmin()`.
2. Parsea el textarea con `JSON.parse` (try/catch, error legible).
3. Valida cada elemento con Zod (reusar
   `PythonMatchSchema` que ya existe en
   `scripts/wc2022/lib/schemas.ts` o duplicarlo en
   `src/lib/fixtures/pythonFormat.ts`).
4. Resuelve nombres → team_ids con un `Map` build una vez.
5. Bulk upsert con `onConflict: "tournament_id,external_id"`.
6. Devuelve un informe (counts + errores por fila) que el cliente
   muestra.

**Decisión técnica**: el preview no llama a la DB; solo valida
estructura y resuelve nombres contra los teams ya en memoria (los
trae el server component al cargar la página). El "Confirmar" sí
escribe. Así evitamos un round-trip extra y dejamos la transición
preview → confirm en una sola operación.

**Code reuse**: en el paso 1 de la implementación (helpers) muevo
los mapeos `(fase, jornada) → (stage_code, round_code)` y la
conversión Madrid → UTC desde `scripts/wc2022/lib/{maps,format}.ts`
a un módulo nuevo `src/lib/fixtures/pythonFormat.ts` que ambos lados
importan. Mantengo retro-compatibilidad re-exportando desde el path
viejo (1 línea cada uno) para que el script `wc2022:upload` siga
funcionando sin tocar nada más.

### 3.4 `/admin/fixtures/new` — creación individual

Archivo: `src/app/admin/fixtures/new/page.tsx` + `NewForm.tsx`.

**Query inicial** (server side):
- Lista de stages, rounds y teams del torneo.
- Sugerencia de próximo `external_id` por ronda (por ejemplo, si ya
  hay `wc2022_r16_001`, sugerir `wc2022_r16_002`). Si la ronda no
  tiene ningún fixture, sugerir `wc2022_<round_code>_001`. Esto es un
  pequeño helper, no es un constraint duro — el admin puede
  sobreescribirlo.

**Campos** (todos editables):
- `external_id` (text, requerido, único por torneo).
- `stage_id` (select, requerido).
- `round_id` (select, filtrado por stage; requerido).
- `group_code` (text, opcional; se permite vacío en eliminatorias).
- `home`: select team o placeholder (igual que en edit).
- `away`: idem.
- `kickoff_at` (datetime-local, requerido, en Madrid).
- `venue` (text, opcional).
- `status`: por defecto `scheduled`.

**Validaciones server side**:
- `external_id` no existe ya en `fixtures (tournament_id, external_id)`.
- `home_team_id !== away_team_id` cuando ambos son teams.
- Al menos uno de `home_team_id|home_placeholder` (idem away).
- `stage_id` y `round_id` pertenecen al torneo.
- `round.stage_id === stage_id` (el round elegido pertenece al stage
  elegido) — defensa adicional aunque el select ya filtre.

Tras éxito: redirect a `/admin/fixtures/[new_id]?ok=created`.

---

## 4. Server actions

Archivo: `src/app/admin/fixtures/actions.ts`.

```ts
"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions/requireAdmin";

// Internal Zod schemas (see §5).
import {
  UpdateFixtureSchema,
  CreateFixtureSchema,
  ImportFixturesSchema,
} from "./schemas";

export async function updateFixture(formData: FormData) { /* … */ }
export async function createFixture(formData: FormData) { /* … */ }

// Two-step: preview returns a report; commit does the upsert. Both
// receive the raw JSON text (server action over FormData) and re-run
// the same validation/resolution pipeline. Keeping it pure server
// keeps secrets/keys out of the client.
export async function previewImport(formData: FormData) { /* … */ }
export async function commitImport(formData: FormData) { /* … */ }
```

Ambas:
1. `requireAdmin()` (redirige si no es admin; lanza si no auth).
2. Parsean `formData` con Zod.
3. Convierten `kickoff_at` de Madrid local → UTC con `date-fns-tz`
   (`fromZonedTime`). Igual estrategia que usa el upload del hito 06,
   pero usando `Intl` o `date-fns-tz` que sí maneja CET/CEST.
4. Verifican constraints adicionales (uno de los dos lados puede ser
   placeholder, equipos no iguales, etc.).
5. Hacen el `update` / `insert` con el server client.
6. Si hay error: `redirect(\`?error=…\`)` al detail/new con el mensaje.
7. Si éxito: `redirect("/admin/fixtures/[id]?ok=updated")` o similar.

**No hacen falta `revalidatePath` agresivos** porque las páginas son
server components y Next 16 con App Router invalida por defecto al
hacer la siguiente navegación. Si en pruebas veo cache pegajoso, añado
`revalidatePath("/admin/fixtures")` al final.

**Nota sobre la stack de Next 16**: AGENTS.md avisa de breaking
changes. Antes de codear, leo `node_modules/next/dist/docs/` (server
actions, redirect, revalidatePath) y verifico que `redirect` desde
una server action sigue siendo el patrón estándar. Si Next 16 cambió
a otra API (p.ej. `useActionState`), me adapto entonces.

---

## 5. Schemas Zod

Archivo: `src/app/admin/fixtures/schemas.ts`.

```ts
import { z } from "zod";

const StatusSchema = z.enum(["scheduled", "locked", "completed", "cancelled"]);

// kickoff_at viene del input datetime-local en hora Madrid sin TZ.
const KickoffSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Fecha/hora inválida");

const TeamOrPlaceholderSchema = z
  .object({
    team_id: z.string().uuid().nullable(),
    placeholder: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .nullable(),
  })
  .refine((v) => v.team_id !== null || v.placeholder !== null, {
    message: "Hay que elegir equipo o escribir un placeholder",
  });

export const UpdateFixtureSchema = z.object({
  id: z.string().uuid(),
  kickoff_at: KickoffSchema,
  home: TeamOrPlaceholderSchema,
  away: TeamOrPlaceholderSchema,
  venue: z.string().trim().max(120).nullable(),
  status: StatusSchema,
});

export const CreateFixtureSchema = z.object({
  external_id: z.string().trim().min(3).max(80).regex(/^[a-z0-9_-]+$/),
  stage_id: z.string().uuid(),
  round_id: z.string().uuid(),
  group_code: z
    .string()
    .trim()
    .regex(/^[A-H]$/)
    .nullable(),
  home: TeamOrPlaceholderSchema,
  away: TeamOrPlaceholderSchema,
  kickoff_at: KickoffSchema,
  venue: z.string().trim().max(120).nullable(),
  status: StatusSchema.default("scheduled"),
});
```

Validaciones cruzadas adicionales en el server action (no en Zod
porque dependen de la DB):

- `home.team_id !== away.team_id` cuando ambos definidos.
- `round.stage_id === stage_id` (create only).
- `(tournament_id, external_id)` único (create only).
- `team.tournament_id === tournament_id` para `home.team_id` y
  `away.team_id`.

### 5.1 Schema del import por JSON pegado

```ts
// src/lib/fixtures/pythonFormat.ts
import { z } from "zod";

export const FASE_VALUES = [
  "fase_grupos",
  "octavos",
  "cuartos",
  "semis",
  "tercer_puesto",
  "final",
] as const;

export const PythonMatchSchema = z.object({
  external_id: z.string().regex(/^[a-z0-9_-]+$/).min(3).max(80),
  fase: z.enum(FASE_VALUES),
  tipo_partido: z.enum(["grupo", "eliminatoria"]).nullable(),
  jornada: z.number().int().nullable(),
  grupo: z.string().regex(/^[A-H]$/).nullable(),
  equipo_1: z.string().trim().min(1),
  equipo_2: z.string().trim().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/),
  venue: z.string().nullable().optional(),
  // Result fields are ignored if present (this hito doesn't touch
  // match_results). Allowing them keeps the schema compatible with
  // the existing Python pipeline output.
  marcador_equipo_1_90_mins: z.unknown().optional(),
  marcador_equipo_2_90_mins: z.unknown().optional(),
  prorroga: z.unknown().optional(),
  penaltis: z.unknown().optional(),
  ganador: z.unknown().optional(),
});

export const ImportFixturesSchema = z.array(PythonMatchSchema).min(1).max(64);
```

`scripts/wc2022/lib/schemas.ts` queda apuntando a este módulo
(re-export) para no duplicar reglas.

### 5.2 Pipeline de resolución del import (preview + commit)

```ts
type ResolvedFixture =
  | {
      kind: "create" | "update";
      external_id: string;
      stage_id: string;
      round_id: string;
      group_code: string | null;
      home_team_id: string | null;
      home_placeholder: string | null;
      away_team_id: string | null;
      away_placeholder: string | null;
      kickoff_at: string; // UTC ISO
      venue: string | null;
    }
  | { kind: "error"; external_id: string; reason: string };

function resolveImport(payload: PythonMatch[], ctx: {
  teamByName: Map<string, { id: string; canonical_name: string }>;
  roundByCode: Map<string, { id: string; stage_id: string }>;
  existingExternalIds: Set<string>;
}): { resolved: ResolvedFixture[]; counts: { create: number; update: number; error: number } } {
  // 1. For each row: validate Zod (done outside), then map fase/jornada to round/stage.
  // 2. Resolve equipo_1/equipo_2 to team_id or placeholder.
  // 3. Convert fecha Madrid → UTC via Intl.
  // 4. Decide kind = "update" if external_id ∈ existing, else "create".
  // 5. Collect errors per row.
}
```

El commit step usa el array `resolved` filtrando `kind !== "error"`
y hace un solo `supabase.from("fixtures").upsert(rows, { onConflict: "tournament_id,external_id" })`.

---

## 6. Helpers reutilizables

### 6.1 `src/lib/dates/madridTime.ts` (nuevo, pequeño)

```ts
export function utcToMadridLocalInput(utc: string | Date): string {
  // returns "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
}

export function madridLocalInputToUtc(local: string): string {
  // returns ISO string in UTC, e.g. "2026-06-11T16:00:00.000Z"
}

export function formatMadridDateTime(utc: string | Date): string {
  // "11/06/2026 · 18:00" for display tables
}
```

Implementación con `Intl.DateTimeFormat` (timezone `"Europe/Madrid"`)
para evitar dependencia extra. Si resulta complicado, recurro a
`date-fns-tz` (que ya está implícitamente disponible vía `date-fns`).
Mirar lo que ya hace `scripts/wc2022/lib/format.ts` y reutilizar el
patrón.

### 6.2 `src/lib/tournament/getDefaultTournament.ts` (nuevo)

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getDefaultTournament() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG!;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, slug, name")
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error(`Tournament '${slug}' not found`);
  return data;
}
```

Lo usan las tres páginas del hito. Si en hitos futuros aparece el
selector de torneo, esto se reemplaza por algo que lee de
`searchParams` o cookie.

---

## 7. Estructura de archivos final del hito

```
documentation/implementations/admin-fixtures-json-import.md  ← sustituye prompts/
  admin-fixtures-import.md                     ← prompt para ChatGPT (ver §15)

src/
  app/
    admin/
      page.tsx                                 ← (ya existe; añadir link a /admin/fixtures)
      fixtures/
        page.tsx                               ← listado
        actions.ts                             ← update/create/previewImport/commitImport
        schemas.ts                             ← Zod schemas + tipos derivados (re-exporta de lib/fixtures)
        new/
          page.tsx                             ← form de creación individual
        [id]/
          page.tsx                             ← form de edición
        import/
          page.tsx                             ← textarea + preview + confirm
          ImportClient.tsx                     ← client cmp: maneja preview/commit state
  lib/
    dates/
      madridTime.ts                            ← helpers de conversión TZ
    tournament/
      getDefaultTournament.ts                  ← helper compartido
    fixtures/
      pythonFormat.ts                          ← Zod + maps fase→stage/round (compartido con scripts/wc2022)
  components/
    ui/
      Badge.tsx                                ← (opcional) badge de estado reutilizable

scripts/wc2022/lib/
  schemas.ts                                   ← cambio: re-exporta de src/lib/fixtures
  maps.ts                                      ← cambio: idem (las constantes vivían aquí, se mueven)
```

**Decisión sobre client vs server components**:
- Las páginas (`page.tsx`) son server components. Hacen las queries.
- Los formularios pueden ser server components con `<form action={…}>`
  apuntando a server actions; eso evita JS en cliente y es coherente
  con lo que hace `/rules` y `/login`. **Plan por defecto**: ir por
  ese camino. Solo si me topo con algo que requiera `react-hook-form`
  (validación cliente compleja, mostrar errores inline rápido) creo
  un `*.Form.tsx` client component.
- Si al final no hace falta `react-hook-form`, esa dep se queda
  instalada para hitos futuros (predicciones), no la quito.

---

## 8. Estilo UI

Convenciones a copiar de lo existente (`/login`, `/register`, `/rules`,
`/dashboard`):

- Wrapper: `<main className="mx-auto max-w-5xl p-10">` (para tablas
  uso `max-w-5xl` en vez de `max-w-3xl` porque hay más columnas).
- Inputs:
  `rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900`
- Botón primario:
  `rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200`
- Botón secundario / link:
  `text-sm underline text-zinc-600 hover:text-zinc-900`
- Banner de error/ok: el mismo patrón rojo/emerald que ya usa `/rules`.
- Tabla: `<table className="w-full border-collapse text-sm">`,
  header row con `border-b border-zinc-200 dark:border-zinc-800`,
  filas con `border-b border-zinc-100 dark:border-zinc-900`.
- Badges de estado: un span pequeño con bg pastel + texto color,
  ejemplo `<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">completed</span>`.
  Mapping:
  - `scheduled` → zinc
  - `locked` → amber
  - `completed` → emerald
  - `cancelled` → rose

---

## 9. Manejo de timezones

- DB guarda `kickoff_at` como `timestamptz` en UTC (los seeds del
  hito 06 los pusieron en `2026-06-11T16:00:00Z` = 18:00 Madrid CEST).
- UI:
  - Tabla del listado: formatear con
    `Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ... })`.
    Ejemplo: `"11/06/2026 · 18:00"`.
  - Input `datetime-local` del form: presento el valor como hora
    Madrid (extraigo año/mes/día/hora/minuto via `Intl` y armo
    `"YYYY-MM-DDTHH:mm"`). Submit: convierto Madrid → UTC.
- La conversión usa el offset correcto de CET/CEST gracias a `Intl`.
  El asymmetric trick que usa `scripts/wc2022/lib/maps.ts` (offset
  hardcoded `+02:00` para junio-julio) **no la uso aquí**, porque la
  UI puede recibir fechas en otoño/invierno (CET, +01:00).

---

## 10. Pasos de ejecución

### Paso 1 · Helpers compartidos
1. Crear `src/lib/dates/madridTime.ts` con las 3 funciones.
2. Crear `src/lib/tournament/getDefaultTournament.ts`.
3. Crear `src/lib/fixtures/pythonFormat.ts` con `PythonMatchSchema`,
   `ImportFixturesSchema`, `faseToStageCode`, `resolveRoundCode`, y la
   conversión Madrid → UTC vía `Intl`.
4. Refactor scripts del hito 06: `scripts/wc2022/lib/schemas.ts` y
   `scripts/wc2022/lib/maps.ts` pasan a re-exportar desde
   `src/lib/fixtures/pythonFormat.ts`. Verificar con
   `npm run wc2022:download` (read-only contra local) que sigue
   funcionando.
5. Test smoke manual: un script `npx tsx` rápido que llama a los
   helpers (no se commitea, solo para verificar idempotencia
   round-trip de las conversiones TZ).

### Paso 2 · Listado
4. Crear `src/app/admin/fixtures/page.tsx` con la query y la tabla.
5. Soporte de filtros vía `searchParams`.
6. Badge de estado (component inline o `src/components/ui/Badge.tsx`).
7. Verificar visualmente en `localhost:3000/admin/fixtures` con
   David1 (admin) logueado.

### Paso 3 · Schemas y actions
8. Crear `src/app/admin/fixtures/schemas.ts` con los Zod.
9. Crear `src/app/admin/fixtures/actions.ts` con `updateFixture`
   y `createFixture` (esqueletos).

### Paso 4 · Edición
10. Crear `src/app/admin/fixtures/[id]/page.tsx` con la query del
    fixture + lista de teams.
11. Crear el form (inline o componente). Probar guardar:
    - Cambiar `kickoff_at` a "mañana 18:00 Madrid" → verificar que
      en la lista aparece la fecha actualizada.
    - Cambiar `venue`. Verificar.
    - Cambiar `status` a `cancelled`. Verificar badge.
12. Verificar warning visual cuando `kickoff_at` queda dentro de 24h.

### Paso 5 · Creación individual
13. Crear `src/app/admin/fixtures/new/page.tsx` y form.
14. Probar:
    - Crear un fixture eliminatorio con placeholders (sin equipo).
    - Crear un fixture con equipos resueltos.
    - Intento de `external_id` duplicado → error mostrado en banner.
    - Intento con mismo equipo home/away → error.
    - Tras crear, redirect al detail con `?ok=created`.

### Paso 6 · Importación por JSON (camino principal)
15. Crear `../implementations/admin-fixtures-json-import.md` con el prompt versionado
    (ver §15). Incluye la lista de los 32 teams de Catar 2022 y un
    ejemplo completo de output esperado.
16. Crear `src/app/admin/fixtures/import/page.tsx`: query inicial
    (teams + rounds + existing external_ids para el preview) y render
    de `ImportClient.tsx`.
17. Crear `ImportClient.tsx` (client component) con:
    - Textarea grande para pegar el JSON.
    - Botón "Validar y previsualizar" → llama a `previewImport`.
    - Render del informe con filas verde/ámbar/rojo y contadores.
    - Botón "Confirmar e insertar" (deshabilitado si hay errores)
      → llama a `commitImport`.
18. Implementar `previewImport` y `commitImport` en
    `actions.ts`. `commitImport` reaprovecha la misma función de
    resolución que `previewImport`, no confía en lo que el cliente
    devuelve.
19. Probar end-to-end:
    - Pegar un JSON de 8 octavos con equipos reales del 2022 (ej.
      Países Bajos vs Estados Unidos, Argentina vs Australia, etc.)
      y fechas en junio/julio 2026. Verificar:
      · Preview muestra 8 verdes.
      · Confirm inserta y aparecen en el listado.
      · Re-ejecutar el mismo JSON → preview muestra 8 ámbar (update),
        confirm no duplica.
    - Pegar un JSON con un equipo mal escrito ("Argntina") → 1 rojo,
      botón confirm deshabilitado.
    - Pegar un JSON con un placeholder ("Ganador A") → resuelve como
      placeholder.
    - Pegar JSON inválido (texto no parseable) → error visible.

### Paso 7 · Cosméticos
20. Añadir links "Fixtures · Editar / Crear / Importar" desde
    `/admin/page.tsx` al listado y a las tres acciones principales.
21. Añadir contadores en el header del listado (incluyendo el contador
    de fixtures bloqueados ahora — DH7-3 confirmado).
22. Pasar `npm run lint`, `npm run typecheck`, `npm run format:check`.
    Arreglar lo que salte.

### Paso 8 · Verificación funcional
23. Ejecutar `npm run wc2022:download` (read-only) para confirmar que
    los cambios hechos vía UI están en la DB y se reflejan en el diff
    contra el JSON local. Es el cierre del loop bidireccional D7.
24. Opcional: `npx tsx scripts/wc2022/download.ts --write` y commit del
    JSON actualizado, si quieres dejar el JSON local sincronizado.

### Paso 9 · Producción
25. Push a master → Vercel autodeploya.
26. Logueado como David1 (admin) en producción, repetir un par de
    smoke tests:
    - Listado carga los 48 fixtures.
    - Editar un `kickoff_at`, verificar persistencia recargando.
    - Importar un JSON pequeño (1-2 fixtures de prueba) y verificar.
      Los dejo en `status=cancelled` con `external_id` identificable
      (`wc2022_test_admin_001`) o me los borras con SQL después.

### Paso 10 · Bitácora
27. Cerrar `context/implementations/07-admin-fixtures-implementation.md`
    con todo lo registrado en paralelo durante la implementación.

---

## 11. Acceptance criteria

- [ ] `/admin/fixtures` lista los 48 fixtures, filtrable por ronda y
      estado, con fecha formateada en Madrid y contador de bloqueados.
- [ ] `/admin/fixtures/[id]` edita `kickoff_at`, equipos, placeholders,
      `venue`, `status`. Cambios persisten en Supabase.
- [ ] `/admin/fixtures/new` crea un nuevo fixture individual con todas
      sus validaciones (external_id único, equipos distintos, etc.).
- [ ] `/admin/fixtures/import` acepta un JSON pegado, muestra preview
      con verdes/ámbares/rojos, y al confirmar hace upsert masivo.
      Idempotente: re-importar el mismo JSON no duplica filas.
- [ ] `../implementations/admin-fixtures-json-import.md` existe y describe el formato
      con un ejemplo completo, incluida la lista de 32 teams para el
      torneo actual.
- [ ] Un usuario `player` no puede acceder a ninguna de las 4 rutas
      (`requireAdmin` redirige a `/dashboard`).
- [ ] Cambios hechos vía UI se reflejan en `wc2022:download` (diff
      contra el JSON local). Cierre del loop bidireccional.
- [ ] `external_id` es **read-only en la UI de edición** (sin input).
- [ ] Validación cruzada: no se acepta home y away siendo el mismo
      equipo (en edit, create y import).
- [ ] Warnings visuales: kickoff_at dentro de 24h, fixture en estado
      completed/cancelled.
- [ ] El refactor de `scripts/wc2022/lib/{maps,schemas}.ts` → re-export
      de `src/lib/fixtures/pythonFormat.ts` no rompe los scripts del
      hito 06 (`npm run wc2022:upload` y `npm run wc2022:download` siguen
      funcionando, idempotentes).
- [ ] `npm run lint`, `npm run typecheck`, `npm run format:check`
      verdes.
- [ ] Probado en producción con David1.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| API de server actions de Next 16 diferente de lo que recuerdo | Leer `node_modules/next/dist/docs/` (instrucción del AGENTS.md) antes de codear. |
| Cache pegajoso entre páginas | Usar `revalidatePath("/admin/fixtures")` al final de los server actions. |
| Conversión TZ Madrid ↔ UTC con bugs sutiles | Test manual con varias fechas (junio CEST, enero CET, cambio de horario en marzo/oct). Usar `Intl`, no offsets hardcoded. |
| Romper el constraint `home_team_id OR home_placeholder` | Validar en Zod + en el server action. Cubrir el caso "elegí equipo y placeholder a la vez": prefiero `team_id` y limpio `placeholder` a null antes de escribir, para que la fila sea coherente. |
| Romper predicciones existentes al cambiar equipos | No hay predicciones aún. TODO comentado en el código para hitos 09/14. |
| Cambiar `external_id` por error | No expongo el input en absoluto. Punto. |

---

## 13. Lo que prepara para hitos siguientes

- **Hito 08 (predicciones iniciales)**: las páginas admin de fixtures
  no le afectan directamente. Pero necesita el helper
  `getDefaultTournament` que estoy creando aquí — bien.
- **Hito 09 (predicciones de partidos)**: usará la misma tabla de
  fixtures. Cuando llegue, añadiremos a la UI admin un aviso "Este
  fixture tiene N predicciones" en la página de detalle, y se
  bloqueará el cambio de equipos si N > 0 (o se exigirá confirmación).
  No lo implemento ahora.
- **Hito 10 (resultados)**: tiene su propia ruta `/admin/resultados`,
  consumirá el mismo listado de fixtures.
- **Hito 14 (reset y reglas)**: si para entonces queremos borrar
  fixtures con predicciones, se añade allí el flow con confirmación.

---

## 14. Decisiones confirmadas tras revisión inicial

Aprobadas por el autor en la primera revisión del plan:

- DH7-1 a DH7-7: todas aprobadas tal cual.
- **No** botón duplicar fixture. En su lugar, **importación masiva
  por JSON pegado** generado por ChatGPT (ver §3.3 y §15). El form
  individual `/new` se queda como fallback de emergencia.
- **Sí** contador de fixtures bloqueados en el listado.
- **Sí** formato `wc2022_<round_code>_NNN` para `external_id`.

---

## 15. Prompt para ChatGPT (`../implementations/admin-fixtures-json-import.md`)

Contenido a versionar literal en el repo. Está pensado para que el
admin lo copie tal cual junto con su lista de partidos. El prompt:

1. Le dice a ChatGPT que es un traductor estricto a JSON.
2. Define el schema exacto con un ejemplo.
3. Lista los 32 teams válidos del torneo activo (Catar 2022 para el
   torneo `wc_2022_test`; el día que arranque 2026, el admin
   actualiza la lista en este mismo archivo).
4. Especifica las reglas duras: nombres canónicos exactos, ISO local
   Madrid, sin TZ, `external_id` con patrón `wc2022_<round>_NNN`.
5. Da ejemplos de inputs (texto natural copiado de FIFA/ESPN) y el
   output JSON esperado.
6. Le dice expresamente: "Si no estás seguro de un nombre de equipo,
   usa un placeholder (`'Ganador A'`, `'2.º grupo C'`, …) en vez de
   inventar."

El prompt vive en `../implementations/admin-fixtures-json-import.md`. Su contenido
detallado se redacta en el paso 15 de la implementación. Esqueleto:

```markdown
# Prompt: importar fixtures de eliminatorias al admin

Eres un traductor estricto de listas de partidos a un array JSON.
Devuélveme **solo** el JSON, sin texto adicional, sin markdown.

## Formato exacto

[esquema con ejemplo completo, idéntico al que documenta §3.3 del
plan 07]

## Reglas

- `external_id`: snake_case ASCII. Patrón: `wc2022_<round>_NNN`
  donde `<round>` ∈ {`r16`,`qf`,`sf`,`third`,`final`} y `NNN`
  empieza en `001`.
- `fase` ∈ {`octavos`,`cuartos`,`semis`,`tercer_puesto`,`final`}.
- `tipo_partido = "eliminatoria"` en eliminatorias.
- `jornada` y `grupo`: `null` en eliminatorias.
- `equipo_1`, `equipo_2`: usar el nombre canónico de la lista
  oficial (más abajo). Si no estás seguro de un equipo, usa un
  placeholder en español ("Ganador A", "2.º grupo C", "Ganador
  Octavos 1", etc.) en vez de inventar un nombre.
- `fecha`: ISO **sin TZ** en hora local Madrid (`"YYYY-MM-DDTHH:mm:ss"`).
  Si la fuente da la hora en otra TZ, conviértela tú.
- `venue`: si la conoces, en español; si no, `null`.

## Lista oficial de equipos (Mundial Catar 2022 — torneo wc_2022_test)

A: Qatar, Ecuador, Senegal, Países Bajos
B: Inglaterra, Irán, Estados Unidos, Gales
C: Argentina, Arabia Saudí, México, Polonia
D: Francia, Australia, Dinamarca, Túnez
E: España, Costa Rica, Alemania, Japón
F: Bélgica, Canadá, Marruecos, Croacia
G: Brasil, Serbia, Suiza, Camerún
H: Portugal, Ghana, Uruguay, Corea del Sur

## Ejemplo de entrada

> Octavos de final:
> · 3 dic — Países Bajos vs Estados Unidos, 16:00 (Madrid)
> · 3 dic — Argentina vs Australia, 20:00 (Madrid)

## Ejemplo de salida

```json
[
  {
    "external_id": "wc2022_r16_001",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Países Bajos",
    "equipo_2": "Estados Unidos",
    "fecha": "2026-06-29T16:00:00",
    "venue": null
  },
  {
    "external_id": "wc2022_r16_002",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Argentina",
    "equipo_2": "Australia",
    "fecha": "2026-06-29T20:00:00",
    "venue": null
  }
]
```

## Lo que NO debes hacer

- No añadas campos extra al JSON.
- No incluyas resultados (`marcador_*`, `ganador`, etc.) aunque los
  conozcas; la app los ignora.
- No uses comillas tipográficas (“ ” ‘ ’); solo ASCII `" "`.
- No envuelvas en markdown ni añadas explicaciones; solo el array
  JSON crudo.
```

**Cuestión abierta para 2026**: cuando arranque el torneo real, el
admin actualiza el archivo del prompt:
- Reemplaza la lista de teams por los 48 equipos del Mundial 2026.
- Cambia el slug `wc2022` por `wc2026` en `external_id` y en el
  título.
- Mantiene el resto del esquema.

Esa actualización es trivial y se hace fuera de este hito.

---

Cuando confirmes este plan actualizado, empiezo el paso 1 y voy
abriendo la bitácora en
`context/implementations/07-admin-fixtures-implementation.md`.

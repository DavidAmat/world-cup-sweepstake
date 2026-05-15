# 07 — Admin: fixtures · bitácora de implementación

> Hito en curso. Plan: `context/plan/07-admin-fixtures.md`.

## Estado

- [x] Paso 1 · Helpers compartidos (`madridTime`, `getDefaultTournament`,
      refactor `pythonFormat`).
- [x] Paso 2 · Listado `/admin/fixtures`.
- [x] Paso 3 · Schemas Zod + esqueletos de server actions.
- [x] Paso 4 · Edición `/admin/fixtures/[id]`.
- [x] Paso 5 · Creación individual `/admin/fixtures/new`.
- [x] Paso 6 · Import masivo (`prompts/`, `/admin/fixtures/import`,
      `previewImport` + `commitImport`).
- [x] Paso 7 · Cosméticos (links en `/admin`, lint/typecheck/format).
- [x] Paso 8 · Verificación funcional + roundtrip `wc2022:download`
      (resolver probado contra DB local).
- [ ] Paso 9 · Producción.
- [ ] Paso 10 · Cierre de bitácora.

## Decisiones aprobadas

- DH7-1 a DH7-7 sin cambios (ver plan §1).
- En lugar de "duplicar fixture": importación masiva por JSON pegado
  generado con ChatGPT. Prompt versionado en `prompts/`.
- Contador "X fixtures bloqueados ahora" en el listado: incluido.
- Formato `external_id` para nuevos: `wc2022_<round>_NNN`.

---

## Paso 1 · Helpers compartidos

Objetivo: dejar disponible un módulo `src/lib/fixtures/pythonFormat.ts`
que la UI del hito 07 y los scripts del hito 06 compartan. Mover ahí
los Zod del formato Python y los mapas `fase ↔ stage/round`. Crear
también `src/lib/dates/madridTime.ts` con la conversión Madrid ↔ UTC
usando `Intl` (no offsets hardcoded como en `scripts/wc2022/lib/maps.ts`).

Archivos creados:

- `src/lib/dates/madridTime.ts`: 4 helpers (`madridLocalToUtcIso`,
  `utcIsoToMadridLocal`, `utcIsoToMadridInput`, `formatMadridDateTime`).
  Conversión Madrid → UTC vía `Intl.DateTimeFormat` con
  `timeZoneName: "shortOffset"`. Detecta CET/CEST automáticamente con
  un segundo paso para cubrir el cruce DST. Acepta input
  `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SS` o `YYYY-MM-DDTHH:MM`.
- `src/lib/fixtures/catalogs.ts`: STAGES + ROUNDS + types movidos del
  script al módulo compartido.
- `src/lib/fixtures/pythonFormat.ts`: Zod (`PythonMatchSchema`,
  `PythonMatchesSchema`, `ImportFixturesSchema` con cap 1..64) +
  mapeos `fase↔stage`, `(fase, jornada)→round`, `stage→fase`,
  `round→jornada`, `tipoPartidoFromFase`.
- `src/lib/tournament/getDefaultTournament.ts`: helper server-only que
  resuelve el torneo activo desde `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`.

Archivos del hito 06 convertidos en re-exports thin para que los
scripts `wc2022:upload` / `wc2022:download` sigan funcionando sin
cambios en el código que los consume:

- `scripts/wc2022/lib/catalogs.ts` → re-export de `src/lib/fixtures/catalogs`.
- `scripts/wc2022/lib/schemas.ts` → mantiene `TournamentSchema`/`TeamSchema`
  (seeder-only), re-exporta `PythonMatch*` desde `src/lib/fixtures/pythonFormat`.
- `scripts/wc2022/lib/maps.ts` → re-export de `pythonFormat` (fase maps)
  y `madridTime` (`madridLocalToUtcIso`).
- `scripts/wc2022/lib/format.ts` → re-export de `pythonFormat`
  (inverse maps) y `madridTime` (`utcIsoToMadridLocal`).

Verificación end-to-end del refactor (Supabase local levantado):

```
npm run typecheck    # verde
npm run wc2022:download   # diff 0/0/0 contra el JSON local
npm run wc2022:upload     # idempotente (48 fixtures, 0 skipped)
npm run wc2022:download   # diff 0/0/0
```

El round-trip confirma que la conversión nueva (Intl) produce las
mismas UTC ISO que la vieja (offset hardcoded `+02:00`) para los 48
fixtures de junio 2026 (CEST). Ningún campo cambió en la DB.

## Paso 2 · Listado `/admin/fixtures`

Archivos creados:

- `src/components/ui/Badge.tsx` con `Badge` (5 tonos zinc/amber/
  emerald/rose/sky) y wrapper `FixtureStatusBadge` que mapea
  `status` → tono + label en español.
- `src/app/admin/fixtures/page.tsx`: server component con:
  - `requireAdmin()` + `getDefaultTournament()`.
  - Query principal con joins a `home_team`, `away_team`, `stage`,
    `round` por explicit FK name (necesario porque hay dos FKs entre
    fixtures y teams).
  - Filtros vía `searchParams` (`round`, `status`). El filtro de
    ronda hace un lookup adicional `rounds` → `id` antes de filtrar
    `round_id`, para no acoplar la URL a UUIDs.
  - Segunda query agregada (`status, kickoff_at` solamente) para
    calcular contadores totales (no afectados por filtros), incluido
    `lockedByKickoff` = fixtures con `kickoff_at - 24h <= now`.
  - Banners de éxito por `?ok=created|updated|imported:<text>`.
  - Tabla con columnas ronda, external_id (linkado a edit), partido
    (placeholder italic gris si no hay team), fecha Madrid, badge de
    estado, link "Editar".
  - Botones "Importar JSON" (primario) y "Nuevo fixture" (secundario)
    en el header.

Probado con `curl http://localhost:3000/admin/fixtures` → `307` al
login (sin auth), confirma que la ruta existe y el middleware `proxy`
le pasa el filtro de auth correctamente.

## Incidente · "fetch failed" al registrar usuarios en local

Durante el smoke test del usuario, el POST a `/register` devolvía
`?error=fetch%20failed` (303). Diagnóstico:

- `.env.local` tenía `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  (puesto así "por portabilidad", confiando en que los scripts
  wc2022:* lo auto-reescriben a la IP LAN — pero **la app Next no
  tiene ese rewrite**).
- Comprobado empíricamente: `curl`/`node fetch` a `127.0.0.1:54321`,
  `localhost`, `[::1]`, `0.0.0.0` → connection refused instantáneo.
  Solo `192.168.0.112:54321` → 200. (Docker mapea `0.0.0.0:54321` y
  `[::]:54321` pero el host no alcanza loopback; quirk de este Docker
  Desktop, ya documentado en hitos 03/06.)
- Por tanto cualquier llamada server-side a Supabase (signUp,
  getClaims, queries) fallaba con `fetch failed`. Bug latente desde
  el hito 05; no se había probado el registro en local hasta ahora.

Fix: `.env.local` → `NEXT_PUBLIC_SUPABASE_URL=http://192.168.0.112:54321`
(fichero gitignored, cambio local, no afecta a prod/Vercel). Comentario
del fichero actualizado avisando del caveat DHCP (si cambia la IP LAN,
actualizar esta línea **y** `scripts/wc2022/lib/env.ts`). Dev server
reiniciado (Next lee env al arrancar).

Verificación: `/register` pasa de fallar a `200`; creados David1
(admin) y David2 (player) vía admin API — el trigger `handle_new_user`
del hito 05 generó los profiles automáticamente y se ajustaron los
roles. Esto confirma end-to-end que la app alcanza Supabase Auth.

> Deuda: el `.env.local` con IP LAN hardcodeada es frágil ante DHCP y
> no reproducible en un clone limpio. Arreglo de raíz (hacer que
> Supabase/Docker exponga 127.0.0.1, o un rewrite en el cliente de la
> app análogo al de los scripts) queda fuera del hito 07 — anotado
> para hito 16 (despliegue/CI) o cuando estorbe.

## Incidente · "hydration mismatch" al filtrar por r16

Tras importar los 8 octavos (import OK) y filtrar por r16, el
navegador mostraba el warning de React 19 "A tree hydrated but some
attributes of the server rendered HTML didn't match".

Diagnóstico (log del dev server): el único nodo divergente es el
`<html>`, con un atributo `data-scribe-recorder-ready="true"`
**inyectado por una extensión del navegador** (grabador tipo Scribe),
no presente en el HTML del servidor. No es un bug del código; el
import y el listado funcionan. Falso positivo típico de extensiones
que mutan `<html>`/`<body>` (Grammarly, gestores de contraseñas,
grabadores, etc.).

Fix: `suppressHydrationWarning` en el `<html>` de
`src/app/layout.tsx`. Suprime solo los atributos/text de ESE elemento
(no es recursivo), así que un mismatch real en nuestros componentes
seguiría avisando. Es el patrón documentado por Next/React para este
caso. typecheck/lint/format verdes.

## Incidente · player en /admin/fixtures → 404 en vez de /dashboard

Con David2 (player), `/admin/fixtures` daba 404 "This page could not
be found." en vez de redirigir a `/dashboard`.

Diagnóstico (log dev server): `requireAdmin()` hacía
`redirect("/dashboard")` pero la request acababa en
`GET /dashboard/fixtures 404`. Causa: las páginas con `connection()`
son dinámicas/streamed; según los docs de Next 16, `redirect()` en
contexto de streaming emite un **redirect client-side vía meta-tag**
que resuelve mal los paths anidados (mantiene el último segmento
`fixtures`, de ahí `/dashboard/fixtures`). Los docs recomiendan
explícitamente hacer redirects de auth **en el Proxy, antes del
render** (`NextResponse.redirect`).

Fix: gate de `/admin` movido a `src/proxy.ts`. Tras `getClaims()`, si
`pathname` empieza por `/admin`: sin sesión → `307 /login`; con
sesión pero `profile.role !== 'admin'` → `307 /dashboard`. Es un
redirect de servidor limpio y absoluto, sin el problema de streaming.
`requireAdmin()` se mantiene en las páginas como defensa en
profundidad.

Verificado con login real (script throwaway, `redirect: "manual"`):

```
David2 (player): status=307 location=/dashboard
David1 (admin) : status=200 location=(none)
anon           : status=307 location=/login
```

> Nota: `requireAuth`/`requireAdmin` siguen usando `redirect()` y
> tendrían el mismo riesgo de mis-resolución en streaming para otros
> flujos (p.ej. sesión caducada en `/admin`). Como el Proxy ahora
> intercepta `/admin/*` antes del render, deja de ser el camino
> activo para esas rutas. Endurecer el resto queda fuera del hito 07.

## Pasos 3-5 · Schemas, actions, edición y creación individual

- `src/app/admin/fixtures/schemas.ts`: Zod
  (`UpdateFixturePayloadSchema`, `CreateFixturePayloadSchema`) +
  helpers `readUpdatePayload`/`readCreatePayload` que coercen
  `FormData` (todo llega como string). Regla clave: si vienen
  `team_id` y `placeholder` a la vez, gana `team_id` y se anula el
  placeholder, para no violar el check `team OR placeholder`.
- `src/app/admin/fixtures/actions.ts`: `updateFixture` y
  `createFixture`. Validan, comprueban equipos distintos,
  consistencia round↔stage (create), unicidad de `external_id`
  (create), convierten kickoff Madrid→UTC, persisten con el server
  client (RLS admin), `revalidatePath` y redirect con `?ok=` / `?error=`.
- `src/app/admin/fixtures/[id]/page.tsx`: edición. Server component +
  `<form action={updateFixture}>`. `external_id`/fase/ronda/grupo en
  read-only; editables kickoff (datetime-local en Madrid), equipo o
  placeholder por lado, venue, status. Warnings: dentro de 24h del
  kickoff y estado completed/cancelled.
- `src/app/admin/fixtures/new/page.tsx`: creación individual. Selects
  de stage/round/teams; hint del patrón `wc2022_<round>_NNN`.

## Paso 6 · Importación masiva por JSON

- `prompts/admin-fixtures-import.md`: prompt versionado para ChatGPT.
  Schema exacto, lista de los 32 equipos de Catar 2022, reglas duras
  (snake_case external_id, fecha Madrid ISO sin TZ, placeholders en
  vez de inventar), ejemplo input→output, plantilla para 2026.
- `src/app/admin/fixtures/_import.ts`: lógica pura compartida por
  preview y commit. `parseImportPayload` (JSON.parse + Zod
  `ImportFixturesSchema` cap 1..64), `buildTeamLookup`,
  `resolveImport` (mapea fase→stage/round, resuelve equipo por
  display/canonical/alias, detecta placeholders, convierte TZ,
  decide create vs update por `external_id` existente).
- `src/app/admin/fixtures/actions.ts`: `previewImport`
  (`useActionState`, devuelve report sin tocar DB) y `commitImport`
  (re-resuelve server-side, rechaza si hay errores, upsert masivo
  `onConflict tournament_id,external_id`, redirect a la lista con
  `?ok=imported:`).
- `src/app/admin/fixtures/import/{page.tsx,ImportClient.tsx}`:
  textarea + botón validar (preview verde/ámbar/rojo + contadores) +
  botón confirmar (deshabilitado si hay errores). `<details>` con
  el formato esperado.

### Detección de placeholders (bug encontrado y corregido)

Primera versión usaba `/^[12]\.?\s?º\b/i`. El `\b` junto a `º`
(no word-char) no casa, así que `"2.º Grupo C"` se marcaba error.
Reescrito a heurística robusta: es placeholder si empieza por dígito,
o contiene la palabra `grupo`/`group`, o empieza por uno de los
prefijos conocidos (ganador/perdedor/segundo/…/winner/runner-up/tbd),
o empieza por `?`. Un nombre de equipo real nunca cumple eso.

### Verificación del resolver (script throwaway contra DB local)

Payload de prueba con 5 filas: 2 octavos con equipos reales, 1 con
typo (`Argntina`), 1 con placeholders (`Ganador A` vs `2.º Grupo C`),
1 reusando un `external_id` de fase de grupos existente.

```
counts: {"create":3,"update":1,"error":1,"total":5}
  [create] wc2022_r16_001  Países Bajos vs Estados Unidos  kickoff=...T14:00:00Z (CEST OK)
  [create] wc2022_r16_002  Argentina vs Australia
  [ERROR]  wc2022_r16_typo  "Argntina" no reconocido ni placeholder
  [create] wc2022_r16_ph   Ganador A vs 2.º Grupo C  (ambos placeholder)
  [update] wc2022_group_a_md1_001  Catar vs Ecuador  (external_id existente)
```

Conversión TZ correcta: `18:00 Madrid` → `16:00Z`, idéntica a los
seeds del hito 06.

## Paso 7 · Cosméticos

- `src/app/admin/page.tsx`: tarjeta-link a `/admin/fixtures` +
  placeholder de "próximamente" para hitos 10/11/14.
- `src/components/ui/Badge.tsx` (creado en paso 2): badges de estado.
- Lint nuevo de Next 16 (`react-hooks/purity`) marca `Date.now()` en
  server components. Solución: `await connection()` (de `next/server`)
  para forzar render dinámico con Cache Components + un
  `eslint-disable-next-line react-hooks/purity` justificado en las dos
  líneas que calculan la ventana de bloqueo de 24h. Documentado por
  si reaparece en hitos posteriores.
- `npm run typecheck`, `lint`, `format:check`: verdes. Roundtrip
  `wc2022:download` sigue 0/0/0 tras todo el hito.


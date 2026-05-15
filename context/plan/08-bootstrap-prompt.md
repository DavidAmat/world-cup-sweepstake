Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 6 hitos
cerrados (02-07). Ahora toca el hito 08: predicciones iniciales
(campeón, subcampeón, pichichi, mejor jugador, clasificados de grupo)
con su vista pública.

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# QUÉ HITO ES Y DÓNDE ESTÁ DEFINIDO TÉCNICAMENTE

- **Hito 08 — Predicciones iniciales.**
- Definición técnica de alto nivel (la fuente para escribir el plan
  detallado):
  - `context/plan/01-plan.md` §7, sección "Hito 08 — Predicciones
    iniciales" (scope, lock, vista pública, acceptance).
  - `context/initial-setup/02-pid.md`: §5.4 (predicciones iniciales),
    §5.5 (vista pública comparativa), §6.3 (criterios de scoring
    iniciales — solo para entender qué se puntuará en hito 11, no se
    implementa scoring aquí), §4.2 (tablas `initial_predictions` y
    `group_qualification_predictions`).
- El **plan detallado lo escribes tú** al empezar, en
  `context/plan/08-initial-predictions.md` (NO existe aún; crearlo es
  tu primer entregable, igual que se hizo con el 07). Yo lo reviso y
  te digo "adelante".
- La bitácora se va llenando en
  `context/implementations/08-initial-predictions-implementation.md`.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. `context/initial-setup/02-pid.md`
   Project Initiation Document. Fuente de verdad funcional. Mira
   §5.4, §5.5, §6.3 y §4.2.

2. `context/plan/01-plan.md`
   Índice maestro de los 17 hitos. Léelo entero — sobre todo §6
   (roadmap) y §7 (resumen por hito, en particular Hito 08).

3. Bitácoras de los hitos cerrados (qué se hizo, qué se decidió, qué
   falló). La del 06 y la del 07 son críticas:
   - `context/implementations/02-project-setup-implementation.md`
   - `context/implementations/03-supabase-local-and-migrations-implementation.md`
   - `context/implementations/04-database-schema-implementation.md`
   - `context/implementations/05-auth-and-profiles-implementation.md`
   - `context/implementations/06-seed-and-import-master-data-implementation.md`
   - `context/implementations/07-admin-fixtures-implementation.md`
     ↑ documenta helpers compartidos creados, gotchas de Next 16, y
     el patrón de gate de auth (lecciones que aplican al hito 08).

4. Planes detallados de los hitos 06 y 07 (modelo de datos vivo):
   - `context/plan/06-seed-and-import-master-data.md` (§10, §11).
   - `context/plan/07-admin-fixtures.md` (decisiones DH7, helpers).

# RESUMEN DE LOS HITOS CERRADOS

Hito 02 — Project setup
  Next.js 16 + TS + Tailwind v4 + ESLint + Prettier + Turbopack.
  Estructura en src/{app,components,lib,styles}. Deps: @supabase/ssr,
  @supabase/supabase-js, zod, react-hook-form, lucide-react, date-fns.

Hito 03 — Supabase local + migraciones
  Supabase CLI. config.toml con [analytics] disabled. Clientes en
  src/lib/supabase/{client,server,admin}.ts. src/proxy.ts (Next 16
  renombró middleware → proxy) refresca sesión con auth.getClaims().

Hito 04 — Esquema de base de datos
  5 migraciones SQL → 17 tablas. Helpers SQL: is_admin(),
  is_fixture_locked(uuid), set_updated_at(). RLS aplicada local+prod.
  Tablas relevantes para el hito 08: `initial_predictions`,
  `group_qualification_predictions`, `tournaments`
  (`predictions_open_until`, `group_qualifiers_per_group`), `teams`.

Hito 05 — Auth + profiles + roles
  Trigger handle_new_user (SECURITY DEFINER) crea profile al
  registrarse. Páginas /login /register /rules en español + server
  actions. Helpers requireAuth() y requireAdmin() en
  src/lib/permissions/ con auth.getClaims(). Header dinámico.

Hito 06 — Seeds e importación de master data
  `data/seeds/wc_2022/{tournament,teams}.json`. `strip_results_2022.py`
  → `data/partidos/2022/partidos_2022_sin_resultados.json` (48 partidos
  de grupos, fechas a junio 2026 18:00 Madrid). Scripts
  `scripts/wc2022/{upload,download}.ts` (tsx+Zod+admin). npm:
  `wc2022:upload`, `wc2022:download`. Sync bidireccional JSON↔Supabase,
  key estable `external_id`.

Hito 07 — Admin: fixtures (CERRADO)
  Plan: `context/plan/07-admin-fixtures.md`
  Bitácora: `context/implementations/07-admin-fixtures-implementation.md`
  Qué hay:
  - Páginas admin: `/admin/fixtures` (listado filtrable + contadores,
    incl. "bloqueados ahora"), `/admin/fixtures/[id]` (edición),
    `/admin/fixtures/new` (creación individual),
    `/admin/fixtures/import` (importación masiva por JSON pegado).
  - `prompts/admin-fixtures-import.md`: prompt versionado para que
    ChatGPT genere el JSON de eliminatorias; la UI lo importa con
    preview + upsert idempotente por `external_id`.
  - **Helpers nuevos reutilizables en el hito 08**:
    - `src/lib/dates/madridTime.ts` — `madridLocalToUtcIso`,
      `utcIsoToMadridLocal`, `utcIsoToMadridInput`,
      `formatMadridDateTime`. Conversión Madrid↔UTC con `Intl`
      (CET/CEST automático). Úsalo para cualquier fecha en UI.
    - `src/lib/tournament/getDefaultTournament.ts` — resuelve el
      torneo activo desde `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`.
      Úsalo en todas las páginas del hito 08.
    - `src/lib/fixtures/{pythonFormat,catalogs}.ts` — Zod del formato
      Python + catálogos STAGES/ROUNDS (compartidos con los scripts).
    - `src/components/ui/Badge.tsx` — badges de estado reutilizables.
  - Patrón de auth: el gate de `/admin/*` vive en `src/proxy.ts`
    (redirect de servidor antes del render). `requireAdmin()` se
    mantiene en las páginas como defensa en profundidad. **Para el
    hito 08 las rutas son de jugador, NO /admin: usa `requireAuth()`
    y, si hace falta lock global, una comprobación de fecha.**
  - Gotcha Next 16: `connection()` + eslint-disable puntual para
    `Date.now()` en server components (regla `react-hooks/purity`).
    Replícalo si calculas el lock de predicciones en un server
    component.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 08

Vinculantes. No las cuestiones sin un motivo muy fuerte.

D2 (de hito 06) — **No hay tabla `players`** (queda vacía). El
pichichi y el mejor jugador del Mundial se gestionan como **texto
libre**, validados manualmente por el admin al final del torneo (los
amigos escribirán "Messi", "L. Messi", "leo messi" y todo cuenta como
Messi en hito 11). Implicación dura para el hito 08: las columnas
`initial_predictions.top_scorer_player_id` y `.best_player_id` son
FKs a `players` y quedan inservibles. **Tienes que decidir y proponer
una migración SQL** (texto libre: p.ej. columnas
`top_scorer_text` / `best_player_text`, o una tabla aparte). La
migración la propones, yo la reviso, y se aplica con `db:reset` local
+ `db:push` prod una vez aprobada. Tras migración: `npm run types:gen`.

D3 (de hito 06) — `tournaments.predictions_open_until = null` para
`wc_2022_test`. **El lock de las predicciones iniciales se decide en
este hito 08.** Default sugerido en el plan §7: `min(kickoff_at) - 24h`
calculado on-the-fly. Tú propones la regla concreta en el plan
detallado.

Clasificados de grupo — `tournaments.group_qualifiers_per_group = 2`
para `wc_2022_test` (2 clasificados por grupo, 8 grupos A-H, 4 equipos
por grupo). Tabla `group_qualification_predictions` (`group_code`,
`team_id`, `predicted_position` opcional). Mira PID §4.2 y §6.3.

Vista pública (PID §5.5) — una "card" por usuario (scroll vertical, NO
dropdown de usuarios), con dropdown por **categoría** (campeón /
subcampeón / pichichi / mejor jugador / clasificados). Solo visible
cuando las predicciones estén bloqueadas globalmente o ya empezado el
torneo. Rutas en español tipo `/predicciones/iniciales` y
`/predicciones/iniciales/publicas` (ficheros en inglés bajo
`app/(app)/predictions/initial/...` está bien).

# ESTADO DE INFRAESTRUCTURA Y URLS
Repo:        github.com/DavidAmat/world-cup-sweepstake (público)
Branch:      master (commits directos, no PR)
Vercel:      https://world-cup-sweepstake-mu.vercel.app
Supabase:    project_ref qbphxsijmqortxhxlrnr (region EU West, free tier)

Local Supabase:
  - API/DB escuchan SOLO en 192.168.0.112 (NO 127.0.0.1; curl a
    127.0.0.1:54321 → connection refused; quirk de este Docker).
  - **`.env.local` ya apunta a `http://192.168.0.112:54321`** (se
    cambió en hito 07: la app Next hace fetch server-side sin rewrite,
    y con 127.0.0.1 fallaba todo con "fetch failed"). Si tu IP LAN
    cambia (DHCP) hay que actualizar `.env.local` Y
    `scripts/wc2022/lib/env.ts`.
  - Studio: http://192.168.0.112:54323
  - psql: PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres

Env vars (Vercel Production+Preview / .env.local local):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     (sb_publishable_*)
  SUPABASE_SECRET_KEY                       (sb_secret_*)
  NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test

Gotchas de Next 16 ya resueltos (replícalos, no los redescubras):
  - `redirect()` dentro de un server component en streaming emite un
    redirect client-side que mis-resuelve paths anidados. Los gates de
    auth/redirect van en `src/proxy.ts` (antes del render). Para
    estados read-only (predicción bloqueada) mejor renderiza la vista
    en modo lectura que redirigir.
  - `Date.now()`/`Math.random()` en server components → regla
    `react-hooks/purity`. Usa `await connection()` (de `next/server`)
    + `eslint-disable-next-line react-hooks/purity` justificado.
  - `<html>` lleva `suppressHydrationWarning` (extensiones de
    navegador inyectan atributos). No lo quites.

Datos cargados:
  - **Producción**: torneo `wc_2022_test` (is_test=true, active),
    32 teams, 48 fixtures de fase de grupos. Sin match_results,
    sin predicciones.
  - **Local**: lo mismo + 8 fixtures de octavos `wc2022_r16_001..008`
    importados durante el test del hito 07. Existen SOLO en local, no
    en prod. El JSON de origen está versionado en
    `context/fixtures/octavos.json` (el usuario pidió mantenerlo). Si
    necesitas local == prod para el hito 08, coméntalo antes de
    borrar nada.

Usuarios en LOCAL (creados vía admin API en hito 07; el trigger
handle_new_user generó los profiles):
  - David1 — david1@gmail.com / david1david1 — role=admin
  - David2 — david2@gmail.com / david2david2 — role=player
  En producción: David1 (admin, promovido vía SQL). Credenciales fake
  en `context/usuarios/01-fake-users.json`.

# COMANDOS HABITUALES

Local dev:
  npm run dev                # Next en localhost:3000
  npm run db:start / db:stop / db:status
  npm run db:reset           # reaplica migraciones (vacía la DB; re-seed con wc2022:upload)
  npm run types:gen          # regenera src/lib/supabase/database.types.ts (tras una migración)
  npm run db:diff            # supabase db diff -f  (para crear migraciones)

Sync de datos:
  npm run wc2022:upload      # JSON local → Supabase (idempotente)
  npm run wc2022:download    # Supabase → diff vs JSON local (read-only)

Verificación:
  npm run typecheck && npm run lint && npm run format:check && npm run build

A producción (cuidado, pide confirmación antes):
  npm run db:push            # supabase db push --linked  (migraciones)
  git push origin master     # Vercel autodeploya

# TAREA: HITO 08 — PREDICCIONES INICIALES

Objetivo: cada usuario registra (una sola vez, editable hasta el lock)
sus predicciones iniciales del torneo, y existe una vista pública
comparativa. Sin scoring todavía (eso es hito 11).

Pasos generales (sujetos a tu propio plan detallado en
`context/plan/08-initial-predictions.md`):

1. Leer PID §5.4/§5.5/§6.3/§4.2 y `01-plan.md` §7 hito 08.
2. **Resolver la deuda D2 con una migración SQL**: las columnas
   `initial_predictions.top_scorer_player_id`/`.best_player_id` son
   FKs a `players` (vacía). Propón el cambio a texto libre (p.ej.
   `top_scorer_text` / `best_player_text`). La propones en el plan,
   la reviso, y se aplica db:reset local + db:push prod tras OK.
   Tras migración: `npm run types:gen`.
3. Diseñar el formulario `/predicciones/iniciales`:
   - Campeón y subcampeón: select sobre `teams` del torneo.
   - Pichichi y mejor jugador: input de **texto libre** (D2).
   - Clasificados de grupo: 2 por grupo (A-H) según
     `tournaments.group_qualifiers_per_group`. Tabla
     `group_qualification_predictions`. `predicted_position`
     opcional — decide en el plan si se captura el orden (afecta a
     hito 11; por ahora solo guardar el dato).
   - Validación Zod + react-hook-form (precedente en hitos 05/07).
4. Lock: definir la regla (default `min(kickoff_at) - 24h` o
   `tournaments.predictions_open_until`). Tras el lock: solo lectura.
   El gate NO es /admin → usa `requireAuth()` + comprobación de
   fecha; recuerda el gotcha de `redirect()` en streaming (renderiza
   read-only en vez de redirigir cuando esté bloqueado).
5. Vista pública `/predicciones/iniciales/publicas`: card por usuario,
   dropdown por categoría, solo visible tras el lock global. Decide
   la política de visibilidad (RLS / consulta) en el plan.
6. UI en español, coherente con /login, /register, /rules,
   /dashboard, /admin/fixtures. Reutiliza `getDefaultTournament`,
   `madridTime`, `Badge`.
7. Probar en local con David1/David2. Push a master → Vercel.
8. Documentar en `context/implementations/08-...-implementation.md`
   en paralelo, no al final.

# CÓMO TRABAJAS CONMIGO

- Antes de implementar, escribes el plan detallado en
  `context/plan/08-initial-predictions.md`. Yo lo reviso. Si veo
  algo te lo digo; si no, te digo "adelante".
- Mientras implementas, vas registrando avances/decisiones/errores
  en `context/implementations/08-...-implementation.md`. No la
  pospongas para el final.
- Commits: 1 por unidad coherente. Conventional Commits en inglés.
  Co-authored-by Claude. Push automático a master tras cada commit,
  no preguntes cada vez.
- Pide confirmación antes de: acciones destructivas, push a prod de
  una migración SQL, crear/borrar recursos en Supabase/Vercel,
  borrar datos con predicciones asociadas.
- Si un comando bash necesita interacción humana (passwords, prompts
  Y/n, login), pásamelo para ejecutarlo yo y dime qué buscar.
- Si te encuentras editando un fichero modificado por mí o tras un
  format/lint, vuelve a leerlo antes de tocarlo.
- Toda migración SQL: la propones, la reviso, y la aplicas con
  db:reset local + db:push prod una vez aprobada. Regenera tipos.

# EMPIEZA AQUÍ

1. Lee la sección "LEE ESTO ANTES DE NADA" (sobre todo PID
   §5.4/§5.5/§4.2 y la bitácora del hito 07).
2. Inspecciona el estado: `npm run wc2022:download` (read-only) y
   mira las tablas `initial_predictions` /
   `group_qualification_predictions` / `tournaments` en Studio.
3. Escribe el plan detallado del hito 08 en
   `context/plan/08-initial-predictions.md` — incluyendo la propuesta
   de migración para D2. No implementes todavía.
4. Pídeme aprobación.
5. Una vez aprobado, ejecuta paso a paso siguiendo las convenciones
   de los hitos previos.

Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 5 hitos
cerrados (02-06). Ahora toca el hito 07: páginas admin para ver/editar
fixtures (la gestión de jugadores está descartada — ver D2 más abajo).

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

# LEE ESTO ANTES DE NADA

En este orden, hasta entender el estado actual:

1. context/initial-setup/02-pid.md
   Project Initiation Document. Visión, decisiones cerradas, modelo de
   datos, sistema de puntuación. Es la fuente de verdad funcional.

2. context/plan/01-plan.md
   Índice maestro de los 17 hitos. Léelo entero — especialmente §6
   (roadmap) y §7 (resumen por hito). Te dirá dónde encaja el hito 07.
   Aviso: el §7 hito 07 menciona /admin/players. Eso ya NO va. Solo
   /admin/fixtures (ver decisión D2 más abajo).

3. Bitácoras de los hitos cerrados (qué hice, qué decidí, qué falló):
   - context/implementations/02-project-setup-implementation.md
   - context/implementations/03-supabase-local-and-migrations-implementation.md
   - context/implementations/04-database-schema-implementation.md
   - context/implementations/05-auth-and-profiles-implementation.md
   - context/implementations/06-seed-and-import-master-data-implementation.md
     ↑ esta bitácora es CRÍTICA para el hito 07: documenta el modelo
     de sync bidireccional JSON ↔ Supabase, las decisiones D1-D7, y
     deja comandos listos (`wc2022:upload`, `wc2022:download`).

4. Plan detallado del hito anterior (06), por si te ayuda entender el
   modelo de datos vivo:
   - context/plan/06-seed-and-import-master-data.md
     Especialmente §11 (sync bidireccional) y §10 (workflow de
     eliminatorias). El hito 07 hereda este modelo.

5. Cuando arranques con la implementación, escribirás:
   - context/plan/07-admin-fixtures.md  (plan detallado)
   - context/implementations/07-admin-fixtures-implementation.md
     (bitácora, se va llenando mientras implementas)

# RESUMEN DE LOS HITOS CERRADOS

Hito 02 — Project setup
  Plan: context/plan/02-project-setup.md
  Bitácora: context/implementations/02-project-setup-implementation.md
  Qué hay: Next.js 16 + TypeScript + Tailwind v4 + ESLint + Prettier +
  Turbopack. Estructura en src/{app,components,lib,styles}. Vercel
  enlazado. Deps core: @supabase/ssr, @supabase/supabase-js, zod,
  react-hook-form, lucide-react, date-fns.

Hito 03 — Supabase local + migraciones
  Plan: context/plan/03-supabase-local-and-migrations.md
  Bitácora: context/implementations/03-supabase-local-and-migrations-implementation.md
  Qué hay: Supabase CLI 2.98.2. supabase/config.toml con [analytics]
  disabled. Tres clientes Supabase en src/lib/supabase/{client,server,
  admin}.ts. src/proxy.ts (Next 16 renombró middleware → proxy)
  refresca sesión con auth.getClaims(). Proyecto Supabase prod
  enlazado. Env vars en Vercel.

Hito 04 — Esquema de base de datos
  Plan: context/plan/04-database-schema.md
  Bitácora: context/implementations/04-database-schema-implementation.md
  Qué hay: 5 migraciones SQL → 17 tablas. Helpers SQL: is_admin(),
  is_fixture_locked(uuid), set_updated_at(). 49 policies de RLS
  aplicadas en local y prod.

Hito 05 — Auth + profiles + roles
  Plan: context/plan/05-auth-and-profiles.md
  Bitácora: context/implementations/05-auth-and-profiles-implementation.md
  Qué hay: trigger handle_new_user (SECURITY DEFINER) crea profile al
  registrarse. Páginas /login y /register en español + server actions.
  Helpers requireAuth() y requireAdmin() con auth.getClaims(). Header
  dinámico. /rules con flujo de aceptación (rules_version=0
  placeholder hasta hito 11). translateAuthError → mensajes en
  español.

Hito 06 — Seeds e importación de master data
  Plan: context/plan/06-seed-and-import-master-data.md
  Bitácora: context/implementations/06-seed-and-import-master-data-implementation.md
  Qué hay (resumen):
  - `data/seeds/wc_2022/{tournament,teams}.json` (catálogos canónicos).
  - `data/raw/strip_results_2022.py` produce
    `data/partidos/2022/partidos_2022_sin_resultados.json` (48 partidos
    de fase de grupos, fechas rebasadas a junio 2026 18:00 Madrid).
  - `scripts/wc2022/upload.ts` y `download.ts` con tsx + Zod + admin
    client. Idempotente vía upsert por `external_id` /
    `(tournament_id, code)`.
  - npm scripts: `wc2022:upload`, `wc2022:download`.
  - **Local y producción cargados con**: 1 tournament `wc_2022_test`,
    6 stages, 8 rounds, 32 teams, 48 fixtures, 0 match_results,
    0 players. Distribución: 16/16/16 fixtures por jornada de grupos.

# DECISIONES CERRADAS QUE AFECTAN AL HITO 07

Estas decisiones se tomaron durante el hito 06 y son **vinculantes**
para el hito 07. No las cuestiones a menos que tengas un motivo muy
fuerte.

D1 — **Solo fase de grupos al inicio.** Los 48 fixtures cargados son
todos de `fase_grupos`. Las 16 eliminatorias se añaden al JSON Python
neutro por el admin (o las creará desde la UI admin si decidimos
hacerlo en este hito), y luego `wc2022:upload` las inserta. La
identidad por `external_id` garantiza que las predicciones existentes
no se rompen.

D2 — **No hay tabla `players`** (queda vacía). El pichichi y el mejor
jugador se gestionarán como texto libre en hito 08, validados
manualmente por el admin al final del torneo (los amigos escribirán
"Messi" o "L. Messi" o "leo messi" y todo cuenta como Messi). Por
tanto en este hito 07 **no implementamos /admin/players**, aunque el
plan §7 hito 07 lo mencione. Las columnas
`initial_predictions.top_scorer_player_id` y `.best_player_id` quedan
como deuda técnica nullable hasta hito 08.

D3 — `tournaments.predictions_open_until = null` para `wc_2022_test`.
El lock global de predicciones iniciales se decide en hito 08.

D4 — `tsx@^4.21.0` instalado como devDependency. Úsalo si necesitas
correr scripts TS adicionales.

D5 — Para apuntar a producción desde scripts: env vars inline + flag
`--confirm-prod`. Nunca `.env.local` editado a mano.

D6 — **Las fechas son inventadas para 2026.** Todos los kickoffs
están en `2026-06-11` … `2026-06-23` a las `18:00` Madrid local
(rebase determinista del calendario 2022 desde
`strip_results_2022.py`). Para testear el bloqueo de 24h **el admin
puede editar el JSON manualmente** o usar la UI que vas a construir
en este hito para mover una fecha a "mañana". Cuando llegue el
calendario oficial 2026, será timezone Madrid también.

D7 — **Modelo de sync bidireccional**:
  · Supabase es la **única fuente de verdad de runtime**.
  · El JSON Python es un buffer:
    - `wc2022:upload`: JSON local → Supabase (escribe).
    - `wc2022:download`: Supabase → JSON local (read-only por defecto;
      `--write` sobreescribe el JSON).
  · Cualquier cosa que el admin edite desde la UI **debe persistir en
    Supabase**, no en el JSON. Ese JSON solo se actualiza llamando
    `wc2022:download --write`.
  · La key estable es `external_id`. Nunca cambiarlo.

# ESTADO DE INFRAESTRUCTURA Y URLS
Repo:        github.com/DavidAmat/world-cup-sweepstake (público)
Branch:      master (commits directos, no PR)
Vercel:      https://world-cup-sweepstake-mu.vercel.app
Supabase:    project_ref qbphxsijmqortxhxlrnr (region EU West, free tier)

Local Supabase:
  - DB:    192.168.0.112:54322  (NO 127.0.0.1 — bindea al IP de LAN)
  - API:   192.168.0.112:54321
  - Studio: http://192.168.0.112:54323
  - .env.local apunta a 127.0.0.1; los scripts wc2022:* auto-rewrite
    127.0.0.1 → 192.168.0.112 (ver scripts/wc2022/lib/env.ts).

Env vars (en Vercel Production+Preview, en .env.local local):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     (sb_publishable_*)
  SUPABASE_SECRET_KEY                       (sb_secret_*)
  NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test

Datos en producción (post-hito 06):
  Torneo: wc_2022_test (is_test=true, status=active).
  32 teams. 48 fixtures de fase de grupos en junio 2026. Sin
  match_results, sin goals, sin predicciones todavía.

Usuarios actuales en producción:
  - David1 (role=admin). Promovido vía SQL Editor de Supabase Studio.
  - David2 (role=player), si está creado.
  Credenciales fake en context/usuarios/01-fake-users.json.

# COMANDOS HABITUALES

Local dev:
  npm run dev                # Next en localhost:3000
  npm run db:start           # supabase start
  npm run db:stop
  npm run db:status
  npm run db:reset           # reaplica todas las migraciones (vacía la DB)
  npm run types:gen          # regenera src/lib/supabase/database.types.ts
  npm run db:diff            # supabase db diff -f

Sync de datos (hito 06):
  npm run wc2022:upload      # JSON local → Supabase (idempotente)
  npm run wc2022:download    # Supabase → diff vs JSON local (read-only)
  npx tsx scripts/wc2022/download.ts --write   # sobreescribe JSON local

Verificación:
  npm run typecheck
  npm run lint
  npm run format
  npm run build

A producción (cuidado):
  npm run db:push            # supabase db push --linked
  git push origin master     # Vercel autodeploya
  # seeder contra prod:
  NEXT_PUBLIC_SUPABASE_URL=https://qbphxsijmqortxhxlrnr.supabase.co \
  SUPABASE_SECRET_KEY=<sb_secret_prod> \
    npx tsx scripts/wc2022/upload.ts --confirm-prod

psql contra local (la password es 'postgres'):
  PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres

# TAREA: HITO 07 — ADMIN: FIXTURES

Objetivo: que el admin pueda ver y editar los 48 fixtures cargados
desde la web, y añadir nuevos fixtures (eliminatorias) cuando se
conozcan los cruces. Sin tocar la base de datos directamente. Sin
romper predicciones existentes (key estable: `external_id`).

Outline en context/plan/01-plan.md §7 hito 07. **El detalle lo
escribes tú al empezar**, en context/plan/07-admin-fixtures.md.
Importante: ese fichero del plan menciona `/admin/players`. **Salta
esa sección** — no implementamos jugadores (D2).

Pasos generales (sujetos a tu propio plan detallado):

1. Lee la bitácora del hito 06 a fondo. Asegúrate de entender el
   modelo de sync bidireccional. La UI admin tiene que escribir en
   Supabase, no en el JSON. El JSON se actualiza con `wc2022:download`.

2. Diseña las páginas admin:
   - `/admin/fixtures` (listado): tabla filtrable por jornada/ronda,
     muestra `external_id`, equipos, kickoff_at, status. Iniciales,
     sin paginación (48 filas).
   - `/admin/fixtures/[id]` (edición): formulario con Zod +
     react-hook-form para editar `kickoff_at`, `home_team_id`,
     `away_team_id`, `home_placeholder`, `away_placeholder`, `venue`,
     `status`. Validar que `home_team_id` y `away_team_id` pertenecen
     al torneo, son distintos, etc.
   - `/admin/fixtures/new` (crear): para añadir fixtures eliminatorios
     cuando se conozcan los cruces. Debe permitir asignar
     `stage_id`/`round_id` (selects con los catálogos), `external_id`
     (texto), equipos o placeholders, kickoff. Validar que el
     `external_id` no choca con uno existente.

3. Server actions con `requireAdmin()` (ya existe en
   src/lib/permissions/) y admin client si necesitas saltar RLS.
   Ojo: las RLS de fixtures ya permiten al admin todo (policy
   `fixtures_admin_all`). Probablemente con el server client basta.

4. UI en español, copys cuidados (estamos en hito 07, todavía sin
   diseño definitivo, pero coherente con /login, /register,
   /dashboard, /rules existentes).

5. Considera los efectos en cascada:
   - Editar `kickoff_at` puede mover un partido al pasado/futuro y
     afectar `is_fixture_locked`. Avisar al admin si va a bloquear o
     desbloquear predicciones.
   - Cambiar el equipo asignado a un fixture cuando ya hay
     predicciones de partido es delicado. Decidir si bloquearlo o
     solo avisar.
   - `external_id` no debe cambiarse (anclamos predicciones a él).

6. Nada de tabla `players` ni `/admin/players`.

7. Probar en local con Studio + un usuario admin (David1).

8. Cuando esté listo, push a master → Vercel deploya y puedes probar
   contra prod con David1.

9. Documenta todo en context/implementations/07-...md.

# CÓMO TRABAJAS CONMIGO

- Antes de implementar el hito, escribes el plan detallado en
  context/plan/07-admin-fixtures.md. Yo lo reviso. Si veo algo, te
  lo digo. Si no, te digo "adelante".

- Mientras implementas, vas registrando avances/decisiones/errores
  en context/implementations/07-...-implementation.md. Es la
  bitácora. No la pospongas para el final.

- Estilo de commits: 1 commit por unidad coherente (una migración,
  una refactor, una feature pequeña). Mensajes estilo Conventional
  Commits en inglés. Co-authored-by Claude.

- Push automático a master tras cada commit. No me preguntes cada vez.

- Pide confirmación antes de:
  · Cualquier acción destructiva (rm -rf, db reset en prod, etc).
  · Push a producción de algo arriesgado o de una migración SQL.
  · Crear/borrar recursos en Supabase o Vercel.
  · Borrar fixtures que ya tengan predicciones asociadas.

- Si un comando bash necesita interacción humana (passwords, prompts
  Y/n, login flow), pásamelo a mí para ejecutar en mi terminal y
  dime qué buscar en el output.

- Si te encuentras editando un fichero modificado por mí o tras un
  format/lint, vuelve a leerlo antes de tocarlo.

- Si hace falta migración SQL para algo (no debería en este hito),
  la propones, yo la reviso y luego la aplicas con db:reset local +
  db:push prod, una vez aprobada.

# EMPIEZA AQUÍ

1. Lee los ficheros de la sección "LEE ESTO ANTES DE NADA",
   especialmente la bitácora del hito 06 (modelo de sync, decisiones
   D1-D7).
2. Inspecciona el estado actual de la app (src/app/admin/page.tsx
   existe del hito 05, está casi vacía). Mira cómo están escritas
   /login, /register, /rules para coger el estilo.
3. Inspecciona los datos cargados:
   `npm run wc2022:download` te enseña qué hay sin tocar nada.
4. Propón un plan detallado del hito 07
   (context/plan/07-admin-fixtures.md). No implementes todavía.
5. Pídeme aprobación.
6. Una vez aprobado, ejecuta paso a paso siguiendo las convenciones
   de los hitos previos.

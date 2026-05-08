# Prompt de arranque — continuar el proyecto en el hito 06

> Pega este prompt completo al iniciar una conversación nueva con
> Claude para que arranque sin perder contexto. Te ahorra que
> tenga que re-descubrir el estado del repo.

---

```text
Hola. Continuamos un proyecto a mitad: una app web privada para gestionar
una porra del Mundial de fútbol 2026 entre 10 amigos. Llevamos 4 hitos
cerrados (02-05). Ahora toca el hito 06: seeds e importación del master
data del Mundial 2022 (que usaremos como entorno de pruebas antes del 2026).

UI en español. Código, SQL y nombres de tabla en inglés. Comunícate
conmigo en español.

╔══════════════════════════════════════════════════════════════════════╗
║ LEE ESTO ANTES DE NADA                                               ║
╚══════════════════════════════════════════════════════════════════════╝

En este orden, hasta entender el estado actual:

1. context/initial-setup/02-pid.md
   Project Initiation Document. Visión, decisiones cerradas, modelo de
   datos, sistema de puntuación. Es la fuente de verdad funcional.

2. context/plan/01-plan.md
   Índice maestro de los 17 hitos. Léelo entero — especialmente §6
   (roadmap) y §7 (resumen por hito). Te dirá dónde encaja el hito 06.

3. Bitácoras de los hitos cerrados (qué hice, qué decidí, qué falló):
   - context/implementations/02-project-setup-implementation.md
   - context/implementations/03-supabase-local-and-migrations-implementation.md
   - context/implementations/04-database-schema-implementation.md
   - context/implementations/05-auth-and-profiles-implementation.md

4. Para entender el pipeline Python paralelo (entrada del seeder):
   - context/python/01-python-setup.md
   - data/partidos/   (JSONs ya normalizados; los inspeccionas tú)
   - data/raw/        (fuente original + scripts de normalización)

5. Cuando arranques con la implementación, escribirás:
   - context/plan/06-seed-and-import-master-data.md (plan detallado)
   - context/implementations/06-seed-and-import-master-data-implementation.md
     (bitácora, se va llenando mientras implementas)

╔══════════════════════════════════════════════════════════════════════╗
║ RESUMEN DE LOS HITOS CERRADOS                                        ║
╚══════════════════════════════════════════════════════════════════════╝

Hito 02 — Project setup
  Plan: context/plan/02-project-setup.md
  Bitácora: context/implementations/02-project-setup-implementation.md
  Qué hay: Next.js 16 + TypeScript + Tailwind v4 + ESLint + Prettier +
  Turbopack. Estructura de carpetas en src/{app,components,lib,styles}.
  Vercel enlazado y primer deploy verde. Deps core instaladas:
  @supabase/ssr, @supabase/supabase-js, zod, react-hook-form, lucide-react,
  date-fns.

Hito 03 — Supabase local + migraciones
  Plan: context/plan/03-supabase-local-and-migrations.md
  Bitácora: context/implementations/03-supabase-local-and-migrations-implementation.md
  Qué hay: Supabase CLI 2.98.2. supabase/config.toml con [analytics]
  disabled (Vector container falla en macOS). Migración inicial de
  extensiones (pgcrypto, citext). Tres clientes Supabase en
  src/lib/supabase/{client,server,admin}.ts. src/proxy.ts (Next 16
  renombró middleware → proxy) refresca sesión con auth.getClaims().
  Proyecto Supabase prod creado y enlazado. Env vars en Vercel.

Hito 04 — Esquema de base de datos
  Plan: context/plan/04-database-schema.md
  Bitácora: context/implementations/04-database-schema-implementation.md
  Qué hay: 5 migraciones SQL que crean 17 tablas:
  - Master: tournaments, profiles, terms_acceptances, teams, players,
    stages, rounds.
  - Resultados: fixtures, match_results, match_goals, player_match_stats.
  - Predicciones: initial_predictions, group_qualification_predictions,
    match_predictions.
  - Scoring: scoring_rules, prediction_scores, leaderboard_snapshots.
  Helpers SQL: is_admin(), is_fixture_locked(uuid), set_updated_at().
  49 policies de RLS distribuidas según la estrategia descrita en el
  plan §4. Aplicadas en local y producción.

Hito 05 — Auth + profiles + roles
  Plan: context/plan/05-auth-and-profiles.md
  Bitácora: context/implementations/05-auth-and-profiles-implementation.md
  Qué hay: trigger handle_new_user (SECURITY DEFINER) que crea profile
  al registrarse. Páginas /login y /register en español + server
  actions signUp/signIn/signOut. Helpers requireAuth() y requireAdmin()
  con auth.getClaims(). Header dinámico. Página /rules con flujo de
  aceptación de normas (idempotente; rules_version=0 hasta hito 11).
  Mapeador translateAuthError → mensajes en español.
  ESLint config extendida con globalIgnores para .venv, data, context,
  supabase, scripts y database.types.ts.

╔══════════════════════════════════════════════════════════════════════╗
║ ESTADO DE INFRAESTRUCTURA Y URLS                                     ║
╚══════════════════════════════════════════════════════════════════════╝

Repo:        github.com/DavidAmat/world-cup-sweepstake (público)
Branch:      master (commits directos, no PR)
Vercel:      https://world-cup-sweepstake-mu.vercel.app
Supabase:    project_ref qbphxsijmqortxhxlrnr (region EU West, free tier)

Local Supabase:
  - DB:    192.168.0.112:54322  (NO 127.0.0.1 — bindea al IP de LAN)
  - API:   192.168.0.112:54321
  - Studio: http://192.168.0.112:54323
  - .env.local apunta a 127.0.0.1 (Docker mapea ambos)

Env vars (en Vercel Production+Preview, en .env.local local):
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     (sb_publishable_*)
  SUPABASE_SECRET_KEY                       (sb_secret_*)
  NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test

Usuarios actuales en producción:
  - David1 (role=admin). Promovido manualmente vía SQL Editor de
    Supabase Studio.

╔══════════════════════════════════════════════════════════════════════╗
║ COMANDOS HABITUALES                                                  ║
╚══════════════════════════════════════════════════════════════════════╝

Local dev:
  npm run dev                # Next en localhost:3000
  npm run db:start           # supabase start
  npm run db:stop
  npm run db:status
  npm run db:reset           # reaplica todas las migraciones
  npm run types:gen          # regenera src/lib/supabase/database.types.ts
  npm run db:diff            # supabase db diff -f

Verificación:
  npm run typecheck
  npm run lint
  npm run format
  npm run build

A producción:
  npm run db:push            # supabase db push --linked
  git push origin master     # Vercel autodeploya

psql contra local (la password es 'postgres'):
  PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres

╔══════════════════════════════════════════════════════════════════════╗
║ TAREA: HITO 06 — SEEDS E IMPORTACIÓN DE MASTER DATA                  ║
╚══════════════════════════════════════════════════════════════════════╝

Objetivo: que la DB de producción tenga cargado el master data del
Mundial de Catar 2022 (torneo de pruebas), listo para que los hitos
siguientes puedan usar la app de verdad.

Outline en context/plan/01-plan.md §7 hito 06. El detalle lo escribes
tú al empezar.

Pasos generales:

1. Inspecciona los JSONs ya normalizados que tengo en data/partidos/
   y los scripts en data/raw/. Anota el formato.

2. Lee context/python/01-python-setup.md para entender mi pipeline.

3. Decide el formato canónico de los JSONs de seed. Si los del autor
   ya valen, los usas tal cual; si necesitan transformación pequeña,
   propón un script o pídeme que ajuste los míos.

4. Define schemas Zod para validar los JSONs antes de insertar.

5. Escribe scripts/seed/wc-2022.ts que:
   - Use el admin client (SUPABASE_SECRET_KEY, server-only).
   - Sea idempotente (upsert por external_id en teams/players/fixtures).
   - Cree:
     · 1 tournament  (slug='wc_2022_test', is_test=true)
     · stages         (group_stage, round_of_16, quarter_final,
                       semi_final, third_place, final)
     · rounds         (group_md1..3, r16, qf, sf, third, final)
     · 32 teams
     · ~830 players (plantillas oficiales)
     · 64 fixtures   (48 fase grupos + 16 eliminatorias)

6. Añade npm script seed:wc2022.

7. Pruébalo en local (npm run db:reset && npm run seed:wc2022).
   Verifica conteos esperados.

8. Cuando esté validado, ejecútalo contra producción cambiando las
   env vars del proceso (o pídemelo a mí; eso lo decidimos juntos).

9. Documenta todo en context/implementations/06-...md.

╔══════════════════════════════════════════════════════════════════════╗
║ CÓMO TRABAJAS CONMIGO                                                ║
╚══════════════════════════════════════════════════════════════════════╝

- Antes de implementar el hito, escribes el plan detallado en
  context/plan/06-seed-and-import-master-data.md. Yo lo reviso. Si
  veo algo, te lo digo. Si no, te digo "adelante".

- Mientras implementas, vas registrando avances/decisiones/errores
  en context/implementations/06-...-implementation.md. Es la
  bitácora. No la pospongas para el final.

- Estilo de commits: 1 commit por unidad coherente
  (una migración, una refactor, una feature pequeña). Mensajes
  estilo Conventional Commits en inglés. Co-authored-by Claude.

- Push a master tras cada commit (sin PRs por ahora — proyecto
  pequeño con un solo dev).

- Pide confirmación antes de:
  · Cualquier acción destructiva (rm -rf, db reset en prod, etc).
  · Push a producción de algo arriesgado.
  · Crear/borrar recursos en Supabase o Vercel.
  · Commitear/pushar (es para tu protección y la mía).

- Si un comando bash necesita interacción humana (passwords,
  prompts Y/n, login flow), pásamelo a mí para ejecutar en mi
  terminal y dime qué buscar en el output.

- Si te encuentras editando un fichero modificado por mí o tras
  un format/lint, vuelve a leerlo antes de tocarlo.

╔══════════════════════════════════════════════════════════════════════╗
║ EMPIEZA AQUÍ                                                         ║
╚══════════════════════════════════════════════════════════════════════╝

1. Lee los ficheros de la sección "LEE ESTO ANTES DE NADA".
2. Inspecciona los JSONs y scripts de mi pipeline Python en
   data/partidos/, data/raw/ y context/python/.
3. Propón un plan detallado del hito 06 (no implementes todavía).
4. Pídeme aprobación.
5. Una vez aprobado, ejecuta paso a paso siguiendo las convenciones
   de los hitos previos.
```

---

## Cómo usarlo

1. Abre una conversación nueva en Claude Code (en el mismo
   directorio del repo).
2. Pega el bloque entre los `╔...╗` (o el documento entero — el
   párrafo introductorio explica el porqué de leer este fichero).
3. Claude va leyendo y arranca con el hito 06.

Si quieres añadir/quitar algo antes de pegarlo (p.ej. no listar
ciertos detalles), edita este fichero o copia y modifica.

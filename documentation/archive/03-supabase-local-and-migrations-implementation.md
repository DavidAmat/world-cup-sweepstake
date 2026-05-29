# 03 — Supabase local + migraciones · bitácora de implementación

> Hito ejecutado: ver plan en `03-supabase-local-and-migrations-plan.md`.

## Resumen

Hito 03 completado. Stack Supabase local funcionando, migraciones
operativas en local y producción, tres clientes Supabase (browser,
server, admin) montados en `src/lib/supabase/` y proxy de sesión
en `src/proxy.ts`. Producción Supabase enlazada con
`project_ref=qbphxsijmqortxhxlrnr`. Variables de entorno configuradas
en Vercel (Production + Preview) y verificado que la home sigue
cargando tras el redeploy.

## Comandos ejecutados

```bash
# Instalar Supabase CLI
brew install supabase                 # 2.98.2 instalada
brew untap supabase/tap               # tap obsoleto, formula está en homebrew-core

# Inicializar y arrancar local
supabase init                         # genera supabase/{config.toml,.gitignore}
supabase migration new enable_extensions
# (escrito el SQL: create extension pgcrypto, citext)
supabase start                        # primer arranque, descarga imágenes Docker
supabase status                       # entrega keys locales sb_publishable_*/sb_secret_*

# Tipos TS
npm run types:gen                     # 179 líneas, sin tablas todavía

# Smoke test
npm run db:reset                      # drop + recreate + apply OK

# Login + link + push (lanzados por el usuario en su terminal)
supabase login                        # autorizado vía browser
supabase link --project-ref qbphxsijmqortxhxlrnr
npm run db:push                       # supabase db push --linked
# Output: "Applying migration 20260507222918_enable_extensions.sql"
#         "NOTICE: extension pgcrypto already exists, skipping"
#         "Finished supabase db push."
```

## Datos del proyecto Supabase de producción

```
Project name:  world-cup-sweepstake
Project ref:   qbphxsijmqortxhxlrnr
Project URL:   https://qbphxsijmqortxhxlrnr.supabase.co
Region:        EU West (Ireland)
Plan:          Free
Publishable:   sb_publishable_W4f82qhc3nomQUn0_Zh85Q_tcH7pFgU
Secret:        sb_secret_*** (en Vercel env vars y .env.local del autor)
DB password:   solo en el gestor de contraseñas del autor
```

> El secret no se commitea. Vive solo en:
> - `.env.local` del autor (gitignored).
> - Vercel env vars (Production + Preview).
> - Supabase Dashboard.

## Variables en Vercel

Configuradas en **Production** y **Preview** (Vercel no permite las
"sensitive" en Development; Development se usa solo para `vercel dev`,
que no es nuestro flujo):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test
```

Tras el redeploy desde Vercel UI, la home en
`world-cup-sweepstake-mu.vercel.app` sigue verde. El proxy de
`src/proxy.ts` ya invoca `auth.getClaims()` en cada request — sin
sesión activa devuelve un claim vacío y NextResponse.next() pasa
limpio, así que no afecta a usuarios anónimos.

## Decisiones tomadas durante la implementación

1. **`supabase` formula en homebrew-core, no en `supabase/tap`**.
   El primer intento `brew install supabase/tap/supabase` falló
   porque el tap solo expone `supabase-beta`. La fórmula estable
   está en homebrew-core. Untap del repo obsoleto.

2. **`[analytics] enabled = false`** en `supabase/config.toml`.
   El contenedor `supabase_vector_*` falla en macOS Docker Desktop
   reciente con "Listing currently running containers failed... DNS
   error" porque no resuelve el socket Docker para hacer scrape de
   logs. Nuestra app no necesita analytics local; deshabilitado.

3. **Filtro `2>/dev/null | grep -v` en `types:gen`**.
   La CLI imprime "Connecting to db 5432" mezclado en stdout antes
   del fichero TS, lo que rompe `tsc`. El filtro lo elimina. La
   redirección de stderr es defensiva por si la línea se mueve a
   stderr en versiones futuras.

4. **`middleware.ts` → `proxy.ts`** y función exportada
   `middleware()` → `proxy()`.
   Next 16 ha renombrado el convenio. El build avisa con un error
   claro si quedan los nombres antiguos. La API es prácticamente
   idéntica.

5. **Guard de env vars en el proxy**.
   `if (!supabaseUrl || !supabaseKey) return response;` evita que
   el proxy crashee en Vercel cuando todavía no hemos configurado
   las env vars (caso real durante el primer deploy). Inerte una
   vez añadidas.

6. **Tres clientes separados**.
   - `client.ts` (browser): publishable key, sujeta a RLS.
   - `server.ts` (server actions / RSC): publishable key con
     cookies de sesión.
   - `admin.ts` (server-only, `import "server-only"` en la cabecera):
     secret key, bypass de RLS, para recálculos / resets / seeders.
   Decisión deliberada para que el bypass sea explícito y nunca
   expuesto al browser.

7. **Aplicación de migraciones a producción manual** desde local
   con `npm run db:push` (alias de `supabase db push --linked`).
   No automatizado en CI. Decisión consistente con el plan: evitar
   sustos en producción mientras estamos en fase de iteración
   intensa de schema.

8. **Vercel Development env**: las variables sensibles no se
   pueden marcar para Development. Aceptado: el flujo `vercel dev`
   no es el nuestro; nosotros usamos `npm run dev` apuntando a la
   Supabase local.

## Errores y resoluciones

- **Supabase CLI tap obsoleto**: `brew install supabase/tap/supabase`
  → "No available formula". Resuelto con `brew install supabase`
  desde homebrew-core.

- **Vector container unhealthy** en `supabase start`: ver decisión 2
  arriba. Resuelto deshabilitando `[analytics]`.

- **`tsc` rompía con el types file**: ver decisión 3.

- **Build de Next 16 fallaba con `Proxy is missing expected function
  export name`**: la función exportada se llamaba `middleware` pero
  el fichero ya era `proxy.ts`. Resuelto renombrando la función a
  `proxy`.

## Acceptance criteria del hito

- [x] `supabase --version` >= 2.x → 2.98.2.
- [x] `supabase start` levanta Postgres local sin errores.
- [x] `supabase/migrations/20260507222918_enable_extensions.sql`
      creada y aplicada.
- [x] `supabase db reset` aplica migraciones limpiamente
      (smoke-test ejecutado).
- [x] `src/lib/supabase/database.types.ts` existe (179 líneas).
- [x] `client.ts`, `server.ts`, `admin.ts`, `proxy.ts` creados y
      compilan (`npm run typecheck`, `npm run build` verdes).
- [x] Scripts `db:start/stop/status/reset/diff/push` y `types:gen`
      añadidos a `package.json`.
- [x] `.env.local` poblado con keys locales (`sb_publishable_*` y
      `sb_secret_*` del CLI local, `URL=http://127.0.0.1:54321`).
- [x] Proyecto Supabase de producción creado.
- [x] `supabase link --project-ref qbphxsijmqortxhxlrnr` ejecutado
      correctamente.
- [x] Variables de entorno Supabase configuradas en Vercel
      (Production + Preview).
- [x] `supabase db push --linked` aplicado a producción; `pgcrypto`
      ya estaba pre-habilitada por Supabase, `citext` activada por
      la migración.
- [x] Producción `world-cup-sweepstake-mu.vercel.app` sigue
      cargando la home en español tras el redeploy.
- [x] Bitácora `03-supabase-local-and-migrations-implementation.md`
      creada (este fichero).

## Estado de Supabase tras el hito

- **Local:** Postgres 17, extensiones `pgcrypto` y `citext`
  habilitadas, sin tablas todavía.
- **Producción:** mismo estado (`pgcrypto` ya venía pre-habilitada,
  `citext` añadida por la migración). Sin tablas.

## Próximo hito

Hito 04 — esquema de base de datos. Crearemos:

- Migraciones SQL ordenadas para todas las tablas de dominio
  (`tournaments`, `profiles`, `teams`, `players`, `stages`, `rounds`,
  `fixtures`, `match_results`, `match_goals`, `player_match_stats`,
  `initial_predictions`, `group_qualification_predictions`,
  `match_predictions`, `scoring_rules`, `prediction_scores`,
  `leaderboard_snapshots`).
- Políticas RLS por tabla.
- Índices de soporte.

Tras cada migración, regeneraremos `database.types.ts` con
`npm run types:gen`. Producción se actualizará al final del hito
con un único `npm run db:push` revisado.

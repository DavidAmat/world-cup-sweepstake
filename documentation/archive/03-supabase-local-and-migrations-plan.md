# 03 — Supabase local + migraciones

> Referencia del índice: `01-plan.md` §7 → Hito 03.
>
> Depende de: hito 02 (proyecto Next.js arrancando + estructura
> `src/lib/supabase/` lista).

---

## 1. Goal

- Supabase corriendo en local (Docker) vía Supabase CLI.
- `supabase/` inicializado en el repo con `config.toml` y la primera
  migración placeholder.
- Scripts npm para operar la DB (`db:start/stop/reset/diff/push`,
  `types:gen`).
- Generación de tipos TypeScript (`database.types.ts`) atada a los
  clientes Supabase.
- Tres clientes Supabase montados en `src/lib/supabase/`:
  - `client.ts` (browser, publishable key, sujeto a RLS).
  - `server.ts` (server components / server actions, publishable
    key con cookies de sesión).
  - `admin.ts` (server-only, secret key, bypass de RLS).
- Proxy de Next.js (`src/proxy.ts` — antes `middleware.ts`, renombrado
  en Next 16) que refresca la sesión
  en cada request usando el patrón oficial de `@supabase/ssr` y
  `auth.getClaims()`.
- Proyecto Supabase de **producción** creado (free tier) y sus claves
  copiadas a Vercel y a `.env.local`.

Lo que **NO** entra en este hito:

- Tablas reales (van en hito 04).
- Auth UI / login (hito 05).
- Profiles trigger (hito 05).
- Cualquier seed (hito 06).

---

## 2. Decisiones cerradas para este hito

- **Versión Supabase CLI:** la última estable. En macOS instalamos
  con Homebrew: `brew install supabase/tap/supabase`.
- **Docker:** ya está instalado (Docker 29 verificado en hito 02).
- **Carpeta:** `supabase/` en el root del repo, generada por
  `supabase init`.
- **Migraciones desde el día 1:** todas las DDL viven en
  `supabase/migrations/*.sql`. Nunca tocamos producción a pelo.
- **Aplicación a producción manual:** desde local con
  `supabase db push --linked`. CI **no** aplica migraciones (esto
  se confirma en hito 16).
- **Tipos TypeScript:** generados desde la DB local con
  `supabase gen types typescript --local`. Versionados en el repo.
  Regenerar tras cada migración nueva.
- **Cliente browser:** patrón `createBrowserClient` de
  `@supabase/ssr`.
- **Cliente server:** patrón `createServerClient` de `@supabase/ssr`
  con `cookies()` de `next/headers`.
- **Cliente admin:** `createClient` de `@supabase/supabase-js` con
  la secret key. Solo usable desde server-only (`"use server"` /
  route handlers / scripts).
- **Sesión:** refrescar en middleware con `getClaims()`, no
  `getSession()` (recomendación oficial).
- **Cookies:** las gestiona `@supabase/ssr` automáticamente. No
  añadimos lógica custom.
- **Realtime:** no lo activamos por ahora. La app no lo necesita.
- **Storage:** no lo activamos.
- **Auth providers:** solo email/password (PID confirmó que no
  queremos OAuth / Google).

---

## 3. Pasos del hito (en orden)

### 3.1 Instalar Supabase CLI

macOS:

```bash
brew install supabase/tap/supabase
supabase --version
```

Verificación: la versión debe ser >= 2.x (2026).

### 3.2 Inicializar `supabase/` en el repo

```bash
supabase init
```

Esto genera:

```txt
supabase/
  config.toml
  seed.sql           ← vacío al principio
  .gitignore         ← ya excluye .branches/.temp
```

Hay que confirmar en `config.toml`:

- `project_id = "world-cup-sweepstake"`
- Puertos por defecto suficientes (54321 API, 54322 DB, 54323 Studio).
- `[db]` con `port = 54322` y `major_version = 17` (el más reciente
  estable; el CLI lo tunea solo).
- `[auth]` con `site_url = "http://localhost:3000"` y
  `additional_redirect_urls = ["http://localhost:3000/**"]`.
- `[auth.email]` con `enable_signup = true` y
  `enable_confirmations = false` para desarrollo (en producción
  decidiremos en hito 05/16 si activamos confirmación).

### 3.3 Primera migración placeholder

Crear una migración que solo activa extensiones que vamos a
necesitar pronto (`pgcrypto` para `gen_random_uuid`):

```bash
supabase migration new enable_extensions
```

Genera `supabase/migrations/<timestamp>_enable_extensions.sql`.
Contenido:

```sql
-- supabase/migrations/<timestamp>_enable_extensions.sql
create extension if not exists pgcrypto;
create extension if not exists citext;
```

### 3.4 Levantar Supabase local y aplicar migraciones

```bash
supabase start         # tira Docker, expone puertos, aplica migraciones
supabase status        # muestra URL, anon key, service_role key locales
```

`supabase status` dará algo como:

```txt
API URL:           http://127.0.0.1:54321
DB URL:            postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:        http://127.0.0.1:54323
JWT secret:        super-secret-jwt-token-with-at-least-32-characters
anon key:          eyJ... (publishable equivalente local)
service_role key:  eyJ... (secret equivalente local)
```

### 3.5 Generar tipos TypeScript

```bash
supabase gen types typescript --local 2>/dev/null \
  | grep -v '^Connecting to db' \
  > src/lib/supabase/database.types.ts
```

El filtro elimina la línea informativa `Connecting to db 5432` que
la CLI imprime y que rompería el TypeScript del fichero generado.
Por ahora producirá tipos casi vacíos (no hay tablas todavía); lo
importante es que el comando funciona y los clientes pueden importar
`Database`.

### 3.6 Añadir scripts npm

Añadir a `package.json`:

```json
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:status": "supabase status",
    "db:reset": "supabase db reset",
    "db:diff": "supabase db diff -f",
    "db:push": "supabase db push --linked",
    "types:gen": "supabase gen types typescript --local 2>/dev/null | grep -v '^Connecting to db' > src/lib/supabase/database.types.ts"
  }
}
```

`db:reset` aplica todas las migraciones desde cero — útil cuando
tocamos una migración recién creada.

### 3.7 Cliente browser — `src/lib/supabase/client.ts`

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

### 3.8 Cliente server — `src/lib/supabase/server.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server components no pueden setear cookies; el middleware
            // se encarga del refresh real (ver src/middleware.ts).
          }
        },
      },
    },
  );
}
```

### 3.9 Cliente admin — `src/lib/supabase/admin.ts`

Server-only. Usado para acciones privilegiadas (recálculos, resets,
seeders). Bypass de RLS.

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
```

### 3.10 Proxy — `src/proxy.ts`

> Next 16 ha renombrado el fichero `middleware.ts` a `proxy.ts` y la
> función exportada también pasa de `middleware` a `proxy`. La API
> es prácticamente idéntica.

Patrón oficial de `@supabase/ssr` adaptado a Next 16. Refresca
tokens en cada request y los devuelve como cookies al cliente. Usa
`getClaims()` (no `getSession()`) en server-side.

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session via getClaims (preferred over getSession server-side).
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Run on every page request except static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 3.11 Variables de entorno locales

`.env.local` (no versionado):

```txt
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key from supabase status>
SUPABASE_SECRET_KEY=<service_role key from supabase status>
NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test
```

> Nota: en el entorno local, las claves "anon" y "service_role" del
> CLI hacen el rol de "publishable" y "secret". El SDK no distingue.

### 3.12 Verificación local

1. `supabase start` levanta Docker.
2. `npm run dev` arranca Next.
3. Una página cualquiera puede leer del cliente sin RLS aún (no hay
   tablas), pero no debe romper.
4. `npm run typecheck` y `npm run build` siguen pasando.
5. Studio en `http://127.0.0.1:54323` muestra la DB con `pgcrypto`
   y `citext` activadas y la migración aplicada.

### 3.13 Crear proyecto Supabase de producción (acción manual)

El usuario hace estos pasos vía dashboard:

1. https://supabase.com/dashboard → "New project".
2. Plan: **Free**.
3. Region: `EU West (Ireland)` o la más cercana.
4. Generar y guardar la database password (Bitwarden / 1Password).
5. Esperar a que el proyecto esté listo (~2 min).
6. Settings → API:
   - Copiar `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`.
   - Si Supabase ya muestra las nuevas claves
     `sb_publishable_*` y `sb_secret_*`, las copiamos. Si solo
     muestra `anon` y `service_role`, usamos esas (siguen funcionando
     hasta finales de 2026; migraremos a las nuevas más adelante).
7. Settings → API → guardar `Project ref` (algo como `xxxxxxxxxxxx`).

### 3.14 Linkear el proyecto local con producción

```bash
supabase link --project-ref <project_ref>
# Pedirá la database password guardada en el paso anterior.
```

Esto deja en `supabase/.temp/project-ref` y permite usar
`db:push --linked` más adelante.

### 3.15 Configurar variables de entorno en Vercel

Vercel → Project → Settings → Environment Variables.

Para los entornos `Production`, `Preview` y `Development`:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<copy de Supabase>
SUPABASE_SECRET_KEY=<copy de Supabase>
NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test
```

Tras añadirlas, redeploy del último commit (Vercel → Deployments →
… → "Redeploy").

### 3.16 Aplicar la primera migración a producción

```bash
supabase db push --linked
```

Esperado: aplica `enable_extensions.sql` al Postgres de producción.
Verificable en Supabase Dashboard → Database → Extensions.

---

## 4. Acceptance criteria del hito

- [ ] `supabase --version` >= 2.x.
- [ ] `supabase start` levanta Postgres local sin errores.
- [ ] `supabase/migrations/*` contiene la migración de extensiones.
- [ ] `supabase db reset` aplica las migraciones limpiamente.
- [ ] `src/lib/supabase/database.types.ts` existe y se importa sin
      errores en los clientes.
- [ ] `client.ts`, `server.ts`, `admin.ts`, `middleware.ts` creados
      y compilan (`npm run typecheck`).
- [ ] Scripts `db:*` y `types:gen` añadidos a `package.json`.
- [ ] `.env.local` poblado con las claves locales.
- [ ] Proyecto Supabase de producción creado (acción del usuario).
- [ ] `supabase link` ejecutado y conectado.
- [ ] Variables de entorno Supabase configuradas en Vercel para los
      tres entornos.
- [ ] `supabase db push --linked` aplicado a producción y extensiones
      verificadas en Dashboard.
- [ ] Bitácora `context/implementations/03-supabase-local-and-migrations-implementation.md`
      creada.

---

## 5. Riesgos / dudas conocidas

- **Vector / analytics desactivado en local:** el contenedor
  `supabase_vector_*` falla con "Listing currently running
  containers failed... DNS error" en macOS Docker Desktop reciente
  (no puede resolver el socket Docker para scrappear logs).
  Solución: en `supabase/config.toml`, sección `[analytics]`,
  `enabled = false`. La app no necesita analytics en local.
- **Docker pesado en el portátil:** `supabase start` lanza varios
  contenedores. Si el rendimiento molesta, parar con
  `supabase stop` cuando no estemos trabajando.
- **Free tier de Supabase pausa proyectos inactivos:** tras 1
  semana sin actividad. Hay que hacer ping de vez en cuando o
  asumir el cold start. Para una porra entre amigos no es problema.
- **Cookies entre `localhost:3000` y `localhost:54321`:** en local
  Supabase y Next corren en puertos diferentes pero del mismo host
  → no hay problema con `Same-Site=Lax`.
- **`supabase link` y la password:** si se pierde la DB password,
  hay que resetearla desde el dashboard. Anotarla bien.
- **Migración a las nuevas keys `sb_publishable_*`/`sb_secret_*`:**
  si el dashboard ya las ofrece, las usamos. Si solo ofrece las
  antiguas (`anon`/`service_role`), funcionan igual: nuestros
  clientes leen `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
  `SUPABASE_SECRET_KEY` sin importar el formato del valor.

---

## 6. Qué queda preparado para el siguiente hito (04)

- DB local funcionando con extensiones.
- Pipeline de migraciones operativo en local y producción.
- Tipos TS generándose.
- Clientes Supabase listos para usar en server actions y components.

El hito 04 (`04-database-schema.md`) creará todas las tablas de
dominio, índices y políticas RLS en una serie de migraciones SQL
ordenadas. Tras cada migración:

```bash
npm run db:reset && npm run types:gen
```

para regenerar los tipos.

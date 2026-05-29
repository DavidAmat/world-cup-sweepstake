# 02 — Project setup

Primer hito. Dejar el repo con un Next.js 16 funcionando en local, con
toda la base de tooling, estructura de carpetas y dependencias core,
listo para que el siguiente hito (03) añada Supabase local y
migraciones encima.

> Referencia del índice: `01-plan.md` §7 → Hito 02.

---

## 1. Goal

- Repo Next.js 16 inicializado con TypeScript, Tailwind v4, ESLint,
  App Router y Turbopack (defaults recomendados).
- Prettier integrado.
- Estructura de carpetas inicial creada.
- `.env.example` y `.gitignore` listos.
- Dependencias core de la app instaladas (Supabase SSR, Zod, RHF,
  lucide-react).
- Proyecto Vercel free-tier conectado al repo de GitHub.
- Un commit inicial con la base, validado por un preview deploy en
  Vercel.

Lo que **NO** entra en este hito:

- Crear el proyecto Supabase (eso va en el hito 03 junto con la CLI
  local).
- Cualquier migración SQL o tabla (hito 04).
- Auth real / login (hito 05).

---

## 2. Decisiones cerradas para este hito

- **Versión Next.js:** la última estable (Next.js 16, default en
  `create-next-app@latest`).
- **Bundler:** Turbopack (default en Next 16).
- **Linter:** ESLint, no Biome. ESLint tiene más integración con el
  ecosistema que ya conocemos.
- **Formatter:** Prettier (en lugar de Biome). Configuración
  compartida en `.prettierrc`.
- **`src/` directory:** Sí. Mantiene el root limpio y separa código
  de configuración.
- **Import alias:** `@/*` (default).
- **Package manager:** npm. Ya está en uso, no añadimos pnpm/bun
  ahora.
- **AGENTS.md / CLAUDE.md:** Sí, los incluimos. Útiles para que
  Claude Code (y otros agentes) escriban código consistente con la
  versión de Next.
- **Supabase keys:** usaremos las **nuevas keys**
  `sb_publishable_*` (browser) y `sb_secret_*` (server). Las antiguas
  `anon` / `service_role` siguen funcionando hasta finales de 2026,
  pero un proyecto nuevo en mayo de 2026 debe ir con las nuevas. Esto
  cambia los nombres de variables de entorno respecto al PID/01-plan.

> Nota para `01-plan.md`: actualizar los nombres
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
> y `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`. Lo hago en
> este hito.

---

## 3. Prerrequisitos

Comprobado en este entorno:

- Node 25.8.1 ✅ (mínimo 20.9 según docs Next 16).
- npm 11.11 ✅
- Docker 29 ✅ (se usa en hito 03).
- gh CLI 2.89 ✅
- Supabase CLI ❌ (se instala en hito 03).

Estado actual del repo: solo `.git/`, `context/`, y un `README.md`
de 23 bytes. Vacío en cuanto a código.

---

## 4. Pasos del hito (en orden)

### 4.1 Inicializar Next.js en el directorio actual

El repo ya existe con `.git` y `context/`. Necesitamos inicializar
Next sin sobrescribir esos directorios. `create-next-app` permite
correr en el directorio actual con `.` como nombre.

**Comando previsto:**

```bash
npx create-next-app@latest . \
  --ts --tailwind --eslint --app --src-dir --import-alias "@/*" \
  --turbopack --use-npm --skip-install
```

Notas:

- `.` = inicializa en el directorio actual.
- `--skip-install` para revisar antes de instalar deps; luego
  `npm install` manual.
- `--turbopack` (default en Next 16, explícito por claridad).
- Va a quejarse de que el directorio no está vacío. Hay que aceptar
  que sobrescriba `README.md` (lo reescribiremos).
- **Importante:** `context/` no se toca porque no es un fichero que
  `create-next-app` genere.

Como el directorio no está vacío, en lugar del flag puede ser más
limpio crear en un subdir temporal y mover los ficheros. Decisión:
intentar primero `create-next-app .` con auto-respuesta a "directorio
no vacío". Si da problemas, plan B:

```bash
npx create-next-app@latest tmp-app --ts --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --turbopack --use-npm --skip-install
shopt -s dotglob
mv tmp-app/* .
mv tmp-app/.* . 2>/dev/null || true
rmdir tmp-app
```

### 4.2 Instalar dependencias generadas por create-next-app

```bash
npm install
```

### 4.3 Añadir Prettier

```bash
npm install -D prettier eslint-config-prettier prettier-plugin-tailwindcss
```

Crear `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Crear `.prettierignore`:

```txt
node_modules
.next
.vercel
out
build
coverage
*.log
.env*
data/
supabase/
context/
public/
```

Asegurar que `eslint.config.mjs` extiende `eslint-config-prettier`
para evitar conflictos con reglas de formato.

Añadir scripts a `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

### 4.4 .gitignore y .env.example

`create-next-app` ya genera un `.gitignore` razonable. Añadir las
líneas que faltan al final:

```txt
# Local env
.env
.env.local
.env.*.local

# Supabase local (hito 03)
supabase/.branches
supabase/.temp

# OS / editor
.DS_Store
.idea/
.vscode/
!.vscode/settings.json

# Coverage
coverage/

# Cypress / Playwright (si se añaden más adelante)
playwright-report/
test-results/
```

Crear `.env.example` (versionado, sin valores reales):

```txt
# Supabase (Hito 03 los pobla)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# Tournament por defecto (slug del torneo activo en UI)
NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG=wc_2022_test
```

### 4.5 Estructura de carpetas

`create-next-app` genera (con `--src-dir`):

```txt
src/app/
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/favicon.ico
public/
eslint.config.mjs
next.config.ts
postcss.config.mjs
tsconfig.json
package.json
README.md
AGENTS.md
CLAUDE.md
```

Añadimos manualmente:

```txt
src/
  app/
    (auth)/
      login/page.tsx           ← stub "próximamente" en español
      register/page.tsx        ← stub
    (app)/
      dashboard/page.tsx       ← stub
    admin/
      page.tsx                 ← stub que requiere admin (validación llega en hito 05)
  components/
    ui/.gitkeep
    layout/.gitkeep
  lib/
    supabase/
      .gitkeep                 ← clientes llegan en hito 03/05
    permissions/.gitkeep
    dates/.gitkeep
    copy/.gitkeep
    scoring/.gitkeep
  styles/.gitkeep
data/
  seeds/.gitkeep               ← JSONs de Catar 2022/2026 llegan en hito 06
supabase/                      ← se inicializa con `supabase init` en hito 03
scripts/.gitkeep               ← seed scripts (hito 06+)
```

Las páginas stub son `Server Components` simples con un `<h1>` en
español, suficiente para que las rutas existan y se pueda navegar
mientras avanzamos los hitos siguientes.

**Skeleton stub:**

```tsx
// src/app/(app)/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-sm text-gray-600">
        Próximamente: resumen de tu porra.
      </p>
    </main>
  );
}
```

### 4.6 Página raíz mínima en español

Reescribir `src/app/page.tsx` con un placeholder en español que
también sirva para verificar que el deploy a Vercel funciona:

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-3xl font-bold">Porra Mundial 2026</h1>
      <p className="mt-3 text-gray-700">
        App privada para gestionar la porra entre amigos.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Estado: configuración inicial — siguientes hitos en construcción.
      </p>
    </main>
  );
}
```

`layout.tsx` se actualiza para tener `<html lang="es">` y un título
en español.

### 4.7 Instalar dependencias core de la app

Estas se necesitan a partir de hito 05+ pero las dejamos instaladas
ahora para que un único PR setea todo el tooling.

```bash
npm install \
  @supabase/supabase-js \
  @supabase/ssr \
  zod \
  react-hook-form \
  @hookform/resolvers \
  lucide-react \
  date-fns
```

Notas:

- `@supabase/ssr` para clientes browser/server con sesión.
- `zod` para validación de formularios y JSONs (hitos 06, 09).
- `react-hook-form` + `@hookform/resolvers` para forms con Zod.
- `lucide-react` para iconos.
- `date-fns` para manipulación de fechas (lock de 24h, formateo
  Europe/Madrid).
- `recharts` lo dejaremos para el hito 12 (gráfico de evolución),
  no se instala todavía.

### 4.8 Verificación local

```bash
npm run dev
# abrir http://localhost:3000 → debe ver "Porra Mundial 2026"
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Todo debe pasar sin warnings críticos.

### 4.9 Primer commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: bootstrap Next.js 16 project with Tailwind v4, ESLint, Prettier

- Initialize Next.js with TypeScript, App Router, Tailwind v4
- Add Prettier with shared config and tailwind plugin
- Set up base folder structure (src/app, components, lib, data, supabase)
- Add stub pages for auth, dashboard, admin in Spanish
- Install core deps: @supabase/ssr, zod, react-hook-form, lucide-react, date-fns
- Add .env.example and updated .gitignore

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

### 4.10 Conectar con Vercel (acción manual del usuario)

El usuario realiza estos pasos vía dashboard de Vercel:

1. Vercel → "Add New Project" → importar `world-cup-sweepstake` desde
   GitHub.
2. Framework preset: Next.js (auto-detectado).
3. Variables de entorno: por ahora **ninguna** (las añadimos en hito
   05/16 cuando tengamos Supabase).
4. Deploy.

Esperado: deploy verde, URL `*.vercel.app` muestra "Porra Mundial
2026".

A partir de aquí, cualquier PR genera un Preview Deployment
automáticamente.

---

## 5. Acceptance criteria del hito

- [ ] `npm run dev` levanta en `localhost:3000` con la home en
      español.
- [ ] `npm run lint`, `npm run typecheck`, `npm run format:check`,
      `npm run build` pasan sin errores.
- [ ] Existe la estructura de carpetas descrita en §4.5.
- [ ] `.env.example` versionado con las variables esperadas (nuevas
      keys de Supabase).
- [ ] `.gitignore` incluye `.env.local` y los paths Supabase.
- [ ] Proyecto vinculado en Vercel → primer Preview/Production
      deployment verde.
- [ ] `01-plan.md` actualizado con los nuevos nombres de variables
      Supabase.
- [ ] Documento de implementación
      `context/implementations/02-project-setup-implementation.md`
      creado con: comandos ejecutados, errores encontrados, decisiones
      tomadas y URL del deploy.

---

## 6. Riesgos / dudas conocidas

- **`create-next-app .` en directorio no vacío:** si rechaza, usar
  el plan B (subdir temporal). El subdir `context/` no debería
  causar problemas porque no es un nombre que use Next.
- **Tailwind v4 PostCSS plugin:** `create-next-app` lo configura
  bien por defecto, pero si vemos errores raros de CSS revisamos
  `postcss.config.mjs`.
- **AGENTS.md / CLAUDE.md generados:** los dejamos tal cual los
  genere `create-next-app`. Si más adelante queremos personalizar
  instrucciones para Claude Code, editamos `CLAUDE.md`.
- **ESLint flat config:** Next 16 usa `eslint.config.mjs`. Si añadimos
  reglas custom en hitos siguientes, se hacen ahí, no en `.eslintrc`.
- **`next build` no corre lint:** desde Next 16. CI tendrá que
  ejecutar `lint` y `typecheck` aparte (esto se ataja en hito 16).

---

## 7. Qué queda preparado para el siguiente hito (03)

- Repo con Next.js arrancando.
- Vercel desplegando.
- Estructura `lib/supabase/` lista para alojar `client.ts`,
  `server.ts`, `admin.ts`, `database.types.ts`.
- Variables de entorno (vacías) ya planificadas en `.env.example`.

El hito 03 (`03-supabase-local-and-migrations.md`) instalará la
Supabase CLI, hará `supabase init`, generará `database.types.ts`,
añadirá los scripts npm de DB y creará el cliente browser/server con
las nuevas keys.

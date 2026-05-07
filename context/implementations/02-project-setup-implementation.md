# 02 — Project setup · bitácora de implementación

> Hito ejecutado: ver plan en `context/plan/02-project-setup.md`.

## Resumen

Hito 02 completado en una sesión. Repo bootstrapped con Next.js 16
+ Tailwind v4 + ESLint 9 + Prettier + dependencias core de Supabase
y formularios. Verificado que typecheck, lint, format y build pasan.
Dos commits push a `master`.

Pendiente fuera de la sesión: enlazar Vercel manualmente.

## Comandos ejecutados

```bash
# Scaffolding
npx --yes create-next-app@latest tmp-app \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack --use-npm --skip-install --no-biome
mv tmp-app/* tmp-app/.gitignore .
rmdir tmp-app

# Estructura de carpetas adicional
mkdir -p src/components/{ui,layout} \
         src/lib/{supabase,permissions,dates,copy,scoring} \
         src/styles data/seeds scripts
# .gitkeep files en cada subdir

# Dependencias
npm install \
  @supabase/supabase-js @supabase/ssr \
  zod react-hook-form @hookform/resolvers \
  lucide-react date-fns
npm install -D \
  prettier eslint-config-prettier prettier-plugin-tailwindcss

# Verificación local
npm run typecheck     # ✅
npm run lint          # ✅
npm run format        # ✅
npm run build         # ✅ (6 rutas prerender)
```

## Versiones instaladas (a 2026-05-07)

| Paquete                       | Versión   |
|-------------------------------|-----------|
| next                          | 16.2.6    |
| react / react-dom             | 19.2.4    |
| typescript                    | ^5        |
| tailwindcss                   | ^4        |
| @tailwindcss/postcss          | ^4        |
| eslint                        | ^9        |
| eslint-config-next            | 16.2.6    |
| @supabase/supabase-js         | 2.105.3   |
| @supabase/ssr                 | 0.10.3    |
| zod                           | 4.4.3     |
| react-hook-form               | 7.75.0    |
| @hookform/resolvers           | 5.2.2     |
| lucide-react                  | 1.14.0    |
| date-fns                      | 4.1.0     |
| prettier                      | 3.8.3     |
| eslint-config-prettier        | 10.1.8    |
| prettier-plugin-tailwindcss   | 0.8.0     |

## Decisiones tomadas durante la implementación

1. **Subdir temporal en lugar de `create-next-app .`**
   Estrategia segura porque el repo ya tenía `.git/`, `context/` y
   un `README.md`. Hicimos `npx create-next-app@latest tmp-app` y
   movimos el contenido al root con `mv tmp-app/* tmp-app/.gitignore .`
   y `rmdir tmp-app`. Sin pérdidas.

2. **Nuevas keys de Supabase desde el principio**
   Cambiamos los nombres de variables de entorno respecto al PID
   original:
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`
   Razón: Supabase ha movido a las nuevas claves `sb_publishable_*`
   y `sb_secret_*`. Las antiguas siguen funcionando hasta finales
   de 2026, pero un proyecto nuevo debe usar las nuevas. Plan
   maestro `01-plan.md` actualizado a juego.

3. **Prettier en lugar de Biome**
   `create-next-app` ofrece Biome como opción. Mantenemos Prettier
   por ser el estándar más extendido y porque
   `prettier-plugin-tailwindcss` ordena clases automáticamente, lo
   que ayuda con la legibilidad de Tailwind v4.

4. **`AGENTS.md` y `CLAUDE.md` se conservan tal cual los genera
   `create-next-app`** (apuntan a las docs oficiales de Next 16).
   Los personalizaremos cuando alguna instrucción específica del
   proyecto haga ruido.

5. **`recharts` no se instala todavía**. Se añadirá en el hito 12
   (gráfico de evolución), no antes, para mantener el bundle
   reducido.

6. **`.claude/settings.local.json`** apareció automáticamente en el
   working tree (Claude Code lo crea). Añadido `.claude/` al
   `.gitignore` — son ajustes locales del autor.

## Errores y resoluciones

- **`Write` falló inicialmente** en 4 ficheros porque no los había
  leído previamente (regla del harness). Resolución: `Read` →
  `Write` en una segunda pasada. Sin impacto en el resultado.

- **Prettier reformatea 3 ficheros** en la primera pasada
  (`src/app/layout.tsx`, `src/app/admin/page.tsx`,
  `src/app/(app)/dashboard/page.tsx`) — solo collapse de líneas
  largas. Cambios committeados ya formateados.

## Estructura final del repo

```
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
├── context/
│   ├── initial-setup/{01-brainstorming-prompt.md, 02-pid.md}
│   ├── plan/{0-plan-prompt.md, 01-plan.md, 02-project-setup.md}
│   └── implementations/02-project-setup-implementation.md   ← este
├── data/seeds/.gitkeep
├── public/{file,globe,next,vercel,window}.svg
├── scripts/.gitkeep
└── src/
    ├── app/
    │   ├── (app)/dashboard/page.tsx
    │   ├── (auth)/{login,register}/page.tsx
    │   ├── admin/page.tsx
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── layout.tsx          (lang="es")
    │   └── page.tsx            (home en español)
    ├── components/{ui,layout}/.gitkeep
    ├── lib/{supabase,permissions,dates,copy,scoring}/.gitkeep
    └── styles/.gitkeep
```

## Commits

```
9d808cd chore: bootstrap Next.js 16 project with Tailwind v4 (hito 02)
61279cd docs: add PID and implementation plan index (hito 01)
```

Ambos en `master`, ya en remote (`origin/master`).

## Acceptance criteria del hito

- [x] `npm run dev` levanta en localhost:3000 con la home en español.
      (Verificado vía `npm run build` que prerender funciona; no
      arrancado en background para no bloquear el flujo.)
- [x] `npm run lint`, `npm run typecheck`, `npm run format:check`,
      `npm run build` pasan sin errores.
- [x] Estructura de carpetas creada según `02-project-setup.md` §4.5.
- [x] `.env.example` versionado con las nuevas keys de Supabase.
- [x] `.gitignore` incluye `.env*`, `.claude/` y paths Supabase.
- [ ] **Pendiente:** Vinculación con Vercel y verificación del primer
      deploy. **Acción del usuario.**
- [x] `01-plan.md` actualizado con los nuevos nombres de variables
      Supabase.
- [x] Bitácora `02-project-setup-implementation.md` creada.

## Pendiente del hito (acción manual del usuario)

1. **Crear proyecto en Vercel** vinculado al repo `world-cup-sweepstake`.
   - Framework preset: Next.js (auto-detectado).
   - Variables de entorno: ninguna por ahora (las añadimos en hito 16
     cuando tengamos Supabase de producción).
   - Click en "Deploy".
2. Cuando termine el primer deploy, verificar que la URL
   `*.vercel.app` muestra la home en español "Porra Mundial 2026".
3. Confirmar al cerrar el hito.

## Próximo hito

Hito 03 — Supabase local + migraciones. Crearemos
`context/plan/03-supabase-local-and-migrations.md` con el detalle
y empezaremos a:

- Instalar Supabase CLI.
- `supabase init` en el repo.
- Decidir esquema inicial de migraciones.
- Crear los clientes `lib/supabase/{client,server,admin}.ts` con
  las nuevas keys.
- Crear el proyecto Supabase de producción (free tier, manual).

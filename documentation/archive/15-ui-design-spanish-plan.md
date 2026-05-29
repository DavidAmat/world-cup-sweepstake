# Hito 15 — Diseño UI español

Referencia de alto nivel: `01-plan.md` §"Hito 15".
Bitácora paralela: `context/implementations/15-ui-design-spanish-implementation.md`.
Paleta fuente: `99-color-palette.md`.

---

## Objetivo

Consolidar la app con una identidad visual coherente, eliminar el modo oscuro, adoptar la paleta oficial y una tipografía de calidad, y asegurar que todos los textos visibles al usuario estén en español.

**No es un rediseño** — es una consolidación y pulido de lo ya construido.

---

## Decisiones cerradas

- **Sin dark mode.** Eliminar todas las clases `dark:*` del proyecto. La app será 100% light mode.
- **Paleta**: la del archivo `99-color-palette.md`. Los colores "dark" son los vibrantes (para texto, bordes, iconos, botones); los colores "light" son los pasteles (para fondos de badges, paneles de estado, highlights).
- **Fuente principal**: **Plus Jakarta Sans** vía `next/font/google`. Geist Mono se mantiene para números y código.
- **Sin dependencias nuevas.** `next/font/google` ya existe en Next.js. No se añade nada al `package.json`.

---

## Paleta de tokens

Variables en `src/app/globals.css` (reemplazar bloque `:root` actual):

```css
:root {
  /* Base */
  --background: #ffffff;
  --foreground: #171717;

  /* Brand / primary — Blue */
  --color-primary:      #4681ff;   /* dark Blue  */
  --color-primary-light:#A2C0FF;   /* light Blue */
  --color-primary-fg:   #ffffff;

  /* Success — Green */
  --color-success:      #3cdcb4;   /* dark Green  */
  --color-success-light:#9DEDD9;   /* light Green */
  --color-success-fg:   #0a4a3a;

  /* Warning — Yellow */
  --color-warning:      #ffc83c;   /* dark Yellow  */
  --color-warning-light:#FFE39D;   /* light Yellow */
  --color-warning-fg:   #5a3c00;

  /* Danger — Red */
  --color-danger:       #FE6060;   /* dark Red  */
  --color-danger-light: #FEAFAF;   /* light Red */
  --color-danger-fg:    #7a0000;

  /* Info / Accent — Cyan */
  --color-info:         #00E7E7;   /* dark Cyan  */
  --color-info-light:   #B2F7F7;   /* light Cyan */
  --color-info-fg:      #004a4a;

  /* Special / Admin — Lavender */
  --color-special:      #816eff;   /* dark Lavender  */
  --color-special-light:#C0B6FF;   /* light Lavender */
  --color-special-fg:   #ffffff;

  /* Orange — alertas secundarias */
  --color-orange:       #ff8b32;
  --color-orange-light: #FFC598;
  --color-orange-fg:    #5a2800;

  /* Muted text */
  --color-muted:        #9C9C9C;   /* light Gray */
  --color-muted-strong: #393939;   /* dark Gray  */
}
```

`@theme inline` expone `bg-primary`, `text-success-fg`, etc. para Tailwind v4.

---

## Mapeo semántico (reemplazo de clases dispersas)

| Contexto actual | Clase actual | Reemplazar por token |
|---|---|---|
| Resultado confirmado / bloqueado | `border-emerald-*`, `bg-emerald-*`, `text-emerald-*` | `success` |
| Borrador / desbloqueado / aviso | `border-amber-*`, `bg-amber-*`, `text-amber-*` | `warning` |
| Error / peligro | `border-rose-*`, `bg-rose-*`, `text-rose-*` | `danger` |
| Info / sky | `border-sky-*`, `bg-sky-*`, `text-sky-*` | `info` |
| Botón primario (negro) | `bg-zinc-900 text-white` | `bg-primary text-primary-fg` |
| Texto secundario | `text-zinc-500/600` | `text-muted` |
| Paneles / tarjetas | `bg-white border-zinc-200` | mantener + verificar contraste |

---

## Archivos a modificar / crear

### Globals y layout

```
src/app/globals.css              ← reescribir :root + @theme, quitar dark mode
src/app/layout.tsx               ← cambiar fuente a Plus Jakarta Sans + Geist Mono
```

### Componentes reutilizables nuevos

```
src/components/ui/EmptyState.tsx  ← vacío con icono + mensaje
src/components/ui/ErrorBanner.tsx ← banner de error rojo reutilizable
```

### Layout

```
src/components/layout/Header.tsx  ← quitar dark:*, mejorar responsive (hamburguesa <md)
src/components/layout/Footer.tsx  ← NUEVO: copyright + /rules + versión
src/app/layout.tsx                ← añadir <Footer /> bajo {children}
```

### Páginas que reciben la paleta nueva (pasada de sustitución)

Todas las páginas y componentes con clases `dark:*`, `emerald-*`, `amber-*`, `rose-*`, `sky-*` hardcoded. Lista no exhaustiva:

```
src/app/(app)/dashboard/page.tsx
src/app/(app)/predictions/initial/page.tsx
src/app/(app)/predictions/matches/page.tsx
src/app/(app)/predictions/matches/MatchesForm.tsx
src/app/(app)/predictions/matches/LockedFixturePanel.tsx
src/app/(app)/clasificacion/**/*.tsx
src/app/(app)/my-scores/page.tsx
src/app/admin/results/page.tsx
src/app/admin/results/[fixtureId]/page.tsx
src/app/admin/fixtures/page.tsx
src/app/admin/fixtures/[id]/page.tsx
src/components/ui/Badge.tsx
src/components/scoring/BreakdownTable.tsx
src/components/scoring/BreakdownPopover.tsx
src/components/scoring/PointsBar.tsx
src/components/scoring/EvolutionChart.tsx
```

---

## 1 · `globals.css` + `layout.tsx`

`globals.css`:
- Eliminar `@media (prefers-color-scheme: dark)`.
- Reescribir `:root` con todos los tokens de la paleta.
- `@theme inline` expone los tokens como utilidades Tailwind.
- `body { font-family: var(--font-plus-jakarta-sans), ... }` (si se define en layout).

`layout.tsx`:
- Añadir `import { Plus_Jakarta_Sans } from "next/font/google"` con `subsets: ["latin"]`, `variable: "--font-plus-jakarta-sans"`.
- Mantener `Geist_Mono` para mono.
- Quitar `Geist` (sans-serif ya lo cubre Plus Jakarta Sans).
- `<html>` → añadir las variables de fuente en `className`.
- Mantener `suppressHydrationWarning`.
- Añadir `<Footer />` tras `{children}`.

---

## 2 · `EmptyState.tsx`

```tsx
// Props: icon?: LucideIcon, title: string, description?: string, action?: ReactNode
// Centra el icono (gris grande), título y descripción.
// Reemplaza todos los <td colSpan="…"> con texto de "no hay datos".
```

Uso inicial: tablas de fixtures, results, clasificación sin datos.

---

## 3 · `ErrorBanner.tsx`

```tsx
// Props: message: string, className?: string
// Banner rojo con icono AlertCircle (lucide) + mensaje.
// Reemplaza los <p className="border-rose-*..."> dispersos.
```

---

## 4 · `Header.tsx`

- Quitar todas las clases `dark:*`.
- Usar `bg-primary` + `text-primary-fg` en lugar del negro/blanco actual.
- Menú hamburguesa para `< md`: `<details>` o `useState` para el toggle. El menú se colapsa verticalmente.
- Mantener estructura actual de links.

---

## 5 · `Footer.tsx` (nuevo)

```tsx
// Mínimo: copyright © 2026 Porra Mundial | /rules | versión del package.json (opcional)
// Fondo neutral, texto muted, height fija (~12 flex).
```

---

## 6 · Pasada de sustitución de colores

Por cada archivo de la lista anterior:
1. Quitar todas las clases `dark:*`.
2. Reemplazar `border-emerald-*/bg-emerald-*/text-emerald-*` → tokens de success.
3. Reemplazar `border-amber-*/bg-amber-*/text-amber-*` → tokens de warning.
4. Reemplazar `border-rose-*/bg-rose-*/text-rose-*` → tokens de danger.
5. Reemplazar `border-sky-*/bg-sky-*/text-sky-*` → tokens de info.
6. Botones primarios (`bg-zinc-900 text-white hover:bg-zinc-800`) → `bg-primary text-primary-fg`.
7. Texto secundario (`text-zinc-500`, `text-zinc-600`) → `text-muted`.

`Badge.tsx` cambia sus tones de `emerald/amber/rose/sky/zinc` a `success/warning/danger/info/muted` internamente.

`PointsBar.tsx`: los breakpoints de color (zinc/amber/sky/emerald según %) → (`muted`/`warning`/`info`/`success`).

---

## 7 · Revisión de copys

Pasada por todas las páginas. Puntos concretos:
- `src/app/(app)/predictions/matches`: revisar header y sticky bar.
- `src/app/(app)/rules`: revisar texto completo.
- `src/app/(app)/predictions/initial`: revisar labels de form.
- Mensajes de error Zod en `schemas.ts` de cada feature: en español.
- Admin pages (fixtures, results): revisar textos.
- Footer y Header: todo en español.
- Modal de reset: copy claro ("Escribe BORRAR para confirmar la eliminación permanente de los datos seleccionados.").

---

## 8 · Accesibilidad básica

- `focus-visible:ring-2 focus-visible:ring-primary` en todos los botones e inputs (en lugar de `focus-visible:ring-zinc-500` si existe).
- `aria-label` en todos los botones icon-only (ⓘ breakdown, hamburguesa, chevrons).
- `aria-expanded` verificado en chevrons y popovers (ya existente según D12-13 — solo revisar).

---

## Orden de ejecución

1. `globals.css` + `layout.tsx` (fuente + paleta) → verificar build.
2. Componentes `EmptyState` + `ErrorBanner`.
3. `Header` + `Footer` nuevos.
4. Pasada de colores en todos los archivos de la lista.
5. Badge + PointsBar actualizados.
6. Revisión de copys.
7. Accesibilidad.
8. `npm run typecheck && npm run lint && npm run format:check && npm run build` → todo verde.

---

## Acceptance

- Las páginas comparten paleta y tipografía (Plus Jakarta Sans visible, paleta de `99-color-palette.md`).
- Cero clases `dark:*` en el proyecto.
- Ningún copy en inglés visible al usuario final.
- El admin del hito 14 ya nace con la paleta nueva.
- Build/lint/typecheck/format verdes.

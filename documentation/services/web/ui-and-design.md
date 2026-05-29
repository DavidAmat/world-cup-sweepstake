> Context: [`context/web/ui-and-design.md`](../../../context/web/ui-and-design.md)

# UI & Design — implementation detail

Files, classes, and component APIs for the visual system.

## File map

```
src/app/
  layout.tsx              fonts, Header/Footer shell, pt-14 offset
  globals.css             :root tokens + @theme inline (Tailwind v4)
  page.tsx                home dashboard (/) — feature cards, terms gate

src/components/layout/
  Header.tsx              server: session, profile, signOut form
  HeaderClient.tsx        client: fixed nav, desktop/mobile, scroll blur
  Footer.tsx              copyright + /rules link

src/components/ui/
  Badge.tsx               tone badges + FixtureStatusBadge
  EmptyState.tsx
  ErrorBanner.tsx
  NumberInput.tsx
  SortableTable.tsx
  TeamName.tsx

src/components/scoring/
  PointsBar.tsx           pct → warning/info/success bar
  BreakdownPopover.tsx
  BreakdownTable.tsx
  EvolutionChart.tsx      client chart (recharts-style usage)

src/components/profiles/
  Avatar.tsx              header + nav avatar (see avatars doc, P2-L)
```

## `globals.css`

Structure:

1. `:root { --color-* }` — hex values (authoritative palette)
2. `@theme inline { --color-*: var(...) }` — registers Tailwind utilities (`bg-primary`, `text-success-fg`, …)
3. Font theme keys: `--font-sans`, `--font-mono`, `--font-oswald`
4. `body { background, color }` from `--background` / `--foreground`

No `@media (prefers-color-scheme: dark)` block.

Full token list matches `context/web/ui-and-design.md` palette table.

## `layout.tsx`

```tsx
Plus_Jakarta_Sans → variable: "--font-plus-jakarta-sans", weights 400–700
Geist_Mono        → variable: "--font-geist-mono"
Oswald            → variable: "--font-oswald", weights 400–700

<html lang="es" className="{font vars} h-full antialiased" suppressHydrationWarning>
<body className="flex min-h-full flex-col bg-white text-zinc-900">
  <Header />
  <div className="flex flex-1 flex-col pt-14">{children}</div>
  <Footer />
</body>
```

Metadata: `title: "Porra Mundial 2026"`.

## Header implementation

### `Header.tsx` (server)

- `createClient()` + `getClaims()`
- Loads `profiles.display_name`, `initials`, `role`
- `avatarUrlFor(displayName)` from `lib/profiles/avatars`
- Passes props to `HeaderClient`; embeds sign-out as `<form action={signOut}>`

### `HeaderClient.tsx` (client)

**Scroll effect** (`useScrolled`, threshold 8px):

| State | Classes |
|-------|---------|
| Top | `bg-white/70 backdrop-blur-sm border-transparent` |
| Scrolled | `bg-white/80 backdrop-blur-md border-white/40 shadow-sm` |

**Nav constants:**

```ts
NAV_ITEMS = [
  { href: "/", label: "Inicio", exact: true },
  { href: "/predictions/initial", label: "Predicciones Iniciales" },
  { href: "/predictions/matches", label: "Predicciones Partidos" },
]
CLASIFICACION_ITEMS = [
  { href: "/clasificacion/jornada", label: "Clasificación" },
  { href: "/my-scores", label: "Mis Predicciones" },
]
```

**ClasificacionDropdown** — click-outside close, `aria-expanded`, `aria-haspopup`.

**Admin link** — `/admin`, Shield icon with `text-special`.

**Mobile** — `md:hidden` hamburger, `aria-label` "Abrir/Cerrar menú", full-height panel below header.

**Link styling:**

```ts
LINK_BASE = "... focus-visible:ring-2 focus-visible:ring-primary ..."
LINK_IDLE = "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
LINK_ACTIVE = "text-primary bg-white/70 shadow-sm"
```

## Footer

```tsx
<footer className="mt-auto border-t border-zinc-200 bg-white">
  © 2026 Porra Mundial | Link → /rules "Reglas de puntuación"
</footer>
```

## Home page (`page.tsx`)

**Unauthenticated:** centered welcome, Trophy icon in `bg-primary/10`, login/register buttons.

**Authenticated + terms missing:** `redirect("/rules")`.

**Authenticated + terms OK:** dashboard grid from `FEATURE_CARDS`:

| href | Token tint |
|------|------------|
| `/predictions/initial` | primary |
| `/predictions/matches` | success |
| `/clasificacion` | warning |
| `/my-scores` | info |

Cards: `rounded-2xl border p-5 hover:-translate-y-0.5 hover:shadow-md`.

Bottom strip: `border-zinc-200 bg-zinc-50` with Calendar icon + tournament name + rules link.

## `Badge.tsx`

```ts
type Tone = "zinc" | "warning" | "success" | "danger" | "info" | "special";
```

Maps to `bg-{tone}-light text-{tone}-fg` (zinc uses `bg-zinc-100 text-zinc-700`).

`FixtureStatusBadge`: `scheduled` → zinc/Programado, `locked` → warning, `completed` → success, `cancelled` → danger.

## `EmptyState.tsx`

Props: `icon?: LucideIcon` (default `Inbox`), `title`, `description?`, `action?`.

Layout: centered column, `py-12`, icon `text-zinc-300`.

## `ErrorBanner.tsx`

Props: `message`, `className?`.

Uses `border-danger-light bg-danger-light text-danger-fg`, `role="alert"`, `AlertCircle` icon.

**Adoption gap:** auth pages, admin forms, and some prediction pages still inline `border-red-300 bg-red-50` — prefer `ErrorBanner` on new work.

## `NumberInput.tsx`

Client component; props include `max` (default 99), `ariaLabel`, controlled/uncontrolled.

Strips non-digits, clamps to max, `onWheel` blurs to prevent scroll-change, adds `tabular-nums`.

Callers supply width via `className` (often combined with `font-oswald` in score inputs).

## `TeamName.tsx`

Resolves flag via `COUNTRY_FLAG_MAP` → `country-flag-icons/react/3x2`. Fallback: two-letter uppercase snippet.

`flagOnly` mode for compact tables.

## `PointsBar.tsx`

```ts
toneFor(pct): 0 → zinc-300, <35 → warning, <75 → info, else success
```

`role="progressbar"` with `aria-valuenow/min/max`.

## Score input styling (shared convention)

Match and admin result forms share input class string:

```
rounded-md border border-zinc-300 bg-white px-2 py-1 w-16 text-center
font-oswald text-xl font-bold text-zinc-900 focus:border-primary focus:outline-none
```

Defined in `MatchesForm.tsx` and `ResultForm.tsx` (duplicated constant).

## `SortableTable.tsx`

Client generic table. Column config: `key`, `label`, `getValue`, optional `render`, `sortable`, alignment, `tdClassName` static or `(row) => string`.

Sort cycle: asc → desc → off. Header icons: `ChevronUp`, `ChevronDown`, `ChevronsUpDown`.

## Semantic tokens (hito 15)

| Check | Status |
|-------|--------|
| `dark:*` classes | **0** — removed |
| Raw Tailwind palette (`emerald`, `amber`, etc.) | **0** — migrated to tokens |
| Primary submit buttons | `bg-primary text-primary-fg` |
| Form errors | `<ErrorBanner />` |

## Accessibility patterns

- `focus-visible:ring-primary` on interactive header controls
- `aria-label` on icon-only buttons (menu, admin shield)
- `aria-expanded` on dropdowns and mobile menu
- `role="alert"` on `ErrorBanner`
- `role="progressbar"` on `PointsBar`

## Icons

`lucide-react` throughout. Header: `Menu`, `X`, `Home`, `ListChecks`, `ClipboardList`, `BarChart2`, `Shield`, `ChevronDown`. Home cards reuse nav icons + `Trophy`, `Calendar`.

## Related routes styling

- **`/rules`** — long Spanish terms page; mixed form + checklist UI
- **`/(auth)/login|register`** — minimal forms, zinc/red (see migration gap)
- **`/admin/*`** — same shell; admin accent via `special` token on nav only
- **`/clasificacion/*`** — heavy `font-oswald` in tables; tabs in `clasificacion/Tabs.tsx`

## Related

- Overview: `context/web/ui-and-design.md`
- Conventions: `context/09-coding-conventions.md`
- Deprecated dark mode: `documentation/deprecated/dark-mode.md`

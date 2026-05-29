# UI & Design

Canonical visual system for the app: light mode only, semantic color tokens, Plus Jakarta Sans body text, floating header, and Spanish user-facing copy.

## Principles

- **Light mode only** — no `dark:*` classes, no `prefers-color-scheme` overrides (removed in hito 15).
- **Spanish UI** — all visible labels, errors, and page copy in Spanish; code stays English (`context/09-coding-conventions.md`).
- **Semantic tokens** — prefer `bg-primary`, `text-success-fg`, `bg-warning-light`, etc. over raw Tailwind palette names (`emerald`, `amber`, `rose`, `sky`).
- **Consolidation, not a redesign** — hito 15 unified palette and typography on existing layouts; hito 16 refined the shell (floating nav, home dashboard).

## Color palette

Source of truth: CSS variables in `src/app/globals.css`, exposed to Tailwind v4 via `@theme inline`.

Each semantic color has a **vibrant** token (text, borders, solid fills) and a **light** pastel (badge/panel backgrounds):

| Token | Vibrant | Light | Typical use |
|-------|---------|-------|-------------|
| `primary` | `#4681ff` | `#a2c0ff` | Brand, nav accent, primary CTAs in header |
| `success` | `#3cdcb4` | `#9dedd9` | Confirmed results, completed fixtures, high scores |
| `warning` | `#ffc83c` | `#ffe39d` | Draft/warning states, fixture `locked` badge |
| `danger` | `#fe6060` | `#feafaf` | Errors (`ErrorBanner`), cancelled fixtures |
| `info` | `#00e7e7` | `#b2f7f7` | Informational highlights, table cell emphasis |
| `special` | `#816eff` | `#c0b6ff` | Admin nav icon, admin-only affordances |
| `orange` | `#ff8b32` | `#ffc598` | Secondary alerts (available, lightly used) |
| `muted` | `#393939` (strong) | `#9c9c9c` / `#f4f4f5` (bg) | Secondary text (tokens exist; many pages still use `text-zinc-500`) |

Base: `--background: #ffffff`, `--foreground: #171717`.

Use paired foreground tokens (`*-fg`) on light backgrounds for contrast (e.g. `bg-success-light text-success-fg`).

## Typography

Loaded in `src/app/layout.tsx` via `next/font/google`:

| Font | CSS variable | Role |
|------|--------------|------|
| **Plus Jakarta Sans** | `--font-plus-jakarta-sans` | Default sans (`--font-sans`) — body, headings, UI |
| **Geist Mono** | `--font-geist-mono` | Monospace (`--font-mono`) — code, tabular contexts |
| **Oswald** | `--font-oswald` | Display numerals — scores, points, leaderboard cells (`font-oswald` class) |

Body: `bg-white text-zinc-900 antialiased`. Oswald is intentional for numeric density in leaderboards and match score inputs (added after hito 15).

## App shell

```
<html lang="es">
  <body>
    <Header />           ← fixed, floating glass nav
    <div pt-14>{children}</div>
    <Footer />
  </body>
</html>
```

- **`Header`** (`components/layout/Header.tsx` + `HeaderClient.tsx`) — server fetches profile; client handles nav, scroll styling, mobile menu.
- **Fixed top bar** — `fixed top-0 z-50`, backdrop blur, stronger shadow after scroll (`useScrolled`).
- **`pt-14`** on content wrapper — clears fixed header height.
- **`Footer`** — copyright, link to `/rules`.

### Navigation (logged in)

Desktop (`md+`): horizontal links — Inicio, Predicciones Iniciales, Predicciones Partidos, Clasificación (dropdown → jornada ranking + Mis Predicciones), Admin (if `role = admin`, `text-special` icon).

Mobile: hamburger → stacked panel with same routes.

Logged out: Iniciar sesión + Crear cuenta (primary button).

Active route: `text-primary bg-white/70` + dot indicator.

## Home dashboard (`/`)

`src/app/page.tsx` is the **main entry** after login (nav "Inicio" → `/`):

- Terms gate: redirects to `/rules` if active tournament not accepted
- **Feature card grid** — four links (initial predictions, match predictions, clasificación, my-scores) with token-tinted borders/backgrounds
- Tournament info strip with link to rules

**`/dashboard`** was removed. Home after login is **`/`** (`src/app/page.tsx`).

## Shared UI components (`components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Badge` | Tones: `zinc`, `warning`, `success`, `danger`, `info`, `special`. `FixtureStatusBadge` maps fixture status → Spanish label |
| `EmptyState` | Centered empty table/list — icon + title + optional description/action |
| `ErrorBanner` | `role="alert"` danger-styled banner (prefer over inline `border-red-*`) |
| `NumberInput` | Text-based numeric field, no spinners, caps at `max` — used in score forms |
| `SortableTable` | Generic client sortable table (leaderboards) |
| `TeamName` | Team label + optional flag from `country-flag-icons` |

Scoring visuals live in `components/scoring/` (`PointsBar`, `BreakdownPopover`, `BreakdownTable`, `EvolutionChart`) — use palette tokens for progress bar tiers.

## Common patterns

| Pattern | Classes |
|---------|---------|
| Form submit | `bg-primary text-primary-fg hover:opacity-90` |
| Card / panel | `rounded-md border border-zinc-200 bg-white` |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none` |
| Secondary text | `text-zinc-500` / `text-zinc-600` |
| Form errors | `<ErrorBanner />` (`components/ui/ErrorBanner.tsx`) |

## Dark mode — removed

Do not add `dark:` variants or system-theme switching. Historical plans that described dark mode are superseded by this doc.

## Where to look deeper

- Implementation detail: `documentation/services/web/ui-and-design.md`
- Coding conventions (language, lint): `context/09-coding-conventions.md`
- Header auth wiring: `context/web/auth-and-profiles.md`
- Leaderboard/scoring UI: `context/web/leaderboards.md`

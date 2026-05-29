# Avatars & Profile Images

Circular participant avatars in the header and leaderboards, keyed off each user's **username** (`profiles.display_name`).

## What it is

Each player has:

- **`profiles.display_name`** — the public username shown in nav, tables, and leaderboards (Spanish UI calls it "nombre" on register, but it behaves as a fixed username)
- **`profiles.initials`** — two-letter fallback when no image exists
- **Optional PNG** — `public/images/users/<username>.png` (filename derived from `display_name`)

The admin creates accounts and chooses usernames in advance. Avatar files are named to match those usernames before the porra starts.

## How resolution works

`avatarUrlFor(displayName)` in `lib/profiles/avatars.ts`:

1. Sanitize `display_name` → alphanumeric + `_`/`-` only
2. Look for `public/images/users/<sanitized>.png` on disk (server-side `fs.existsSync`)
3. Return `/images/users/<sanitized>.png` or `null` (initials disc)

Bulk leaderboards use `avatarUrlMapFor(profiles[])` to avoid N filesystem checks per row.

## UI components

| Component | Use |
|-----------|-----|
| `Avatar` | Circle only — photo or initials disc |
| `ParticipantBadge` | Avatar + truncated name (leaderboard name cells) |

Both live in `components/profiles/Avatar.tsx`. Black ring border (`border-2 border-zinc-900`); fallback disc is `bg-zinc-100`.

## Where avatars appear

- **Header** — small avatar next to display name (desktop)
- **Mobile nav** — greeting row
- **`/clasificacion/*`** — jornada, fase, categoria, partido, evolucion tables
- **`/my-scores`** — category score tiles (optional)

## Admin workflow (before tournament)

1. Decide usernames for all participants (e.g. `Ana`, `Carlos`, `Luis`)
2. Add PNG files: `public/images/users/Ana.png`, etc. (must match sanitized `display_name`)
3. Create Supabase Auth users / register with that exact **Nombre** → stored as `display_name`
4. No upload UI — drop files in repo or deploy bundle

If the PNG is missing, the initials disc shows automatically — no broken images.

## Test files today

`public/images/users/David1.png`, `David2.png`, `David3.png` are **local test placeholders**. They only work when a profile's `display_name` is exactly `David1`, `David2`, or `David3`. Replace with real participant usernames before production.

## Where to look deeper

- Implementation: `documentation/services/web/avatars-profiles.md`
- Auth + profile creation: `context/web/auth-and-profiles.md`
- Header wiring: `documentation/services/web/ui-and-design.md`

> Context: [`context/web/avatars-profiles.md`](../../../context/web/avatars-profiles.md)

# Avatars & Profile Images — implementation detail

## Module map

```
src/lib/profiles/avatars.ts       avatarUrlFor, avatarUrlMapFor (server-only)
src/components/profiles/Avatar.tsx   Avatar, ParticipantBadge
public/images/users/*.png         static assets (one per username)
```

## `avatars.ts`

```ts
export function avatarUrlFor(displayName: string | null | undefined): string | null
export function avatarUrlMapFor(
  profiles: { user_id: string; display_name: string | null }[],
): Record<string, string | null>
```

**Sanitization:** `displayName.replace(/[^a-zA-Z0-9_-]/g, "")` — spaces and accents in usernames should be avoided at account creation so filenames stay predictable.

**Path convention:** `public/images/users/${safe}.png` → public URL `/images/users/${safe}.png`.

Uses Node `fs.existsSync` — must run on server (Server Components, not client bundle).

## `Avatar.tsx`

### `Avatar`

| Prop | Type | Default |
|------|------|---------|
| `displayName` | string | required |
| `initials` | string | required |
| `avatarUrl` | string \| null | optional |
| `size` | number (px) | 24 |
| `className` | string | "" |

With `avatarUrl`: Next.js `<Image unoptimized />` (local static files).

Without: `<span>` initials disc, `aria-label={displayName}`, font size ≈ 42% of `size`.

### `ParticipantBadge`

Adds inline name: `inline-flex gap-2`, name `truncate`.

Props: same as `Avatar` plus `nameClassName`, `containerClassName`.

## Header integration

`Header.tsx` (server):

```ts
const avatarUrl = avatarUrlFor(displayName);
// → HeaderClient displayName, initials, avatarUrl
```

`HeaderClient.tsx` — `Avatar` at `size={22}` in desktop and mobile nav.

## Leaderboard integration

Server pages load profiles, then:

```ts
const avatarByUser = avatarUrlMapFor(profiles);
// pass avatarByUser[user_id] into client tables / ParticipantBadge
```

Files (non-exhaustive):

- `clasificacion/jornada/JornadaTable.tsx`, `RoundDetailTable.tsx`
- `clasificacion/fase/FaseTable.tsx`
- `clasificacion/categoria/CategoriaTable.tsx`
- `clasificacion/partido/[fixtureId]/page.tsx`
- `clasificacion/evolucion/page.tsx` + `EvolutionChart.tsx`
- `my-scores/page.tsx`

## Registration / username

`signUp` sends `display_name` in auth metadata → `handle_new_user` trigger copies to `profiles.display_name`.

Register form label: **Nombre** — this value becomes the username for avatar lookup. Admin-created accounts should use the pre-agreed username.

**No in-app rename** documented — changing `display_name` after adding a PNG requires renaming the file or adding a new PNG.

## Adding a participant avatar

```bash
# Username agreed: "Maria"
cp maria-photo.png public/images/users/Maria.png
```

Then ensure `profiles.display_name = 'Maria'` for that user.

Supported format: PNG on disk (Next `Image` with `unoptimized` for local paths).

## Related

- Overview: `context/web/avatars-profiles.md`
- Auth flow: `documentation/services/web/auth-and-profiles.md`
- UI shell: `documentation/services/web/ui-and-design.md`

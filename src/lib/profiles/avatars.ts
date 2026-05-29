import "server-only";
import fs from "node:fs";
import path from "node:path";

// Resolves the public URL for a participant's avatar, by convention
// `public/images/users/<display_name>.png`. Returns null when the file
// isn't on disk so callers can fall back to the initials disc.
export function avatarUrlFor(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  const safe = displayName.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return null;
  const filePath = path.join(process.cwd(), "public", "images", "users", `${safe}.png`);
  return fs.existsSync(filePath) ? `/images/users/${safe}.png` : null;
}

// Bulk variant: keyed by user_id so server components can hand a flat
// Record into client tables without doing N filesystem stats per row.
export function avatarUrlMapFor(
  profiles: { user_id: string; display_name: string | null }[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const p of profiles) map[p.user_id] = avatarUrlFor(p.display_name);
  return map;
}

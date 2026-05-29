> **DEPRECATED (2026-05-29).** Dark mode and `dark:*` Tailwind variants were removed in hito 15. The app is light mode only. Superseded by: [`context/web/ui-and-design.md`](../../context/web/ui-and-design.md).

# Dark mode (removed)

Do not reintroduce:

- `@media (prefers-color-scheme: dark)` in `globals.css`
- `dark:` class prefixes on components
- Theme toggle UI

All styling assumes white background (`#ffffff`) and dark text (`#171717` / zinc scale).

# 07 — Admin: fixtures · bitácora de implementación

> Hito en curso. Plan: `context/plan/07-admin-fixtures.md`.

## Estado

- [x] Paso 1 · Helpers compartidos (`madridTime`, `getDefaultTournament`,
      refactor `pythonFormat`).
- [x] Paso 2 · Listado `/admin/fixtures`.
- [ ] Paso 3 · Schemas Zod + esqueletos de server actions.
- [ ] Paso 4 · Edición `/admin/fixtures/[id]`.
- [ ] Paso 5 · Creación individual `/admin/fixtures/new`.
- [ ] Paso 6 · Import masivo (`prompts/`, `/admin/fixtures/import`,
      `previewImport` + `commitImport`).
- [ ] Paso 7 · Cosméticos (links en `/admin`, lint/typecheck/format).
- [ ] Paso 8 · Verificación funcional + roundtrip `wc2022:download`.
- [ ] Paso 9 · Producción.
- [ ] Paso 10 · Cierre de bitácora.

## Decisiones aprobadas

- DH7-1 a DH7-7 sin cambios (ver plan §1).
- En lugar de "duplicar fixture": importación masiva por JSON pegado
  generado con ChatGPT. Prompt versionado en `prompts/`.
- Contador "X fixtures bloqueados ahora" en el listado: incluido.
- Formato `external_id` para nuevos: `wc2022_<round>_NNN`.

---

## Paso 1 · Helpers compartidos

Objetivo: dejar disponible un módulo `src/lib/fixtures/pythonFormat.ts`
que la UI del hito 07 y los scripts del hito 06 compartan. Mover ahí
los Zod del formato Python y los mapas `fase ↔ stage/round`. Crear
también `src/lib/dates/madridTime.ts` con la conversión Madrid ↔ UTC
usando `Intl` (no offsets hardcoded como en `scripts/wc2022/lib/maps.ts`).

Archivos creados:

- `src/lib/dates/madridTime.ts`: 4 helpers (`madridLocalToUtcIso`,
  `utcIsoToMadridLocal`, `utcIsoToMadridInput`, `formatMadridDateTime`).
  Conversión Madrid → UTC vía `Intl.DateTimeFormat` con
  `timeZoneName: "shortOffset"`. Detecta CET/CEST automáticamente con
  un segundo paso para cubrir el cruce DST. Acepta input
  `YYYY-MM-DD HH:MM:SS`, `YYYY-MM-DDTHH:MM:SS` o `YYYY-MM-DDTHH:MM`.
- `src/lib/fixtures/catalogs.ts`: STAGES + ROUNDS + types movidos del
  script al módulo compartido.
- `src/lib/fixtures/pythonFormat.ts`: Zod (`PythonMatchSchema`,
  `PythonMatchesSchema`, `ImportFixturesSchema` con cap 1..64) +
  mapeos `fase↔stage`, `(fase, jornada)→round`, `stage→fase`,
  `round→jornada`, `tipoPartidoFromFase`.
- `src/lib/tournament/getDefaultTournament.ts`: helper server-only que
  resuelve el torneo activo desde `NEXT_PUBLIC_DEFAULT_TOURNAMENT_SLUG`.

Archivos del hito 06 convertidos en re-exports thin para que los
scripts `wc2022:upload` / `wc2022:download` sigan funcionando sin
cambios en el código que los consume:

- `scripts/wc2022/lib/catalogs.ts` → re-export de `src/lib/fixtures/catalogs`.
- `scripts/wc2022/lib/schemas.ts` → mantiene `TournamentSchema`/`TeamSchema`
  (seeder-only), re-exporta `PythonMatch*` desde `src/lib/fixtures/pythonFormat`.
- `scripts/wc2022/lib/maps.ts` → re-export de `pythonFormat` (fase maps)
  y `madridTime` (`madridLocalToUtcIso`).
- `scripts/wc2022/lib/format.ts` → re-export de `pythonFormat`
  (inverse maps) y `madridTime` (`utcIsoToMadridLocal`).

Verificación end-to-end del refactor (Supabase local levantado):

```
npm run typecheck    # verde
npm run wc2022:download   # diff 0/0/0 contra el JSON local
npm run wc2022:upload     # idempotente (48 fixtures, 0 skipped)
npm run wc2022:download   # diff 0/0/0
```

El round-trip confirma que la conversión nueva (Intl) produce las
mismas UTC ISO que la vieja (offset hardcoded `+02:00`) para los 48
fixtures de junio 2026 (CEST). Ningún campo cambió en la DB.

## Paso 2 · Listado `/admin/fixtures`

Archivos creados:

- `src/components/ui/Badge.tsx` con `Badge` (5 tonos zinc/amber/
  emerald/rose/sky) y wrapper `FixtureStatusBadge` que mapea
  `status` → tono + label en español.
- `src/app/admin/fixtures/page.tsx`: server component con:
  - `requireAdmin()` + `getDefaultTournament()`.
  - Query principal con joins a `home_team`, `away_team`, `stage`,
    `round` por explicit FK name (necesario porque hay dos FKs entre
    fixtures y teams).
  - Filtros vía `searchParams` (`round`, `status`). El filtro de
    ronda hace un lookup adicional `rounds` → `id` antes de filtrar
    `round_id`, para no acoplar la URL a UUIDs.
  - Segunda query agregada (`status, kickoff_at` solamente) para
    calcular contadores totales (no afectados por filtros), incluido
    `lockedByKickoff` = fixtures con `kickoff_at - 24h <= now`.
  - Banners de éxito por `?ok=created|updated|imported:<text>`.
  - Tabla con columnas ronda, external_id (linkado a edit), partido
    (placeholder italic gris si no hay team), fecha Madrid, badge de
    estado, link "Editar".
  - Botones "Importar JSON" (primario) y "Nuevo fixture" (secundario)
    en el header.

Probado con `curl http://localhost:3000/admin/fixtures` → `307` al
login (sin auth), confirma que la ruta existe y el middleware `proxy`
le pasa el filtro de auth correctamente.


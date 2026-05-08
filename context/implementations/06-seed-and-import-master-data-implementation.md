# 06 — Seeds e importación de master data · bitácora de implementación

> Hito ejecutado: ver plan en `context/plan/06-seed-and-import-master-data.md`.

## Resumen ejecutivo (en progreso)

Hito 06 prácticamente cerrado. Estado actual:

- [x] Plan aprobado (versión final tras decisiones D1, D4, D5, D6, D7).
- [x] `strip_results_2022.py` y JSON neutro generado (48 partidos de fase
      de grupos, fechas rebasadas a junio 2026 a las 18:00 Madrid).
- [x] Seeds canónicos `tournament.json` + `teams.json` (32 equipos
      con código FIFA + grupo + alias).
- [x] `tsx@^4.21.0` añadido como devDependency.
- [x] Seeder TypeScript implementado (`scripts/wc2022/upload.ts` + 8
      libs auxiliares).
- [x] Download script (`scripts/wc2022/download.ts`) con modo diff y
      `--write` para roundtrip Supabase ↔ JSON.
- [x] `npm run wc2022:upload` y `npm run wc2022:download` añadidos.
- [x] Validación local: 1 tournament, 6 stages, 8 rounds, 32 teams,
      48 fixtures, 0 match_results, 0 players. Idempotencia y diff
      del download verificados.
- [ ] Aplicación a producción (pendiente, lo ejecuta el autor en su
      terminal con env vars inline + `--confirm-prod`).

## Hallazgo previo · timezones del JSON Python

Inspección de `data/partidos/2022/partidos_resultados_2022.json`:

```
total: 64
por fase: fase_grupos=48, octavos=8, cuartos=4, semis=2, tercer_puesto=1, final=1
horas únicas: TODAS los 64 partidos a "02:00:00"
```

Es decir, el pipeline Python no extrajo la hora real del CSV; todas las
fechas son `YYYY-MM-DD 02:00:00`. La fecha del día parece correcta
(Qatar–Ecuador → 2022-11-20, final → 2022-12-18) pero la hora no.

Hechos comprobables:
- Qatar–Ecuador (inaugural): kickoff oficial 20-nov-2022 17:00 UTC.
- Final Argentina–Francia: 18-dic-2022 15:00 UTC.

Ninguna interpretación razonable del literal `"YYYY-MM-DD 02:00:00"`
(Madrid, UTC, Catar) coincide con esos kickoffs reales.

**Decisión para este hito**: asumo `Europe/Madrid` y convierto a UTC al
sembrar. Para 2022 (torneo de pruebas) la hora exacta no es crítica
porque los usuarios harán predicciones de prueba sin timing real. **El
admin podrá corregir `kickoff_at` desde la UI admin en hito 07** y, para
2026, el pipeline Python deberá extraer la hora correcta del CSV oficial
de FIFA.

Lo dejo anotado como deuda técnica documentada y avisado al autor.

## Decisiones tomadas (recap del plan)

- D1: solo fase de grupos (48 fixtures). Eliminatorias se irán
  añadiendo al JSON Python por el admin conforme se conozcan los
  cruces.
- D2: tabla `players` queda vacía. Pichichi/mejor jugador como texto
  libre en hito 08.
- D3: `predictions_open_until = null` para `wc_2022_test`.
- D4: `tsx` como devDependency.
- D5: Inline env vars + flag `--confirm-prod` para apuntar a prod.
- **D6 (nueva, durante implementación)**: rebase de fechas a junio-julio
  2026 con hora 18:00 Madrid en `strip_results_2022.py`. La hora original
  `02:00:00` en el JSON Python era un placeholder (todos los 64 partidos
  con la misma hora). Para 2022-test las fechas son inventadas; para
  testear el bloqueo de jornada el autor editará manualmente el JSON
  para poner kickoffs concretos a "mañana".
- **D7 (nueva, durante implementación)**: el modelo de datos es
  **bidireccional**. Supabase es la fuente de verdad de runtime, el
  JSON es buffer de sync. Implementamos dos scripts: `wc2022:upload`
  (JSON → DB) y `wc2022:download` (DB → JSON). El download solo cubre
  `fixtures` en este hito (es lo único que el admin va a poder editar
  desde la web). Ver §11 del plan para detalles.

## Pasos ejecutados

### 1. Strip script + JSON neutro

`data/raw/strip_results_2022.py`:
- Lee `data/partidos/2022/partidos_resultados_2022.json`.
- Filtra `fase == "fase_grupos"` (48 de 64 partidos).
- Mantiene shape: las 5 keys de resultado pasan a `null`.
- Rebase de `fecha`: anchor `2022-11-20` → `2026-06-11` (delta de
  +1299 días), hora fijada a `18:00:00` Madrid local.
- Output: `data/partidos/2022/partidos_2022_sin_resultados.json`.

Verificación: 48 partidos, todas las jornadas con 16 partidos cada
una (1+2+3=48), todas las fechas en junio 2026, todos los campos
de resultado nulos. Commit: `5a0b432` (la versión inicial era el
commit `8bfb94d`).

### 2. Seeds canónicos

`data/seeds/wc_2022/tournament.json` y `teams.json` (32 equipos con
código FIFA, grupo A-H, alias en/es/abreviaturas). Validación cruzada:
todos los `display_name` matchean exactamente los `equipo_1`/`equipo_2`
del JSON Python neutro. Sin duplicados. Commit: `ad069ef`.

### 3. tsx instalado

`npm install -D tsx@^4.21.0`. Sin sorpresas. Commit incluido en
`5a0b432`.

### 4. Seeder TypeScript

Estructura final:

```
scripts/wc2022/
├── upload.ts              entry: JSON → Supabase
├── download.ts            entry: Supabase → JSON (diff + --write)
└── lib/
    ├── catalogs.ts        STAGES (6) + ROUNDS (8) hardcoded
    ├── env.ts             target detection + --confirm-prod guard
    ├── format.ts          inverse maps + UTC ISO → Madrid local
    ├── log.ts             pretty step/info/done/warn/fatal
    ├── maps.ts            fase/jornada → stage/round + Madrid → UTC
    ├── paths.ts           absolute paths to the 3 input JSONs
    ├── schemas.ts         Zod for tournament/teams/python-match
    ├── supabase.ts        script-local admin client (no server-only)
    └── upserts.ts         idempotent upserts per table
```

Decisiones técnicas relevantes:

- **`createScriptAdminClient` en lugar de `createAdminClient` de
  src/lib/supabase/admin.ts**. El módulo de la app importa
  `"server-only"` que estaba dando problemas con tsx (no instalado
  como dep directa, queda atado al runtime de Next). El script cliente
  es 5 líneas y desacopla el seeder del runtime de la app.
- **Auto-rewrite de `127.0.0.1` → `192.168.0.112`**. Supabase CLI
  bindea solo al IP de LAN. `.env.local` tiene `127.0.0.1` para que
  Next funcione, pero un fetch directo de Node falla. `env.ts`
  reescribe la URL automáticamente para los scripts.
- **Stage/round catalogs hardcoded**, no en JSON. Son estables y
  caben en 30 líneas de TypeScript. `score_multiplier` es provisional
  hasta hito 11.
- **Madrid → UTC con offset hardcoded `+02:00`** en upload (CEST,
  válido para junio-julio 2026). El download usa
  `Intl.DateTimeFormat` con timezone `"Europe/Madrid"` que sí maneja
  CET/CEST automáticamente. Asimetría documentada en `maps.ts`. Si
  en el calendario real de 2026 hay alguna fecha fuera de CEST, hay
  que reemplazar la conversión del upload por `Intl` también.
- **Resolución de equipo por nombre**: el upload construye un Map
  `display_name | canonical_name | aliases[] → team_row` para
  matchear `equipo_1`/`equipo_2`. Cualquier alias funciona.

### 5. Validación local

```bash
npm run db:reset
npm run wc2022:upload
# Done: 1 tournament, 6 stages, 8 rounds, 32 teams, 48 fixtures
npm run wc2022:upload   # idempotencia: mismos conteos
npm run wc2022:download # diff: 0/0/0
```

psql sanity:
```
tournaments | 1
stages      | 6
rounds      | 8
teams       | 32
fixtures    | 48
match_results | 0
players     | 0
```

Distribución de fixtures por jornada: 16/16/16. Equipos por grupo:
4×8. `kickoff_at` almacenado como UTC (`2026-06-11 16:00:00+00`),
que mapea a `18:00 Madrid` (CEST → UTC-2).

Roundtrip:
- Modificación manual de `kickoff_at` en DB vía psql.
- `wc2022:download` reportó 1 fixture modificado correctamente.
- Re-upload restauró el estado y el siguiente download dio 0 diffs.

### 6. Producción

Pendiente. El autor lo ejecutará en su terminal con env vars inline
y flag `--confirm-prod`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://qbphxsijmqortxhxlrnr.supabase.co \
SUPABASE_SECRET_KEY=<sb_secret_de_prod> \
  npx tsx scripts/wc2022/upload.ts --confirm-prod
```

Conteos esperados idénticos a local: 1/6/8/32/48/0/0.

## Errores y resoluciones

- **`fetch failed` con `127.0.0.1:54321`** desde tsx. Confirmado con
  `curl`: solo `192.168.0.112` responde. La bitácora del hito 03
  decía "Docker mapea ambos" pero no es cierto en mi entorno.
  Resuelto auto-reescribiendo la URL en `env.ts`.

- **Primer upload trajo 64 fixtures, no 48**. Causa: el JSON Python
  neutro tenía los 64 partidos (los 16 eliminatorios con equipos ya
  resueltos del 2022). El seeder no filtraba por fase. Resolución:
  filtrar `fase == "fase_grupos"` directamente en
  `strip_results_2022.py` (mantiene la ergonomía: cuando el admin
  añada eliminatorios al JSON, el seeder los procesará sin cambios
  de código).

- **Typecheck del download**: `match_results` tipado por Supabase
  como objeto 1:1 (gracias al unique constraint en `fixture_id`),
  pero el runtime puede devolver array. Helper `resultOf()` que
  normaliza ambas formas.

- **Importación de `server-only`** desde un script Node-puro (tsx).
  Resuelto creando un admin client local en
  `scripts/wc2022/lib/supabase.ts`, evitando depender del módulo de
  la app.

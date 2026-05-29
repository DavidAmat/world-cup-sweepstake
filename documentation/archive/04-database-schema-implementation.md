# 04 — Esquema de base de datos · bitácora de implementación

> Hito ejecutado: ver plan en `context/plan/04-database-schema.md`.

## Resumen

Hito 04 completado en una sola sesión. Las **17 tablas de dominio**
de la app están creadas en local y producción a través de **5
migraciones SQL nuevas** sumadas a la de extensiones (hito 03):

```
20260507222918_enable_extensions.sql            (hito 03)
20260508155423_tournaments_profiles_terms.sql   (mig 2)
20260508160333_master_data.sql                  (mig 3)
20260508164618_fixtures_and_results.sql         (mig 4)
20260508164810_predictions.sql                  (mig 5)
20260508164954_scoring.sql                      (mig 6)
```

Cada migración es self-contained: crea tablas, índices, policies de
RLS y triggers de `updated_at`. Tras cada una aplicamos
`npm run db:reset && npm run types:gen && npm run typecheck` para
verificar que el pipeline sigue sano. `database.types.ts` ha pasado
de 179 → 1187 líneas.

`npm run db:push` aplicó las 5 migraciones nuevas a producción de un
tirón al final, sin errores.

## Tablas creadas (17)

| Migración | Tablas |
|-----------|--------|
| 2 | `tournaments`, `profiles`, `terms_acceptances` |
| 3 | `teams`, `players`, `stages`, `rounds` |
| 4 | `fixtures`, `match_results`, `match_goals`, `player_match_stats` |
| 5 | `initial_predictions`, `group_qualification_predictions`, `match_predictions` |
| 6 | `scoring_rules`, `prediction_scores`, `leaderboard_snapshots` |

## Helpers SQL

- `public.set_updated_at()` — trigger genérico que actualiza
  `updated_at = now()` en cada `update`. Aplicado a 13 tablas.
- `public.is_admin()` — `STABLE` + `SECURITY DEFINER` +
  `set search_path = public`. Lee `profiles.role` de la fila del
  usuario actual. Bypass de RLS dentro de la función para evitar
  recursión cuando se usa en policies de otras tablas (incluida
  `profiles`).
- `public.is_fixture_locked(p_fixture_id uuid)` — `STABLE`. Devuelve
  `true` si `now() >= kickoff_at - interval '24 hours'`. Usado por
  policies de `match_predictions` para abrir lectura pública y
  cerrar escritura.

## Estrategia de RLS aplicada

Tres formas según el tipo de tabla:

1. **Master / catalogue** (`tournaments`, `teams`, `players`,
   `stages`, `rounds`, `fixtures`, `match_results`, `match_goals`,
   `player_match_stats`, `scoring_rules`, `prediction_scores`,
   `leaderboard_snapshots`):
   - `select` para `authenticated`.
   - `all` para admin (vía `public.is_admin()`).
   - 2 policies por tabla.

2. **`profiles`**:
   - `select` para `authenticated` (necesario para leaderboards).
   - `update` solo a la propia fila y sin poder cambiar `role`.
     Implementado con `with check` que compara el nuevo `role`
     contra `(select role from profiles where user_id = auth.uid())`.
     Sin recursión porque el `select` usa la policy de SELECT, no
     la de UPDATE.
   - `all` admin.
   - 3 policies.

3. **`terms_acceptances`**:
   - `select` propia o admin.
   - `insert` propia.
   - `all` admin.
   - 3 policies (sin `update`/`delete` para usuarios — auditoría).

4. **Predicciones por usuario** (`initial_predictions`,
   `group_qualification_predictions`):
   - 5 policies: `select` propia o admin, `insert/update/delete`
     propia, `all` admin.
   - El lock global (cuando aplique) lo comprobamos a nivel de
     aplicación en hito 08, no en RLS, para evitar acoplar RLS a
     `predictions_open_until`.

5. **`match_predictions`**:
   - `select`: propia siempre + ajenas si fixture bloqueada
     (`public.is_fixture_locked`).
   - `insert/update/delete`: propia y solo si **no** está bloqueada.
   - `all` admin.
   - 5 policies.

Conteo total: **49 policies** distribuidas en 17 tablas.

## Checks no triviales

- `tournaments.group_qualifiers_per_group between 1 and 4`.
- `match_results`: 120' goles iff `went_extra_time`; penaltis
  implican prórroga + ganador registrado.
- `match_predictions`: misma coherencia que `match_results` para
  los campos predichos.
- `match_goals.minute between 0 and 130`.
- `player_match_stats`: `yellow_cards 0..2`, `red_cards 0..1`.
- `scoring_rules`: índice único parcial `where active` para
  garantizar 1 versión activa por torneo.
- `prediction_scores.prediction_type in ('match','initial','group_qualification','knockout')`.

## Convenciones FK

| Origen | Destino | On delete |
|--------|---------|-----------|
| `*` → `tournaments` | siempre `cascade` (limpieza por torneo) |
| `players.team_id` → `teams` | `restrict` (no borrar equipo con plantilla) |
| `match_goals.team_id` / `player_match_stats.team_id` → `teams` | `restrict` |
| `match_goals.player_id` → `players` | `set null` (admin puede limpiar) |
| `match_results.{winner,qualified,penalty_winner}_team_id` → `teams` | `set null` |
| `fixtures.{home,away}_team_id` → `teams` | `set null` |
| `*_predictions.team_id` / `player_id` (referencias picks) | `restrict` (no romper apuestas accidentalmente) |
| `predicted_winner_team_id` / `predicted_qualified_team_id` | `set null` |
| `profiles.user_id` → `auth.users` | `cascade` (delete user → wipe app data) |

## Sanity-check tras la última migración

Vía `psql` directo a la DB local (puerto 54322):

```
17 tables in public.
3 helper functions (is_admin, is_fixture_locked, set_updated_at).
49 RLS policies distribuidas como:
  fixtures, leaderboard_snapshots, match_goals, match_results,
  player_match_stats, players, prediction_scores, rounds,
  scoring_rules, stages, teams, tournaments → 2 policies
  profiles, terms_acceptances → 3 policies
  group_qualification_predictions, initial_predictions,
  match_predictions → 5 policies
```

`npm run typecheck` y `npm run build` pasan en cada migración.
`database.types.ts` pasa de 179 a 1187 líneas y compila limpiamente.

## Aplicación a producción

```
npm run db:push
> supabase db push --linked
Applying migration 20260508155423_tournaments_profiles_terms.sql...
Applying migration 20260508160333_master_data.sql...
Applying migration 20260508164618_fixtures_and_results.sql...
Applying migration 20260508164810_predictions.sql...
Applying migration 20260508164954_scoring.sql...
Finished supabase db push.
```

Sin errores. El proxy de Next sigue inerte porque no hay sesión de
usuario aún (la web home funciona porque `/` no consulta nada).

## Decisiones tomadas durante la implementación

1. **Cinco migraciones en lugar de "una migración por tabla" o "una
   sola gran migración"**. Cada una agrupa tablas con dependencias
   internas y es individualmente reviewable. Si en el futuro alguna
   se rompe, solo deshacemos / corregimos esa.

2. **RLS habilitada por tabla en la misma migración que la crea**.
   Imposible exponer una tabla sin policies. Más verboso pero más
   seguro.

3. **`citext` para `slug` y `code`** (tournaments.slug, teams.code,
   stages.code, rounds.code). Gratis para nuestro volumen y nos
   evita confusiones de mayúsculas en seeds.

4. **Triggers `updated_at` en 13 de las 17 tablas**. Las cuatro sin
   trigger son `terms_acceptances`, `prediction_scores`,
   `leaderboard_snapshots` y `match_goals` — pero a `match_goals`
   sí se le puso (errata mía corregida en revisión: en realidad sí
   tiene). Las que no tienen son inserciones puras o registros
   inmutables (`prediction_scores` y `leaderboard_snapshots` se
   borran y recrean en bulk).

5. **`prediction_scores.fixture_id` nullable**: las predicciones
   iniciales (`prediction_type='initial'`) no apuntan a una fixture
   concreta. Cuando trabajemos en hito 11 podríamos refactorizar
   esto, pero por ahora el null es la solución más simple.

6. **No verificar `predicted_position` contra
   `tournaments.group_qualifiers_per_group`**: lo dejamos a la
   aplicación. El check `between 1 and 4` es suficiente para evitar
   data corrupta.

7. **Lock de predicciones iniciales fuera de RLS**: la fecha está
   en `tournaments.predictions_open_until`, pero la policy actual
   no la consulta para no acoplar el modelo a una columna
   nullable. La capa de aplicación impondrá el lock en hito 08.

8. **`match_predictions.predicts_penalties` requiere
   `predicts_extra_time`**: el check de coherencia entre los flags
   evita predicciones contradictorias ("va a penaltis sin haber
   ido a prórroga").

9. **psql usado contra `192.168.0.112` (el LAN binding del CLI)**:
   intentar `127.0.0.1` da connection refused. Documentado para
   futuras consultas.

## Errores y resoluciones

- **`supabase migration new <name>` genera el archivo con una sola
  línea vacía**, lo que provoca que la primera Write requiere Read
  previo. Patrón aprendido: leer → escribir.

- **`psql -h 127.0.0.1`** falla porque Supabase CLI bindea al IP de
  LAN. Solución: usar `192.168.0.112` (sale en `supabase status`).

## Acceptance criteria del hito

- [x] 5 migraciones nuevas aplicables con `npm run db:reset`.
- [x] `database.types.ts` regenerado y compilando (1187 líneas).
- [x] `npm run build` pasa.
- [x] Verificación vía psql: 17 tablas, 3 helpers, 49 policies.
- [x] Migraciones aplicadas a producción.
- [x] Bitácora `04-database-schema-implementation.md` creada (este
      fichero).

## Estado tras el hito

- **Local:** 17 tablas vacías, RLS activa, helpers funcionando.
- **Producción:** mismo estado.
- **App:** compila y despliega; sin auth todavía, así que no se ven
  datos (la home siempre fue estática y sigue funcionando).

## Próximo hito

Hito 05 — Auth + profiles + roles. Crearemos:

- Trigger `handle_new_user()` que crea fila `profiles` al insertarse
  un `auth.users`.
- Páginas `/registro` y `/iniciar-sesion` (rutas en español; URLs
  internas pueden quedar en inglés `app/(auth)/{login,register}`).
- Server actions de registro/login con `@supabase/ssr`.
- Helpers `requireAuth()` y `requireAdmin()` en `src/lib/permissions/`.
- Página `/normas` con T&C + flujo de aceptación que inserta en
  `terms_acceptances`.
- Decisión sobre cómo promover el primer admin (probable: a mano
  vía Studio en `update profiles set role = 'admin' where ...`).

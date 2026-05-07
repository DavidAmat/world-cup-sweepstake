# Project Initiation Document — World Cup Sweepstake

## 1. Contexto del proyecto

### 1.1 Objetivo general

El objetivo es construir una aplicación web para gestionar una porra privada del Mundial de fútbol 2026 entre amigos.

La aplicación sustituirá el sistema manual basado en Excel y mensajes privados al administrador. Permitirá que cada usuario introduzca sus predicciones, que estas queden bloqueadas antes de cada partido, que los resultados sean introducidos manualmente por un administrador y que las puntuaciones se calculen de forma transparente y recalculable.

El foco no es construir una aplicación comercial ni una plataforma de alto tráfico. Es una herramienta privada, visual, simple y suficientemente robusta para aproximadamente 10 usuarios.

### 1.2 Problema actual

En ediciones anteriores, la porra se gestionaba manualmente:

- Los usuarios enviaban sus predicciones en secreto al administrador.
- El administrador las recopilaba en un Excel.
- Las predicciones se hacían públicas cuando ya no podían modificarse.
- Las puntuaciones se calculaban con reglas simples y poco flexibles.
- Había quejas sobre edge cases y criterios de puntuación.
- Cambiar normas o recalcular puntuaciones era incómodo.
- El administrador invertía demasiado tiempo introduciendo datos.

La nueva aplicación busca reducir este trabajo manual, mejorar la transparencia y permitir un sistema de puntuación más justo.

### 1.3 Principios del proyecto

- Simplicidad por encima de arquitectura compleja.
- Coste cero o casi cero usando free tiers.
- Supabase como fuente de verdad de datos.
- Next.js como aplicación full-stack.
- Resultados introducidos manualmente por el administrador.
- Puntuaciones siempre recalculables.
- Testing inicial usando el Mundial 2022.
- Mundial 2026 como torneo real.
- Nada de scraping ni Gemini dentro de la aplicación principal.
- Documentación continua dentro del repositorio.

### 1.4 Decisiones ya cerradas

- Se usará `tournament_id` repetido en las tablas relevantes.
- No se usarán schemas separados por torneo.
- No se usarán bases de datos separadas por torneo.
- No se usará Prisma inicialmente.
- No se usará backend separado tipo Django/FastAPI.
- No se guardarán datos runtime en JSON dentro del repo.
- No se guardarán contraseñas en texto plano.
- Se usará Supabase Auth con email/password.
- Se usará Supabase CLI para migraciones.
- Se usará Vercel para deployment.
- Se usará GitHub como repositorio y flujo de trabajo.
- Los resultados de partidos serán introducidos manualmente por el administrador.
- Gemini solo se podrá usar fuera de la app, de forma auxiliar, para preparar JSONs de calendario o seeds.

---

## 2. Alcance funcional

### 2.1 Funcionalidades principales

La aplicación permitirá:

1. Registro y login de usuarios.
2. Aceptación obligatoria de términos y condiciones de puntuación.
3. Predicciones iniciales del torneo.
4. Predicciones de partidos de fase de grupos.
5. Predicciones de partidos de eliminatorias cuando se conozcan los cruces.
6. Bloqueo de edición 24 horas antes del inicio de cada partido.
7. Visualización pública de predicciones una vez bloqueadas.
8. Introducción manual de resultados por parte del administrador.
9. Introducción manual de goles y goleadores.
10. Gestión manual de prórroga y penaltis en eliminatorias.
11. Cálculo y recálculo de puntuaciones.
12. Leaderboard general.
13. Leaderboards parciales por jornada, fase y categoría de puntuación.
14. Página visual de evolución de puntos por jornada.
15. Gestión admin de equipos, jugadores, fixtures y resultados.
16. Reset controlado de datos de testing.

### 2.2 Funcionalidades fuera de alcance inicialmente

No se incluirá inicialmente:

- Login con Google.
- Backend separado.
- App móvil nativa.
- Scraping automático de resultados.
- Integración automática con APIs deportivas.
- Gemini dentro del flujo productivo de resultados.
- Predicciones de corners, faltas, tarjetas u otras estadísticas avanzadas.
- Sistema multi-organización o multi-liga complejo.
- Pagos.
- Notificaciones push.

---

## 3. Parte técnica

### 3.1 Stack recomendado

La aplicación se construirá con:

- **Next.js** con App Router.
- **TypeScript**.
- **Tailwind CSS** para estilos.
- **Supabase Auth** para autenticación.
- **Supabase Postgres** como base de datos.
- **Supabase Row Level Security** para proteger datos.
- **Supabase CLI** para desarrollo local y migraciones.
- **Vercel** para deployment.
- **GitHub** para versionado y CI/CD básico.
- **Zod** para validación de formularios y JSONs importados.

### 3.2 Arquitectura general

La aplicación será full-stack dentro de Next.js:

```txt
Browser
  ↓
Next.js frontend pages/components
  ↓
Next.js server actions / API routes
  ↓
Supabase client / service role client
  ↓
Supabase Postgres
```

Se diferenciarán dos tipos de acceso a Supabase:

1. **Cliente autenticado de usuario**  
   Usado para operaciones normales del usuario.

2. **Service role server-side**  
   Usado únicamente en rutas/admin server-side para acciones privilegiadas como recalcular puntuaciones, resets controlados o operaciones administrativas.

La `service_role_key` nunca debe exponerse en el navegador.

### 3.3 Frontend

El frontend se organizará con Next.js App Router.

Estructura aproximada:

```txt
/app
  /(auth)
    /login
    /register
  /(app)
    /dashboard
    /predictions
    /calendar
    /results
    /leaderboard
    /stats
    /rules
    /profile
  /admin
    /fixtures
    /results
    /players
    /scoring
    /reset
  /api
    /admin
      /recalculate-scores
      /reset-tournament
```

Componentes comunes:

```txt
/components
  /layout
  /forms
  /predictions
  /fixtures
  /leaderboard
  /results
  /admin
  /charts
```

Librerías recomendadas:

- Tailwind CSS para estilos.
- shadcn/ui o componentes propios simples.
- Recharts para gráficas de evolución de puntuación.
- React Hook Form + Zod para formularios.

### 3.4 Backend

No habrá backend separado.

La lógica backend vivirá en:

- Server actions de Next.js.
- API routes de Next.js.
- Funciones TypeScript internas en `/lib`.

Ejemplo de organización:

```txt
/lib
  /supabase
    client.ts
    server.ts
    admin.ts
  /scoring
    calculateMatchPredictionScore.ts
    calculateInitialPredictionScore.ts
    recalculateTournamentScores.ts
  /fixtures
    importFixtures.ts
    validateFixtureJson.ts
  /permissions
    requireAdmin.ts
    requireAuth.ts
  /dates
    predictionLock.ts
```

### 3.5 Supabase

Supabase se usará para:

- Auth.
- Base de datos Postgres.
- Row Level Security.
- Migraciones.
- Desarrollo local.

No se usará Supabase Storage inicialmente salvo que más adelante se quiera subir imágenes, avatares o documentos.

### 3.6 Autenticación

Se usará Supabase Auth con email/password.

No se guardarán contraseñas en texto plano.

Cada usuario tendrá una fila en `profiles`:

```txt
profiles
- user_id
- display_name
- initials
- role
- created_at
```

Roles:

```txt
admin
player
```

El administrador podrá:

- Gestionar resultados.
- Gestionar jugadores.
- Importar fixtures.
- Recalcular puntuaciones.
- Resetear datos de testing.
- Editar reglas de puntuación si se habilita esta funcionalidad.

### 3.7 Desarrollo local

El desarrollo se hará en local, no directamente en Vercel.

Flujo local esperado:

```bash
npm install
supabase start
supabase db reset
npm run dev
```

Variables locales:

```txt
.env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

El archivo `.env.local` estará en `.gitignore`.

Se podrá usar Supabase local para probar migraciones y seeds antes de desplegar.

### 3.8 Deployment

El deployment se hará en Vercel conectado al repositorio de GitHub.

Flujo esperado:

```txt
branch feature/*
  ↓
Pull Request en GitHub
  ↓
Vercel Preview Deployment
  ↓
Merge a main/master
  ↓
Vercel Production Deployment
```

Vercel tendrá configuradas sus propias variables de entorno:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Si más adelante se usara Gemini fuera o dentro de algún proceso server-side, la API key iría como variable de entorno, nunca en el repo.

### 3.9 CI/CD

La primera versión de CI/CD será simple:

- GitHub como source of truth.
- Vercel conectado al repo.
- Preview deployments automáticos en Pull Requests.
- Production deployment automático al mergear en `main` o `master`.

Opcionalmente se añadirá GitHub Actions para:

- Ejecutar lint.
- Ejecutar typecheck.
- Ejecutar tests.

Ejemplo de checks mínimos:

```bash
npm run lint
npm run typecheck
npm run test
```

### 3.10 Migraciones de base de datos

No se usará Prisma inicialmente.

Se usarán migraciones SQL de Supabase CLI:

```txt
/supabase/migrations
  20260507120000_create_initial_schema.sql
  20260508100000_add_scoring_rules.sql
```

Principios:

- Nunca editar manualmente la base de producción sin migración.
- Añadir columnas con `ALTER TABLE`.
- Evitar operaciones destructivas sin backup o confirmación.
- Las migraciones no deben borrar datos existentes salvo que sea explícitamente una migración de limpieza.
- Los resets de testing se harán desde funcionalidad admin o scripts controlados, no modificando migraciones antiguas.

### 3.11 Documentación en el repositorio

El repo tendrá una carpeta:

```txt
/Context
```

Dentro se guardarán documentos de contexto e implementación.

Convención:

```txt
001-initial-project-prompt.md
001-initial-project-implementation.md
002-scoring-system-prompt.md
002-scoring-system-implementation.md
003-admin-results-flow-prompt.md
003-admin-results-flow-implementation.md
```

Los archivos `*-prompt.md` contendrán:

- Petición original.
- Decisiones relevantes.
- Restricciones.
- Dudas abiertas.

Los archivos `*-implementation.md` contendrán:

- Qué se implementó.
- Qué archivos se tocaron.
- Qué decisiones cambiaron.
- Qué errores aparecieron.
- Cómo se resolvieron.
- Qué queda pendiente.

Este proceso permitirá que una IA o desarrollador futuro entienda el contexto sin tener que reconstruir toda la conversación.

---

## 4. Modelo de datos en Supabase

### 4.1 Principios del modelo

- Una sola base de datos.
- Un solo schema principal: `public`.
- Uso repetido de `tournament_id` en tablas de dominio.
- Datos runtime en Supabase, no en JSON.
- JSONs solo para seeds/importación inicial.
- Puntuaciones derivadas y recalculables.
- Predicciones y resultados como fuente de verdad.
- Reglas de puntuación versionables.

### 4.2 Tablas principales

#### tournaments

Representa cada competición o entorno de torneo.

Ejemplos:

- World Cup 2022 Test
- World Cup 2026

Campos:

```txt
tournaments
- id uuid primary key
- name text
- year integer
- status text -- draft | active | completed | archived
- is_test boolean
- created_at timestamptz
- updated_at timestamptz
```

#### profiles

Perfil público de cada usuario autenticado.

```txt
profiles
- user_id uuid primary key references auth.users(id)
- display_name text
- initials text
- role text -- admin | player
- created_at timestamptz
- updated_at timestamptz
```

#### terms_acceptances

Registro de aceptación de normas.

```txt
terms_acceptances
- id uuid primary key
- tournament_id uuid references tournaments(id)
- user_id uuid references profiles(user_id)
- rules_version integer
- accepted_at timestamptz
```

#### teams

Selecciones participantes en un torneo.

```txt
teams
- id uuid primary key
- tournament_id uuid references tournaments(id)
- code text -- ESP, ARG, FRA, etc.
- canonical_name text
- display_name text
- aliases jsonb
- group_code text nullable
- created_at timestamptz
- updated_at timestamptz
```

Notas:

- `teams` pertenece al torneo.
- España 2022 y España 2026 pueden ser filas diferentes.
- Esto evita problemas si cambian nombres, grupos o metadatos.

#### players

Jugadores convocados por selección y torneo.

```txt
players
- id uuid primary key
- tournament_id uuid references tournaments(id)
- team_id uuid references teams(id)
- canonical_name text
- display_name text
- aliases jsonb
- active boolean
- created_at timestamptz
- updated_at timestamptz
```

Notas:

- El ID del jugador no depende del dorsal.
- Si un jugador se cae y entra otro, se marca el anterior como inactivo o se borra solo si no hay referencias.
- El nuevo jugador recibe un ID nuevo.
- Las predicciones existentes no deben romperse.

#### stages

Catálogo de fases del torneo.

```txt
stages
- id uuid primary key
- tournament_id uuid references tournaments(id)
- code text -- group_stage, round_of_32, round_of_16, quarter_final, semi_final, third_place, final
- name text
- sort_order integer
- score_multiplier numeric
```

Ejemplos:

```txt
group_stage      multiplier 1.0
round_of_32      multiplier 1.2
round_of_16      multiplier 1.4
quarter_final    multiplier 1.6
semi_final       multiplier 1.8
final            multiplier 2.0
```

Los valores exactos se decidirán al definir el sistema de scoring.

#### rounds

Jornadas o bloques dentro de una fase.

```txt
rounds
- id uuid primary key
- tournament_id uuid references tournaments(id)
- stage_id uuid references stages(id)
- code text -- group_md1, group_md2, group_md3, r16, qf, sf, final
- name text -- Jornada 1, Jornada 2, Octavos, Cuartos, etc.
- sort_order integer
```

#### fixtures

Partidos programados.

```txt
fixtures
- id uuid primary key
- tournament_id uuid references tournaments(id)
- stage_id uuid references stages(id)
- round_id uuid references rounds(id)
- group_code text nullable
- home_team_id uuid references teams(id) nullable
- away_team_id uuid references teams(id) nullable
- home_placeholder text nullable
- away_placeholder text nullable
- kickoff_at timestamptz
- status text -- scheduled | locked | completed | cancelled
- created_at timestamptz
- updated_at timestamptz
```

Notas:

- En fase de grupos, `home_team_id` y `away_team_id` estarán definidos desde el inicio.
- En eliminatorias, al principio puede haber placeholders: `Winner Group A`, `Runner-up Group B`, etc.
- Cuando se conozcan los equipos, el admin podrá asignarlos.

#### match_results

Resultado oficial introducido manualmente por el administrador.

```txt
match_results
- id uuid primary key
- tournament_id uuid references tournaments(id)
- fixture_id uuid references fixtures(id) unique
- home_goals_90 integer
- away_goals_90 integer
- went_extra_time boolean
- home_goals_120 integer nullable
- away_goals_120 integer nullable
- went_penalties boolean
- penalty_winner_team_id uuid references teams(id) nullable
- winner_team_id uuid references teams(id)
- qualified_team_id uuid references teams(id) nullable
- result_status text -- draft | confirmed
- created_by uuid references profiles(user_id)
- created_at timestamptz
- updated_at timestamptz
```

Interpretación:

- En fase de grupos normalmente solo se usan goles a 90 minutos.
- En eliminatorias puede haber prórroga.
- Si hay penaltis, no se guardará necesariamente el resultado de penaltis salvo que más adelante se quiera mostrar.
- Lo importante es saber quién gana/pasa.
- `winner_team_id` representa el ganador oficial del partido.
- `qualified_team_id` representa el equipo que pasa la eliminatoria.

#### match_goals

Goles marcados en un partido.

```txt
match_goals
- id uuid primary key
- tournament_id uuid references tournaments(id)
- fixture_id uuid references fixtures(id)
- team_id uuid references teams(id)
- player_id uuid references players(id) nullable
- minute integer nullable
- period text -- first_half | second_half | extra_time_first | extra_time_second | unknown
- own_goal boolean
- penalty_goal boolean
- created_at timestamptz
- updated_at timestamptz
```

Notas:

- El admin seleccionará el goleador de la lista de jugadores del equipo.
- Si no se conoce el minuto, puede quedar vacío.
- No se registrarán los lanzadores de tandas de penaltis.
- Un gol de penalti durante el partido sí podría marcarse como `penalty_goal` si se desea.

#### player_match_stats

Estadísticas opcionales por jugador y partido.

```txt
player_match_stats
- id uuid primary key
- tournament_id uuid references tournaments(id)
- fixture_id uuid references fixtures(id)
- team_id uuid references teams(id)
- player_id uuid references players(id)
- minutes_played integer nullable
- goals integer default 0
- assists integer default 0
- yellow_cards integer default 0
- red_cards integer default 0
- created_at timestamptz
- updated_at timestamptz
```

Esta tabla permitirá la página de estadísticas por selección.

Inicialmente puede no estar completa si el admin no quiere introducir tantos datos manualmente.

#### initial_predictions

Predicciones hechas al inicio de la porra.

```txt
initial_predictions
- id uuid primary key
- tournament_id uuid references tournaments(id)
- user_id uuid references profiles(user_id)
- champion_team_id uuid references teams(id) nullable
- runner_up_team_id uuid references teams(id) nullable
- top_scorer_player_id uuid references players(id) nullable
- best_player_id uuid references players(id) nullable
- submitted_at timestamptz
- locked_at timestamptz nullable
- updated_at timestamptz
```

#### group_qualification_predictions

Predicción de equipos que pasan de fase de grupos.

```txt
group_qualification_predictions
- id uuid primary key
- tournament_id uuid references tournaments(id)
- user_id uuid references profiles(user_id)
- group_code text
- team_id uuid references teams(id)
- predicted_position integer nullable
- created_at timestamptz
- updated_at timestamptz
```

Notas:

- Puede permitir elegir 2 o 3 equipos según el formato final del torneo.
- `predicted_position` puede usarse si queremos puntuar también el orden.

#### match_predictions

Predicciones de resultados de partidos.

```txt
match_predictions
- id uuid primary key
- tournament_id uuid references tournaments(id)
- fixture_id uuid references fixtures(id)
- user_id uuid references profiles(user_id)
- home_goals_90 integer
- away_goals_90 integer
- predicts_extra_time boolean default false
- home_goals_120 integer nullable
- away_goals_120 integer nullable
- predicts_penalties boolean default false
- predicted_winner_team_id uuid references teams(id) nullable
- predicted_qualified_team_id uuid references teams(id) nullable
- submitted_at timestamptz
- updated_at timestamptz
```

Interpretación:

- En fase de grupos, normalmente solo se predicen goles a 90 minutos.
- En eliminatorias, el usuario puede predecir empate a 90, prórroga, resultado a 120, penaltis y equipo clasificado.
- Esto evita ambigüedad entre empate a 90 minutos y empate tras prórroga.

#### scoring_rules

Reglas de puntuación configurables por torneo y versión.

```txt
scoring_rules
- id uuid primary key
- tournament_id uuid references tournaments(id)
- version integer
- rules jsonb
- active boolean
- created_at timestamptz
- updated_at timestamptz
```

Ejemplo conceptual de `rules`:

```json
{
  "match": {
    "correct_winner": 5,
    "exact_score_90": 10,
    "goal_distance": {
      "per_team_exact": 3,
      "one_goal_off": 2,
      "two_goals_off": 1
    },
    "goal_difference_exact": 3,
    "goal_difference_close": 1
  },
  "knockout": {
    "correct_extra_time": 2,
    "correct_penalties": 2,
    "correct_qualified_team": 5,
    "exact_score_120": 5
  },
  "stage_multipliers": {
    "group_stage": 1.0,
    "round_of_32": 1.2,
    "round_of_16": 1.4,
    "quarter_final": 1.6,
    "semi_final": 1.8,
    "final": 2.0
  },
  "initial_predictions": {
    "champion": 20,
    "runner_up": 12,
    "top_scorer": 15,
    "best_player": 15,
    "group_qualifier": 3,
    "group_position_exact": 2
  }
}
```

Los valores son ejemplos. Las cifras finales se decidirán en una fase posterior.

#### prediction_scores

Puntuaciones calculadas por predicción.

```txt
prediction_scores
- id uuid primary key
- tournament_id uuid references tournaments(id)
- user_id uuid references profiles(user_id)
- fixture_id uuid references fixtures(id) nullable
- prediction_type text -- match | initial | group_qualification | knockout
- scoring_rules_version integer
- points_total numeric
- points_breakdown jsonb
- calculated_at timestamptz
```

Notas:

- Esta tabla es derivada.
- Puede borrarse y recalcularse.
- `points_breakdown` permitirá mostrar al usuario de dónde salen sus puntos.

Ejemplo de breakdown:

```json
{
  "correct_winner": 5,
  "home_goals_close": 2,
  "away_goals_exact": 3,
  "goal_difference_close": 1,
  "stage_multiplier": 1.4,
  "total_before_multiplier": 11,
  "total_after_multiplier": 15.4
}
```

#### leaderboard_snapshots

Opcional para guardar evolución por jornada.

```txt
leaderboard_snapshots
- id uuid primary key
- tournament_id uuid references tournaments(id)
- round_id uuid references rounds(id)
- user_id uuid references profiles(user_id)
- total_points numeric
- rank integer
- created_at timestamptz
```

Puede recalcularse también, pero guardarlo simplifica gráficas de evolución.

### 4.3 JSON de fixtures para importación inicial

Aunque la app no usará Gemini internamente, se podrá preparar un JSON externo de calendario e importarlo.

Formato recomendado:

```json
{
  "tournament": {
    "name": "World Cup 2026",
    "year": 2026
  },
  "fixtures": [
    {
      "external_id": "wc2026_group_a_md1_match_001",
      "stage_code": "group_stage",
      "round_code": "group_md1",
      "round_name": "Jornada 1",
      "group_code": "A",
      "match_type": "group",
      "home_team_name": "Mexico",
      "away_team_name": "South Africa",
      "kickoff_at": "2026-06-11T20:00:00Z",
      "venue": null
    },
    {
      "external_id": "wc2026_round_of_16_match_001",
      "stage_code": "round_of_16",
      "round_code": "r16",
      "round_name": "Octavos de final",
      "group_code": null,
      "match_type": "knockout",
      "home_team_name": null,
      "away_team_name": null,
      "home_placeholder": "Winner Group A",
      "away_placeholder": "Runner-up Group B",
      "kickoff_at": "2026-06-28T20:00:00Z",
      "venue": null
    }
  ]
}
```

Reglas del JSON:

- `external_id` debe ser estable e idempotente.
- `stage_code` identifica la fase.
- `round_code` identifica jornada o ronda.
- `match_type` será `group` o `knockout`.
- En fase de grupos deben venir los equipos.
- En eliminatorias pueden venir placeholders si aún no se conocen los cruces.
- `kickoff_at` debe venir en formato ISO con timezone.
- El importador validará el JSON con Zod.
- El importador hará match contra `teams` por nombre o alias.
- El admin podrá corregir manualmente fixtures si algo falla.

### 4.4 Reglas de bloqueo de predicciones

Cada fixture tiene `kickoff_at`.

Una predicción se puede editar si:

```txt
now < kickoff_at - 24 horas
```

Una predicción queda bloqueada si:

```txt
now >= kickoff_at - 24 horas
```

Las predicciones bloqueadas se podrán mostrar públicamente.

### 4.5 Reset de datos de testing

El administrador podrá resetear datos por torneo.

Ejemplo:

```txt
Reset World Cup 2022 Test Data
```

Antes de ejecutar, se mostrará un diálogo de confirmación donde el admin deberá escribir:

```txt
BORRAR
```

El reset podrá borrar:

- Predicciones.
- Resultados.
- Goles.
- Puntuaciones.
- Snapshots.

No debería borrar necesariamente:

- Usuarios.
- Profiles.
- Torneos.
- Equipos.
- Jugadores.
- Fixtures base.

Puede existir un reset más agresivo solo para entorno local.

---

## 5. Interfaz de usuario

### 5.1 Login y registro

Páginas:

```txt
/login
/register
```

Funciones:

- Registro con email/password.
- Login con email/password.
- Creación o actualización de profile.
- Redirección a términos si no se han aceptado.

### 5.2 Página de términos y condiciones

Página:

```txt
/rules
```

Funciones:

- Mostrar reglas de puntuación actuales.
- Mostrar versión de reglas.
- Explicar de forma resumida cómo se puntúa.
- Requerir aceptación antes de participar.

Objetivo:

- Evitar quejas posteriores sobre reglas.
- Dejar trazabilidad de qué versión aceptó cada usuario.

### 5.3 Dashboard principal

Página:

```txt
/dashboard
```

Funciones:

- Resumen del usuario.
- Próximos partidos pendientes de predecir.
- Partidos bloqueados próximos.
- Últimos resultados.
- Puntos totales.
- Posición en leaderboard.

### 5.4 Predicciones iniciales

Página:

```txt
/predictions/initial
```

Predicciones:

- Campeón del Mundial.
- Subcampeón.
- Pichichi.
- Mejor jugador del Mundial.
- Equipos que pasan de grupos.
- Opcionalmente posición exacta en grupo.

Estas predicciones se hacen al inicio y quedan bloqueadas.

### 5.5 Vista pública de predicciones iniciales

Página:

```txt
/predictions/initial/public
```

Comportamiento visual:

- Cada usuario aparece como un bloque/div.
- No se usará dropdown de usuario.
- Se podrá comparar visualmente lo que ha puesto cada uno.
- Sí puede haber dropdown por categoría de predicción:
  - Campeón.
  - Subcampeón.
  - Pichichi.
  - Mejor jugador.
  - Clasificados por grupo.

### 5.6 Calendario de partidos

Página:

```txt
/calendar
```

Funciones:

- Ver partidos por jornada/ronda.
- Dropdown para seleccionar:
  - Jornada 1.
  - Jornada 2.
  - Jornada 3.
  - Dieciseisavos si aplica.
  - Octavos.
  - Cuartos.
  - Semifinales.
  - Final.
- Mostrar fecha y hora de kickoff.
- Mostrar estado:
  - Abierto a predicciones.
  - Bloqueado.
  - Completado.

### 5.7 Predicciones de partidos

Página:

```txt
/predictions/matches
```

Funciones para fase de grupos:

- Predecir goles equipo local.
- Predecir goles equipo visitante.
- Editar hasta 24 horas antes.

Funciones para eliminatorias:

- Predecir resultado a 90 minutos.
- Indicar si habrá prórroga.
- Si hay prórroga, predecir resultado a 120 minutos.
- Indicar si habrá penaltis.
- Indicar equipo que pasa.
- Evitar ambigüedad entre empate a 90 y empate tras prórroga.

### 5.8 Vista pública de predicciones de partidos

Página:

```txt
/predictions/matches/public
```

Funciones:

- Mostrar predicciones cuando el partido esté bloqueado.
- Comparar usuarios en una sola vista.
- Evitar que se vean predicciones antes del bloqueo.

### 5.9 Página de resultados

Página:

```txt
/results
```

Funciones:

- Ver resultados por jornada/ronda.
- Mostrar goles.
- Mostrar goleadores.
- Mostrar si hubo prórroga.
- Mostrar si hubo penaltis.
- Mostrar equipo clasificado en eliminatorias.

### 5.10 Página personal de puntuaciones

Página:

```txt
/my-scores
```

Funciones:

- Ver predicción del usuario.
- Ver resultado real.
- Ver puntos totales.
- Ver breakdown de puntuación.

Ejemplo:

```txt
Acertaste el ganador: +5
Te quedaste a un gol del resultado local: +2
Acertaste goles visitantes exactos: +3
Multiplicador de cuartos: x1.6
Total: 16
```

### 5.11 Leaderboard general

Página:

```txt
/leaderboard
```

Funciones:

- Ver clasificación total.
- Formato visual tipo liga/Champions.
- Primeras posiciones destacadas.
- Últimas posiciones con estilo diferenciado.
- Puntos totales.
- Posición.
- Diferencia con líder.

### 5.12 Leaderboards parciales

Página:

```txt
/leaderboard/breakdown
```

Desgloses:

- Por jornada.
- Por fase.
- Por resultados de partidos.
- Por predicciones iniciales.
- Por acierto de clasificados.
- Por acierto en eliminatorias.
- Por acierto de prórroga.
- Por acierto de penaltis.
- Por cercanía de goles.

### 5.13 Gráfico de evolución

Página:

```txt
/leaderboard/evolution
```

Visualización:

- Eje X: jornadas/rondas.
- Eje Y: puntos acumulados.
- Cada usuario aparece como una bola con iniciales.
- Ejemplo: David López → `DL`.
- El gráfico debe intentar evitar overlap de círculos.
- Permite comparar evolución de usuarios durante el torneo.

### 5.14 Estadísticas por selección

Página:

```txt
/stats/teams
```

Funciones:

- Seleccionar una selección.
- Ver jugadores.
- Ver minutos jugados.
- Ver goles.
- Ver asistencias.
- Ver tarjetas amarillas.
- Ver tarjetas rojas.

Esta parte puede ser progresiva, porque requiere introducir o importar datos adicionales.

### 5.15 Admin: gestión de fixtures

Página:

```txt
/admin/fixtures
```

Funciones:

- Importar JSON de calendario.
- Validar fixtures.
- Corregir equipos o fechas.
- Asignar equipos a eliminatorias cuando se conozcan.
- Ver estado de cada partido.

### 5.16 Admin: introducción de resultados

Página:

```txt
/admin/results
```

Funciones:

Para cualquier partido:

- Seleccionar jornada/ronda.
- Editar resultado.
- Seleccionar ganador.
- Añadir goles.
- Seleccionar goleadores de la lista de jugadores del equipo.

Para eliminatorias:

- Resultado a 90 minutos.
- Indicar si hubo prórroga.
- Resultado a 120 minutos si aplica.
- Indicar si hubo penaltis.
- Indicar equipo clasificado.
- No hace falta registrar el resultado de la tanda de penaltis.
- No hace falta registrar quién marcó cada penalti de la tanda.

### 5.17 Admin: gestión de jugadores

Página:

```txt
/admin/players
```

Funciones:

- Ver jugadores por selección.
- Añadir jugador.
- Desactivar jugador.
- Editar nombre visible.
- Añadir aliases.
- Evitar cambiar IDs existentes.

Principio importante:

- Si un jugador cambia o se cae de la convocatoria, no se reutiliza su ID.
- Si entra otro jugador, se crea uno nuevo.

### 5.18 Admin: reglas de puntuación

Página:

```txt
/admin/scoring
```

Funciones posibles:

- Ver reglas activas.
- Crear nueva versión de reglas.
- Activar una versión.
- Recalcular puntuaciones.

En una primera versión, las reglas pueden vivir hardcodeadas en JSON o SQL seed. Luego se puede hacer editable.

### 5.19 Admin: reset de datos

Página:

```txt
/admin/reset
```

Funciones:

- Resetear datos de testing por torneo.
- Confirmación escribiendo `BORRAR`.
- Mostrar claramente qué se va a borrar.

---

## 6. Sistema de puntuación

### 6.1 Principio general

El sistema de puntuación debe ser:

- Transparente.
- Explicable.
- Más justo que el Excel antiguo.
- Recalculable.
- Flexible.
- Desglosado por criterio.

Cada puntuación tendrá un breakdown visible para el usuario.

### 6.2 Criterios mencionados para partidos

Se han mencionado los siguientes criterios para puntuar predicciones de partidos:

#### Ganador del partido

Puntuar si el usuario acierta qué equipo gana.

En fase de grupos:

- Victoria local.
- Empate.
- Victoria visitante.

En eliminatorias:

- Equipo que pasa.
- Equipo ganador oficial.

#### Resultado exacto

Puntuar si el usuario acierta exactamente el resultado.

Ejemplo:

```txt
Predicción: 2-1
Resultado: 2-1
```

Debe puntuar más que simplemente acertar el ganador.

#### Cercanía al resultado

Puntuar de forma gradual según cercanía.

Ejemplo de motivación:

```txt
Resultado real: 5-0
Usuario A: 4-0
Usuario B: 1-0
```

Usuario A debe recibir más puntos que Usuario B porque estuvo mucho más cerca.

Criterios posibles:

- Distancia de goles del equipo local.
- Distancia de goles del equipo visitante.
- Error absoluto total.
- Diferencia de goles.
- Cercanía de diferencia de goles.

#### Goles por equipo

Puntuar si el usuario acierta goles exactos de un equipo.

Ejemplo:

```txt
Resultado real: 3-1
Predicción: 3-0
```

El usuario acertó goles del equipo local.

#### Diferencia de goles

Puntuar si acierta o se acerca a la diferencia de goles.

Ejemplo:

```txt
Resultado real: 3-1 → diferencia +2
Predicción: 2-0 → diferencia +2
```

Aunque no acierte el resultado exacto, sí acierta la diferencia.

#### Empate

Puntuar si acierta que el partido acaba empatado a 90 minutos.

Importante: en eliminatorias se diferenciará claramente:

- Empate a 90 minutos.
- Empate a 120 minutos.
- Ganador por penaltis.

#### Prórroga

En eliminatorias, puntuar si el usuario acierta que habrá prórroga.

También se podrá puntuar si acierta que no habrá prórroga.

#### Resultado a 120 minutos

Si el partido va a prórroga, puntuar si el usuario acierta el resultado tras 120 minutos.

Esto debe ser distinto del resultado a 90 minutos.

#### Penaltis

En eliminatorias, puntuar si el usuario acierta que habrá penaltis.

No se registrará el detalle de quién marca cada penalti de la tanda.

#### Equipo clasificado

En eliminatorias, puntuar si el usuario acierta qué equipo pasa a la siguiente ronda.

Esto es especialmente importante en partidos con empate, prórroga o penaltis.

#### Multiplicador por fase

No todos los partidos valen lo mismo.

Un acierto en una eliminatoria debe valer más que un acierto en fase de grupos.

Fases a considerar:

- Fase de grupos.
- Dieciseisavos, si aplica.
- Octavos.
- Cuartos.
- Semifinales.
- Final.

La puntuación base del partido puede multiplicarse por un factor según la fase.

Ejemplo conceptual:

```txt
Fase de grupos: x1.0
Octavos: x1.4
Cuartos: x1.6
Semifinales: x1.8
Final: x2.0
```

Los valores finales se definirán posteriormente.

### 6.3 Criterios mencionados para predicciones iniciales

#### Campeón del Mundial

Puntuar si el usuario acierta la selección ganadora del torneo.

Debe tener una puntuación alta porque es una predicción de largo plazo.

#### Subcampeón

Puntuar si el usuario acierta la selección finalista perdedora.

Se puede decidir más adelante si también se puntúa parcialmente por acertar un finalista aunque no sea en la posición exacta.

#### Pichichi

Puntuar si el usuario acierta el jugador máximo goleador del torneo.

Es una predicción inicial que queda fija al comienzo.

#### Mejor jugador del Mundial

Puntuar si el usuario acierta el jugador elegido mejor jugador del torneo.

Es una predicción inicial que queda fija al comienzo.

#### Clasificados de fase de grupos

Puntuar si el usuario acierta qué equipos pasan de cada grupo.

El formato puede permitir 2 o 3 clasificados según las reglas oficiales del torneo.

#### Posición en fase de grupos

Opcionalmente se podrá puntuar más si el usuario acierta no solo qué equipos pasan, sino también en qué posición.

Ejemplo:

```txt
Grupo A:
1. Equipo X
2. Equipo Y
```

Si acierta ambos equipos pero en orden incorrecto, recibe menos que si acierta equipos y posiciones.

### 6.4 Criterios de desglose de leaderboard

Se quieren leaderboards por:

- Clasificación general.
- Jornada.
- Fase.
- Resultados de partidos.
- Predicciones iniciales.
- Equipos que pasan de grupos.
- Equipos que pasan eliminatorias.
- Aciertos de prórroga.
- Aciertos de penaltis.
- Cercanía de goles.

### 6.5 Recalculo de puntuaciones

Las puntuaciones se recalcularán desde cero cuando:

- El admin confirme un nuevo resultado.
- Se corrija un resultado.
- Se corrija un goleador.
- Se cambie una regla de puntuación.
- Se active una nueva versión de scoring.

Dado que habrá pocos usuarios y pocos partidos, recalcular todo el torneo es aceptable.

Flujo recomendado:

```txt
1. Borrar prediction_scores del torneo.
2. Leer predicciones.
3. Leer resultados confirmados.
4. Leer reglas activas.
5. Calcular puntuaciones.
6. Insertar nuevos prediction_scores.
7. Actualizar snapshots de leaderboard si aplica.
```

---

## 7. Flujo de trabajo del administrador

### 7.1 Inicialización del torneo

Para Mundial 2022 test o Mundial 2026 real:

1. Crear torneo.
2. Importar equipos.
3. Importar jugadores.
4. Importar calendario desde JSON.
5. Revisar fixtures.
6. Activar torneo.
7. Invitar usuarios.
8. Verificar que todos aceptan reglas.
9. Abrir predicciones.

### 7.2 Introducción manual de resultados

Cuando termina un partido:

1. Admin entra en `/admin/results`.
2. Selecciona jornada/ronda.
3. Selecciona partido.
4. Introduce resultado a 90 minutos.
5. Si es eliminatoria, indica prórroga y penaltis si aplica.
6. Selecciona ganador/equipo clasificado.
7. Añade goles y goleadores.
8. Confirma resultado.
9. Sistema recalcula puntuaciones.
10. Usuarios ya pueden ver resultado, breakdown y leaderboard actualizado.

### 7.3 Gestión de errores

Si el admin introduce mal un resultado:

1. Edita el resultado.
2. Guarda cambios.
3. Sistema recalcula puntuaciones.

Si un jugador no existe:

1. Admin va a jugadores.
2. Añade jugador nuevo.
3. Vuelve al resultado.
4. Selecciona el jugador correcto.

---

## 8. Estrategia de testing con Mundial 2022

### 8.1 Objetivo

Usar Catar 2022 como entorno funcional de prueba.

Se probará:

- Importación de fixtures.
- Predicciones de usuario.
- Bloqueo por fecha.
- Resultados manuales.
- Prórroga.
- Penaltis.
- Goleadores.
- Recalculo de puntuaciones.
- Leaderboard.
- Reset de datos.

### 8.2 Flujo de prueba

1. Crear torneo `World Cup 2022 Test`.
2. Cargar equipos, jugadores y calendario.
3. Crear usuarios de prueba.
4. Introducir predicciones como jugador.
5. Simular admin introduciendo resultados por jornada.
6. Verificar puntuaciones.
7. Probar casos con prórroga y penaltis.
8. Probar correcciones de resultados.
9. Probar reset de datos.
10. Una vez validado, crear `World Cup 2026`.

### 8.3 Separación entre test y real

Se usará `tournament_id`.

Esto permite tener:

```txt
World Cup 2022 Test
World Cup 2026 Real
```

en la misma base de datos sin duplicar infraestructura.

---

## 9. Riesgos y decisiones pendientes

### 9.1 Riesgos principales

#### Diseño de scoring demasiado complejo

Riesgo:

- Que el sistema de puntos sea difícil de entender.

Mitigación:

- Mostrar breakdown simple.
- Documentar reglas.
- Hacer ejemplos.
- Mantener primera versión razonable.

#### Datos de jugadores incompletos

Riesgo:

- Que falten jugadores o haya cambios de convocatoria.

Mitigación:

- Admin puede añadir/desactivar jugadores.
- IDs no se reutilizan.
- Predicciones existentes no se rompen.

#### Fechas y zonas horarias

Riesgo:

- Bloqueo de predicciones incorrecto por timezone.

Mitigación:

- Guardar `kickoff_at` como `timestamptz`.
- Mostrar siempre hora local clara.
- Validar import JSON.

#### Reglas cambiantes

Riesgo:

- Cambiar reglas durante el torneo puede generar discusión.

Mitigación:

- Versionar reglas.
- Registrar aceptación.
- Recalcular de forma transparente.

#### Overengineering

Riesgo:

- Construir más de lo necesario.

Mitigación:

- Mantener stack simple.
- No backend separado.
- No Prisma inicialmente.
- No scraping automático.
- No estadísticas avanzadas hasta que lo básico funcione.

### 9.2 Decisiones pendientes

Quedan por definir más adelante:

- Valores exactos de puntuación.
- Multiplicadores exactos por fase.
- Si el subcampeón puntúa parcialmente por acertar finalista.
- Si clasificados de grupo puntúan por equipo solamente o también por posición.
- Si se permite editar predicciones iniciales hasta una fecha concreta.
- Si la página de estadísticas de jugadores se alimenta manualmente o desde otra fuente externa.
- Si `leaderboard_snapshots` se guarda o se calcula on the fly.
- Diseño visual final y paleta de colores.

---

## 10. Roadmap inicial recomendado

### Fase 0 — Setup de proyecto

- Crear app Next.js.
- Configurar TypeScript.
- Configurar Tailwind.
- Configurar Supabase.
- Configurar Vercel.
- Crear carpeta `/Context`.
- Crear primer documento de contexto.

### Fase 1 — Base de datos y Auth

- Crear migraciones iniciales.
- Configurar Supabase Auth.
- Crear `profiles`.
- Crear roles admin/player.
- Crear RLS básica.

### Fase 2 — Torneo, equipos, jugadores y fixtures

- Crear tablas de torneo.
- Crear importador de fixtures JSON.
- Crear admin fixtures.
- Cargar Mundial 2022 test.

### Fase 3 — Predicciones

- Predicciones iniciales.
- Predicciones de partidos de fase de grupos.
- Bloqueo 24h antes.
- Vista pública cuando estén bloqueadas.

### Fase 4 — Resultados manuales

- Admin results.
- Resultado 90 minutos.
- Prórroga.
- Penaltis.
- Goleadores.

### Fase 5 — Scoring

- Definir reglas iniciales.
- Implementar cálculo.
- Guardar breakdown.
- Recalcular torneo.

### Fase 6 — Leaderboards y visualizaciones

- Leaderboard general.
- Leaderboards parciales.
- Evolución por jornada.

### Fase 7 — Pulido

- UI final.
- Paleta de colores.
- Reset admin.
- Testing con Mundial 2022.
- Preparación Mundial 2026.

---

## 11. Conclusión

La solución propuesta es viable en free tier para una porra privada de pocos usuarios.

La arquitectura final queda:

```txt
Next.js + TypeScript + Tailwind
Supabase Auth + Supabase Postgres + Supabase CLI migrations
Vercel deployment desde GitHub
Resultados manuales por admin
Puntuaciones recalculables
Mundial 2022 como test
Mundial 2026 como torneo real
```

La decisión más importante es que Supabase será la fuente de verdad. Los JSONs solo se usarán para importación inicial de equipos, jugadores y calendario.

La aplicación priorizará claridad, trazabilidad y facilidad de iteración sobre complejidad técnica innecesaria.


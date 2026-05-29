# Bloqueo de predicciones (gestión por el administrador)

> **Cambio respecto al diseño original.** Hasta la migración
> `20260525120000_manual_round_predictions_lock` el bloqueo era
> automático: cada partido se cerraba 24 horas antes de su kickoff. Esa
> regla está **eliminada**. Ahora el bloqueo es **manual por jornada** y
> lo decide el administrador.

## Cómo funciona

Una "jornada" agrupa todos los partidos que comparten round_code:

- `group_md1`, `group_md2`, `group_md3` (fase de grupos)
- `r32` (dieciseisavos)
- `r16` (octavos)
- `qf` (cuartos)
- `sf` (semifinales)
- `third` (tercer puesto)
- `final` (final)

Cada jornada tiene dos estados:

- **Abierta** (`rounds.predictions_locked_at IS NULL`):
  - Cada participante puede editar sus predicciones de los partidos de
    esa jornada cuantas veces quiera.
  - Las predicciones **de los demás están ocultas** (RLS no las expone).
- **Bloqueada** (`rounds.predictions_locked_at IS NOT NULL`):
  - Nadie puede modificar predicciones de esa jornada (RLS rechaza
    `INSERT`/`UPDATE`/`DELETE`).
  - Las predicciones de **todos** los participantes son visibles para
    cualquier usuario autenticado.

El administrador bloquea cada jornada **antes** de que empiece su primer
partido. La decisión está deliberadamente en manos de un humano: el
sistema no compara contra ninguna fecha.

## Dónde se gestiona

`/admin/results` tiene una sección **"Bloqueo de predicciones por
jornada"** con una tarjeta por jornada. Cada tarjeta muestra el estado
actual (🟢 Abierta / 🔒 Bloqueada) y un botón **Bloquear** o
**Desbloquear**.

También puedes bloquear o desbloquear desde **`/predictions/matches`**: en
cada jornada, los administradores ven **Bloquear jornada** / **Desbloquear
jornada** junto al título de la ronda.

Desbloquear vuelve a abrir la jornada y oculta de nuevo las predicciones
de los demás. Útil si el admin se adelantó y quiere reabrir un par de
minutos.

## Implementación

- `rounds.predictions_locked_at TIMESTAMPTZ NULL` — instante del bloqueo
  o `NULL` si está abierta.
- `rounds.predictions_locked_by UUID NULL` — admin que lo bloqueó (FK a
  `profiles`, `ON DELETE SET NULL`).
- `public.is_fixture_locked(uuid)` ahora consulta la ronda del fixture y
  devuelve `r.predictions_locked_at IS NOT NULL`. Las políticas RLS de
  `match_predictions` ya llamaban a esa función, así que el cambio
  propaga sin tocar policies:
  - `match_predictions_insert_own_unlocked` / `update_own_unlocked` /
    `delete_own_unlocked` → bloquean escritura cuando la jornada está
    cerrada.
  - `match_predictions_select_own_or_locked` → expone filas ajenas solo
    cuando la jornada está cerrada.
- Server actions: `lockRoundPredictions(roundCode)` /
  `unlockRoundPredictions(roundCode)` en
  `src/app/admin/results/actions.ts`, y `lockRoundFromPredictions` /
  `unlockRoundFromPredictions` en
  `src/app/(app)/predictions/matches/actions.ts`.

## Impacto para el usuario

- En `/predictions/matches`:
  - Las jornadas abiertas se ven como editables (formulario con badge
    "Guardado" o "Sin guardar").
  - Las jornadas bloqueadas se ven con el panel `LockedFixturePanel`:
    resultado oficial (si lo hay), tu predicción y el chevron "Ver
    ranking de este partido" con todas las predicciones de los demás.
- En `/predictions/matches/public`:
  - Las jornadas abiertas muestran "🔒 Esta jornada todavía no se ha
    bloqueado".
  - Las bloqueadas muestran la tarjeta por usuario con su predicción.
- En `/clasificacion/partido/[fixtureId]`: la comparativa siempre se
  enseña — RLS solo permite ver predicciones de otros si la ronda está
  bloqueada, así que sin lock se ve vacío.

## Migración de torneos antiguos (Catar 2022)

No hay nada que migrar: las columnas nuevas son nullable y por defecto
`NULL` (= jornadas abiertas). Si quieres recrear el comportamiento del
hito 09/10 en local (jornadas pasadas como ya bloqueadas), basta con
`UPDATE rounds SET predictions_locked_at = now() WHERE code IN (...);`.

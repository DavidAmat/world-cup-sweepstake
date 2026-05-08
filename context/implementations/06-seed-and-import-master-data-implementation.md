# 06 — Seeds e importación de master data · bitácora de implementación

> Hito ejecutado: ver plan en `context/plan/06-seed-and-import-master-data.md`.

## Resumen ejecutivo (en progreso)

Hito 06 en marcha. Estado actual:

- [x] Plan aprobado (versión final tras decisiones D1, D4, D5).
- [ ] `strip_results_2022.py` y JSON neutro generado.
- [ ] Seeds canónicos `tournament.json` + `teams.json`.
- [ ] `tsx` instalado.
- [ ] Seeder TypeScript implementado.
- [ ] Validación local.
- [ ] Aplicación a producción.

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

(Se irán anotando aquí conforme avance.)

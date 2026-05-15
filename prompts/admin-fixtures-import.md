# Prompt — Importar fixtures de eliminatorias al admin

> Pega este prompt entero en ChatGPT, debajo añade el texto natural con
> los partidos a importar (copiado de FIFA, ESPN, Marca, etc.), y
> ChatGPT debería devolverte un array JSON listo para pegar en
> `/admin/fixtures/import`.

---

Eres un traductor estricto de listas de partidos a un array JSON.
Devuélveme **únicamente** el JSON, sin texto adicional, sin markdown,
sin comentarios.

## Schema exacto (un elemento por partido)

```json
{
  "external_id": "wc2022_r16_001",
  "fase": "octavos",
  "tipo_partido": "eliminatoria",
  "jornada": null,
  "grupo": null,
  "equipo_1": "Países Bajos",
  "equipo_2": "Estados Unidos",
  "fecha": "2026-06-29T16:00:00",
  "venue": null
}
```

## Reglas

- El output es un **array** (raíz `[ ... ]`) con 1..N objetos. Aunque
  haya un solo partido, sigue siendo un array.
- `external_id`: snake*case ASCII. Patrón:
  `wc2022*<round>\_NNN`con`<round>` ∈ {`r16`, `qf`, `sf`, `third`,
`final`} y `NNN`empezando en`001`para cada ronda. Ejemplos:`wc2022_r16_001`, `wc2022_qf_003`, `wc2022_final_001`.
- `fase`: uno de `fase_grupos`, `octavos`, `cuartos`, `semis`,
  `tercer_puesto`, `final`. (Para eliminatorias normalmente no
  `fase_grupos`.)
- `tipo_partido`: `"eliminatoria"` para octavos en adelante;
  `"grupo"` solo para fase de grupos.
- `jornada`: `null` en eliminatorias. En fase de grupos `1`, `2` o `3`.
- `grupo`: `null` en eliminatorias. En fase de grupos `"A"`…`"H"`.
- `equipo_1` / `equipo_2`:
  - Usa exactamente uno de los nombres canónicos de la lista oficial
    (más abajo). Respeta tildes y eñes (`España`, `Túnez`, `Catar`,
    `Argentina`).
  - Si no estás 100% seguro del nombre del equipo, usa un placeholder
    en español: `"Ganador A"`, `"2.º Grupo C"`, `"Perdedor Octavos 1"`,
    `"Ganador Cuartos 2"`, etc. **No inventes un nombre de equipo**.
- `fecha`: ISO **sin zona horaria** en hora local Madrid:
  `"YYYY-MM-DDTHH:MM:SS"`. Si la fuente da la hora en otra zona,
  conviértela tú a Madrid (CET en invierno, CEST en verano).
- `venue`: el nombre del estadio si lo conoces (ej. `"Lusail"`,
  `"Santiago Bernabéu"`); si no, `null`.

## Lo que NO debes hacer

- No añadas campos extra al objeto (`marcador_*`, `prorroga`,
  `penaltis`, `ganador`, ...). La app los ignora; mejor no enviarlos.
- No envuelvas el array en otro objeto (`{"fixtures": [...]}` está
  mal; tiene que ser directamente `[...]`).
- No incluyas comillas tipográficas (`“ ” ‘ ’`); solo ASCII `" "`.
- No envuelvas el JSON en bloques de markdown (` ```json `). Solo el
  array crudo.
- No expliques nada antes ni después. Solo el JSON.

## Lista oficial de equipos para `wc_2022_test`

Mundial de Catar 2022. Si la app se reusa para 2026, esta lista hay
que reemplazarla en este mismo archivo.

| Grupo | Equipos                                  |
| ----- | ---------------------------------------- |
| A     | Catar, Ecuador, Senegal, Países Bajos    |
| B     | Inglaterra, Irán, Estados Unidos, Gales  |
| C     | Argentina, Arabia Saudí, México, Polonia |
| D     | Francia, Australia, Dinamarca, Túnez     |
| E     | España, Costa Rica, Alemania, Japón      |
| F     | Bélgica, Canadá, Marruecos, Croacia      |
| G     | Brasil, Serbia, Suiza, Camerún           |
| H     | Portugal, Ghana, Uruguay, Corea del Sur  |

(Si la fuente usa el nombre `"Qatar"`, traduce a `"Catar"`; si usa
`"South Korea"`, traduce a `"Corea del Sur"`; etc.)

## Ejemplo completo

### Input

> Octavos de final (Mundial 2022 inventado a junio 2026):
> · 29 jun · 16:00 (Madrid) · Países Bajos vs Estados Unidos
> · 29 jun · 20:00 (Madrid) · Argentina vs Australia
> · 30 jun · 16:00 (Madrid) · Francia vs Polonia
> · 30 jun · 20:00 (Madrid) · Inglaterra vs Senegal

### Output esperado

```json
[
  {
    "external_id": "wc2022_r16_001",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Países Bajos",
    "equipo_2": "Estados Unidos",
    "fecha": "2026-06-29T16:00:00",
    "venue": null
  },
  {
    "external_id": "wc2022_r16_002",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Argentina",
    "equipo_2": "Australia",
    "fecha": "2026-06-29T20:00:00",
    "venue": null
  },
  {
    "external_id": "wc2022_r16_003",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Francia",
    "equipo_2": "Polonia",
    "fecha": "2026-06-30T16:00:00",
    "venue": null
  },
  {
    "external_id": "wc2022_r16_004",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Inglaterra",
    "equipo_2": "Senegal",
    "fecha": "2026-06-30T20:00:00",
    "venue": null
  }
]
```

## Notas finales

- Si el admin todavía no conoce a uno de los equipos (porque la fase
  anterior no ha terminado), usa un placeholder como `"Ganador A"` en
  vez de inventar. La app distingue equipos de placeholders en la UI.
- La fecha tiene que tener segundos (`:00`) al final, aunque la fuente
  solo dé hora:minuto.
- `external_id` debe ser único por torneo. Si la ronda ya tenía
  partidos cargados (porque el admin importó algunos primero), sigue
  numerando desde donde corresponda.

---

# Plantilla para futuros torneos

Cuando se cargue Mundial 2026:

1. Reemplaza el slug en `external_id`: `wc2022_*` → `wc2026_*`.
2. Sustituye la tabla de equipos por los 48 del Mundial 2026.
3. Mantén el resto del schema y los ejemplos.

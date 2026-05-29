# Admin fixtures — JSON import (ChatGPT prompt)

How to bulk-import knockout fixtures into `/admin/fixtures/import`. Paste the **Prompt block** below into ChatGPT (or similar), append your natural-language match list, and paste the returned JSON into the admin import page.

> Admin UI reference: [`documentation/services/web/fixtures-admin.md`](../services/web/fixtures-admin.md)

## Workflow

1. Open `/admin/fixtures/import` (admin only).
2. Copy the match schedule from an official source (FIFA, ESPN, etc.) — dates, times, teams.
3. Paste the **Prompt block** into ChatGPT, then paste your match list underneath.
4. Copy the **raw JSON array** ChatGPT returns (no markdown fences).
5. Paste into the textarea → **Validar y previsualizar**.
6. Fix any red rows (typos, bad `external_id`, unknown team names).
7. **Confirmar e insertar** when preview is all green/amber.

Re-importing the same `external_id` values **updates** existing rows (idempotent upsert).

Group-stage fixtures are normally loaded by `scripts/wc2026/upload.ts`, not this flow. Use JSON import mainly for **knockouts** (`dieciseisavos` through `final`) as the bracket becomes known.

---

## Prompt block (copy from here)

```
Eres un traductor estricto de listas de partidos a un array JSON.
Devuélveme únicamente el JSON, sin texto adicional, sin markdown,
sin comentarios.

## Schema exacto (un elemento por partido)

{
  "external_id": "wc2026_r16_001",
  "fase": "octavos",
  "tipo_partido": "eliminatoria",
  "jornada": null,
  "grupo": null,
  "equipo_1": "Países Bajos",
  "equipo_2": "Estados Unidos",
  "fecha": "2026-06-29T16:00:00",
  "venue": null
}

## Reglas

- El output es un array (raíz [ ... ]) con 1..N objetos. Aunque haya un solo partido, sigue siendo un array.
- external_id: snake_case ASCII. Patrón wc2026_<round>_NNN con <round> ∈ { r32, r16, qf, sf, third, final } y NNN empezando en 001 por ronda. Ejemplos: wc2026_r32_001, wc2026_r16_001, wc2026_final_001.
- fase: uno de fase_grupos, dieciseisavos, octavos, cuartos, semis, tercer_puesto, final. Para eliminatorias normalmente no fase_grupos.
- tipo_partido: "eliminatoria" para octavos en adelante (y dieciseisavos); "grupo" solo para fase de grupos.
- jornada: null en eliminatorias. En fase de grupos 1, 2 o 3.
- grupo: null en eliminatorias. En fase de grupos "A"…"L".
- equipo_1 / equipo_2:
  - Usa exactamente uno de los nombres canónicos de la lista oficial (más abajo). Respeta tildes y eñes.
  - Si no estás 100% seguro del nombre del equipo, usa un placeholder en español: "Ganador A", "2.º Grupo C", "Perdedor Octavos 1", "Ganador Cuartos 2", "TBD", etc. No inventes un nombre de equipo.
- fecha: ISO sin zona horaria en hora local Madrid: "YYYY-MM-DDTHH:MM:SS". Si la fuente da la hora en otra zona, conviértela tú a Madrid (CET en invierno, CEST en verano).
- venue: nombre del estadio si lo conoces; si no, null.

## Lo que NO debes hacer

- No añadas campos extra (marcador_*, prorroga, penaltis, ganador, …). La app los ignora.
- No envuelvas el array en otro objeto ({"fixtures": [...]} está mal).
- No uses comillas tipográficas; solo ASCII " ".
- No envuelvas el JSON en bloques de markdown. Solo el array crudo.
- No expliques nada antes ni después. Solo el JSON.

## Lista oficial de equipos para wc_2026

Mundial Norteamérica 2026 (48 selecciones). Usa display_name del seed data/seeds/wc_2026/teams.json.

| Grupo | Equipos |
| ----- | ------- |
| A | México, Sudáfrica, Corea del Sur, Chequia |
| B | Canadá, Bosnia y Herzegovina, Catar, Suiza |
| C | Brasil, Marruecos, Haití, Escocia |
| D | Estados Unidos, Paraguay, Australia, Turquía |
| E | Alemania, Curazao, Costa de Marfil, Ecuador |
| F | Países Bajos, Japón, Suecia, Túnez |
| G | Bélgica, Egipto, Irán, Nueva Zelanda |
| H | España, Cabo Verde, Arabia Saudí, Uruguay |
| I | Francia, Senegal, Irak, Noruega |
| J | Argentina, Argelia, Austria, Jordania |
| K | Portugal, RD Congo, Uzbekistán, Colombia |
| L | Inglaterra, Croacia, Ghana, Panamá |

(Si la fuente usa "Qatar", traduce a "Catar"; "South Korea" → "Corea del Sur"; etc.)

## Ejemplo completo

### Input

Octavos de final (ejemplo inventado junio 2026):
· 29 jun · 16:00 (Madrid) · Países Bajos vs Estados Unidos
· 29 jun · 20:00 (Madrid) · Argentina vs Australia
· 30 jun · 16:00 (Madrid) · Francia vs Senegal
· 30 jun · 20:00 (Madrid) · Inglaterra vs Ghana

### Output esperado

[
  {
    "external_id": "wc2026_r16_001",
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
    "external_id": "wc2026_r16_002",
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
    "external_id": "wc2026_r16_003",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Francia",
    "equipo_2": "Senegal",
    "fecha": "2026-06-30T16:00:00",
    "venue": null
  },
  {
    "external_id": "wc2026_r16_004",
    "fase": "octavos",
    "tipo_partido": "eliminatoria",
    "jornada": null,
    "grupo": null,
    "equipo_1": "Inglaterra",
    "equipo_2": "Ghana",
    "fecha": "2026-06-30T20:00:00",
    "venue": null
  }
]

## Notas finales

- Si el admin todavía no conoce a uno de los equipos, usa un placeholder en vez de inventar.
- La fecha tiene que tener segundos (:00) al final, aunque la fuente solo dé hora:minuto.
- external_id debe ser único por torneo. Si la ronda ya tenía partidos cargados, sigue numerando desde donde corresponda.
```

---

## Fase → round quick reference

| `fase` | Round code in `external_id` | Spanish round name |
|--------|----------------------------|--------------------|
| `dieciseisavos` | `r32` | Dieciseisavos |
| `octavos` | `r16` | Octavos |
| `cuartos` | `qf` | Cuartos |
| `semis` | `sf` | Semifinales |
| `tercer_puesto` | `third` | Tercer puesto |
| `final` | `final` | Final |

## Placeholder examples accepted by the importer

- `Ganador A`, `Perdedor Octavos 1`
- `2.º Grupo C`, `1er de A`
- `TBD`, `?`

## Sample payload (historical)

A wc_2022 test sample (8 octavos) is archived at `documentation/archive/octavos-fixture-sample-wc2022.json`. Do **not** use `wc2022_*` external_ids for the current tournament — use `wc2026_*` only.

## Troubleshooting

| Preview error | Fix |
|---------------|-----|
| Equipo no reconocido | Match `display_name` from `teams.json`, or use a placeholder |
| Schema inválido | Root must be `[...]`; check `fase`, date format, `grupo` A–L |
| Local y visitante iguales | Two different sides required |
| JSON inválido | Remove markdown fences; fix trailing commas |

After import, verify in `/admin/fixtures` with round filter (e.g. `r16` for octavos).

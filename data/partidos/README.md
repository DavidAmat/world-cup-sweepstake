# Partidos y Resultados

Se ha usado ChatGPT para extraer de Google los partidos del mundial 2022 y los resultados con un copy paste y haciendo un force del formato

```json

// # fases
"dieciseisavos" (si aplica, en el 2022 no había), "octavos", "cuartos", "semis", "tercer_puesto", "final"

// # empate en fase grupos
{
"external_id": "wc2022_group_a_md1_001",
"fase": "fase_grupos",
"grupo": "A",
"tipo_partido": "grupo",
"jornada": 1,
"equipo_1": "Croacia",
"equipo_2": "Marruecos",
"fecha": "2022-12-17 02:00:00",
"marcador_equipo_1_90_mins": 3,
"marcador_equipo_2_90_mins": 3,
"ganador": "empate"
},

// # victoria en fase grupos
{
"external_id": "wc2022_group_a_md1_001",
"fase": "fase_grupos",
"grupo": "A",
"tipo_partido": "grupo",
"jornada": 1,
"equipo_1": "Croacia",
"equipo_2": "Marruecos",
"fecha": "2022-12-17 02:00:00",
"marcador_equipo_1_90_mins": 3,
"marcador_equipo_2_90_mins": 4,
"ganador": "Marruecos"
},

// ----------------
// FASES FINALES
// ----------------

// Aquí ya añadimos las propiedades de prorroga y penaltis
// El ganador siempre es un equipo, no puede haber empates

// # fase final victoria en 90 min
{
"external_id": "wc2022_group_e_md3_044",
"fase": "fase_grupos",
"tipo_partido": "grupo",
"jornada": 3,
"grupo": "E",
"equipo_1": "Costa Rica",
"equipo_2": "Alemania",
"fecha": "2022-12-01 02:00:00",
"marcador_equipo_1_90_mins": 2,
"marcador_equipo_2_90_mins": 4,
"prorroga": false,
"penaltis": false,
"ganador": "Alemania"
},

// # fase final victoria en 120 min (prorroga)
{
"external_id": "wc2022_octavos_007",
"fase": "octavos",
"tipo_partido": "eliminatoria",
"jornada": null,
"grupo": null,
"equipo_1": "Marruecos",
"equipo_2": "España",
"fecha": "2022-12-06 02:00:00",
"marcador_equipo_1_90_mins": 0,
"marcador_equipo_2_90_mins": 0,
"prorroga": true,
"penaltis": false,
"ganador": "España"
},

// # fase final victoria en penaltis
{
"external_id": "wc2022_final_001",
"fase": "final",
"tipo_partido": "eliminatoria",
"jornada": null,
"grupo": null,
"equipo_1": "Argentina",
"equipo_2": "Francia",
"fecha": "2022-12-18 02:00:00",
"marcador_equipo_1_90_mins": 3,
"marcador_equipo_2_90_mins": 3,
"prorroga": true,
"penaltis": true,
"ganador": "Argentina"
}

```

# Como ejecutar
- Leer el setup the python en context en `01-python-setup.md`
- Ejecutar notebook: `data/raw/create_results_2022_json.ipynb`
- Generado ya el json final en `data/partidos/2022/partidos_resultados_2022.json`
#!/usr/bin/env python3
"""
Convert FIFA World Cup match CSV into a simplified JSON format for the sweepstake app.

Expected input:
- CSV from Kaggle / WorldCupMatches-style dataset.
- Typical columns:
  Year, Stage, Home Team Name, Home Team Goals, Away Team Goals,
  Away Team Name, Win conditions

Usage:
  python convert_world_cup_csv_to_json.py \
    --input WorldCupMatches.csv \
    --year 2022 \
    --output world_cup_2022_results_es.json

Notes:
- The CSV score is treated as the score to store in marcador_*_90_mins.
  This is intentional for the current app simplification, even if the original
  match went to extra time and the CSV score is actually after 120 minutes.
- Extra time and penalties are inferred from the "Win conditions" column.
- Penalty shootout scores are not stored.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


TEAM_NAME_ES = {
    # 2022 teams
    "Argentina": "Argentina",
    "Australia": "Australia",
    "Belgium": "Bélgica",
    "Brazil": "Brasil",
    "Cameroon": "Camerún",
    "Canada": "Canadá",
    "Costa Rica": "Costa Rica",
    "Croatia": "Croacia",
    "Denmark": "Dinamarca",
    "Ecuador": "Ecuador",
    "England": "Inglaterra",
    "France": "Francia",
    "Germany": "Alemania",
    "Ghana": "Ghana",
    "Iran": "Irán",
    "IR Iran": "Irán",
    "Japan": "Japón",
    "Korea Republic": "Corea del Sur",
    "South Korea": "Corea del Sur",
    "Mexico": "México",
    "Morocco": "Marruecos",
    "Netherlands": "Países Bajos",
    "Poland": "Polonia",
    "Portugal": "Portugal",
    "Qatar": "Qatar",
    "Saudi Arabia": "Arabia Saudí",
    "Senegal": "Senegal",
    "Serbia": "Serbia",
    "Spain": "España",
    "Switzerland": "Suiza",
    "Tunisia": "Túnez",
    "United States": "Estados Unidos",
    "USA": "Estados Unidos",
    "Uruguay": "Uruguay",
    "Wales": "Gales",

    # Common historical names / aliases
    "Côte d'Ivoire": "Costa de Marfil",
    "Ivory Coast": "Costa de Marfil",
    "Czech Republic": "Chequia",
    "Czechoslovakia": "Checoslovaquia",
    "Soviet Union": "Unión Soviética",
    "Yugoslavia": "Yugoslavia",
    "West Germany": "Alemania Occidental",
    "German DR": "Alemania Oriental",
    "Republic of Ireland": "Irlanda",
    "Northern Ireland": "Irlanda del Norte",
    "Scotland": "Escocia",
    "Paraguay": "Paraguay",
    "Chile": "Chile",
    "Colombia": "Colombia",
    "Peru": "Perú",
    "Bolivia": "Bolivia",
    "Austria": "Austria",
    "Sweden": "Suecia",
    "Norway": "Noruega",
    "Egypt": "Egipto",
    "Algeria": "Argelia",
    "Nigeria": "Nigeria",
    "South Africa": "Sudáfrica",
    "Greece": "Grecia",
    "Turkey": "Turquía",
    "Russia": "Rusia",
    "Ukraine": "Ucrania",
    "Slovakia": "Eslovaquia",
    "Slovenia": "Eslovenia",
    "Romania": "Rumanía",
    "Bulgaria": "Bulgaria",
    "Hungary": "Hungría",
    "Italy": "Italia",
    "Cuba": "Cuba",
    "Haiti": "Haití",
    "Honduras": "Honduras",
    "Jamaica": "Jamaica",
    "Panama": "Panamá",
    "New Zealand": "Nueva Zelanda",
    "China PR": "China",
    "Korea DPR": "Corea del Norte",
    "United Arab Emirates": "Emiratos Árabes Unidos",
    "Iraq": "Iraq",
    "Kuwait": "Kuwait",
    "Israel": "Israel",
    "El Salvador": "El Salvador",
    "Trinidad and Tobago": "Trinidad y Tobago",
    "Bosnia and Herzegovina": "Bosnia y Herzegovina",
}


def normalize_col_name(col: str) -> str:
    """Normalize a column name to make matching tolerant to spaces/case."""
    return re.sub(r"[^a-z0-9]+", "_", str(col).strip().lower()).strip("_")


def build_column_map(df: pd.DataFrame) -> dict[str, str]:
    """Map normalized column names back to actual CSV column names."""
    return {normalize_col_name(c): c for c in df.columns}


def first_existing(colmap: dict[str, str], candidates: list[str]) -> str:
    """Return the actual column name for the first candidate that exists."""
    for candidate in candidates:
        normalized = normalize_col_name(candidate)
        if normalized in colmap:
            return colmap[normalized]
    raise KeyError(
        "Missing required column. Tried candidates: "
        + ", ".join(candidates)
        + f". Available columns: {list(colmap.values())}"
    )


def translate_team(name: Any) -> str:
    """Translate known team names to Spanish; leave unknown names unchanged."""
    if pd.isna(name):
        return ""
    clean = str(name).strip()
    # Some Kaggle versions contain bad HTML remnants such as 'rn">Germany'.
    clean = re.sub(r'^rn">', "", clean)
    return TEAM_NAME_ES.get(clean, clean)


def normalize_stage(stage: Any) -> tuple[str, str | None]:
    """
    Convert source stage to app stage.

    Returns:
      (fase, grupo)

    fase values:
      fase_grupos, dieciseisavos, octavos, cuartos, semis, tercer_puesto, final
    """
    raw = "" if pd.isna(stage) else str(stage).strip()
    s = raw.lower()

    # Important: check semi/third before generic "final".
    if "group" in s or re.search(r"\bgrupo?\b", s):
        group_match = re.search(r"group\s+([a-z0-9]+)", raw, flags=re.IGNORECASE)
        grupo = group_match.group(1).upper() if group_match else None
        return "fase_grupos", grupo

    if "round of 32" in s or "dieciseis" in s:
        return "dieciseisavos", None

    if "round of 16" in s or "octav" in s or "eighth" in s:
        return "octavos", None

    if "quarter" in s or "cuart" in s:
        return "cuartos", None

    if "semi" in s or "semif" in s:
        return "semis", None

    if "third" in s or "3rd" in s or "tercer" in s:
        return "tercer_puesto", None

    if "final" in s:
        return "final", None

    # Fallback: older datasets sometimes use "First round" for group-like stages.
    if "first round" in s:
        return "fase_grupos", None

    return raw, None


def detect_extra_time_and_penalties(win_conditions: Any) -> tuple[bool, bool]:
    """
    Infer prorroga/penaltis from Win conditions.

    Penalties imply extra time.
    """
    if pd.isna(win_conditions):
        return False, False

    wc = str(win_conditions).strip().lower()
    if not wc:
        return False, False

    penalties = bool(re.search(r"penalt|shoot", wc))
    extra_time = penalties or bool(re.search(r"extra time|aet|after extra", wc))
    return extra_time, penalties


def infer_winner(
    fase: str,
    home_team: str,
    away_team: str,
    home_goals: int,
    away_goals: int,
    win_conditions: Any,
) -> str:
    """
    Infer winner in Spanish.

    Group draws return "empate".
    Knockout draws should use Win conditions to infer the winner.
    """
    if home_goals > away_goals:
        return home_team
    if away_goals > home_goals:
        return away_team

    # Draw score.
    wc = "" if pd.isna(win_conditions) else str(win_conditions).strip().lower()

    # Try explicit team name in win conditions.
    home_raw = home_team.lower()
    away_raw = away_team.lower()
    if home_raw and home_raw in wc:
        return home_team
    if away_raw and away_raw in wc:
        return away_team

    # Handle possible compact codes if present in a dataset.
    # HWP = home won on penalties, AWP = away won on penalties.
    if re.search(r"\bhwp\b", wc):
        return home_team
    if re.search(r"\bawp\b", wc):
        return away_team

    if fase == "fase_grupos":
        return "empate"

    # Safe fallback for old/dirty rows.
    return "empate"


def convert_world_cup_csv(input_csv: str | Path, year: int | None = None) -> list[dict[str, Any]]:
    df = pd.read_csv(input_csv)
    colmap = build_column_map(df)

    year_col = first_existing(colmap, ["Year"])
    stage_col = first_existing(colmap, ["Stage"])
    home_team_col = first_existing(colmap, ["Home Team Name", "Home Team", "Team 1", "team_1"])
    away_team_col = first_existing(colmap, ["Away Team Name", "Away Team", "Team 2", "team_2"])
    home_goals_col = first_existing(colmap, ["Home Team Goals", "Home Goals", "Team 1 Goals", "team_1_score"])
    away_goals_col = first_existing(colmap, ["Away Team Goals", "Away Goals", "Team 2 Goals", "team_2_score"])

    win_conditions_col = None
    for candidate in ["Win conditions", "Win Conditions", "winner_condition", "notes"]:
        normalized = normalize_col_name(candidate)
        if normalized in colmap:
            win_conditions_col = colmap[normalized]
            break

    if year is not None:
        df = df[df[year_col].astype("Int64") == year].copy()

    records: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        fase, grupo = normalize_stage(row[stage_col])

        home_team = translate_team(row[home_team_col])
        away_team = translate_team(row[away_team_col])

        home_goals = int(row[home_goals_col])
        away_goals = int(row[away_goals_col])

        win_conditions = row[win_conditions_col] if win_conditions_col else ""
        prorroga, penaltis = detect_extra_time_and_penalties(win_conditions)

        item: dict[str, Any] = {
            "fase": fase,
        }

        if fase == "fase_grupos":
            item["grupo"] = grupo

        item.update(
            {
                "equipo_1": home_team,
                "equipo_2": away_team,
                "marcador_equipo_1_90_mins": home_goals,
                "marcador_equipo_2_90_mins": away_goals,
            }
        )

        if prorroga:
            item["prorroga"] = True
            item["penaltis"] = bool(penaltis)

        item["ganador"] = infer_winner(
            fase=fase,
            home_team=home_team,
            away_team=away_team,
            home_goals=home_goals,
            away_goals=away_goals,
            win_conditions=win_conditions,
        )

        records.append(item)

    return records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input CSV")
    parser.add_argument("--output", required=True, help="Path to output JSON")
    parser.add_argument("--year", type=int, default=None, help="Optional World Cup year filter, e.g. 2022")
    args = parser.parse_args()

    records = convert_world_cup_csv(args.input, year=args.year)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(records)} matches to {output_path}")


if __name__ == "__main__":
    main()
import argparse
import json
import re
from pathlib import Path
from typing import Any

import pandas as pd
from team_names import TEAM_NAME_ES


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


def normalize_stage(stage: Any) -> str:
    """
    Convert source stage to app stage.

    Output values:
      fase_grupos, dieciseisavos, octavos, cuartos, semis, tercer_puesto, final
    """
    raw = "" if pd.isna(stage) else str(stage).strip()
    s = raw.lower()

    if "group" in s:
        return "fase_grupos"

    if "round of 32" in s:
        return "dieciseisavos"

    if "round of 16" in s:
        return "octavos"

    if "quarter" in s:
        return "cuartos"

    if "semi" in s:
        return "semis"

    if "third" in s:
        return "tercer_puesto"

    if s == "final" or "final" in s:
        return "final"

    raise ValueError(f"Unknown stage: {raw}")


def normalize_group(group_name: Any) -> str | None:
    """
    Convert Group Name from the CSV into a clean group value.

    Examples:
      'Group A' -> 'A'
      'group b' -> 'B'
      'not applicable' -> None
    """
    if pd.isna(group_name):
        return None

    raw = str(group_name).strip()

    if not raw or raw.lower() in {"not applicable", "n/a", "na", "none"}:
        return None

    match = re.search(r"group\s+([a-z])", raw, flags=re.IGNORECASE)
    if match:
        return match.group(1).upper()

    return raw


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


def csv_bool(value: Any) -> bool:
    """
    Convert CSV boolean-like values to Python bool.

    Handles:
      1, 0, '1', '0', True, False, 'true', 'false'
    """
    if pd.isna(value):
        return False

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return int(value) == 1

    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def infer_winner(
    fase: str,
    home_team: str,
    away_team: str,
    home_goals: int,
    away_goals: int,
    result: Any,
    home_team_win: Any,
    away_team_win: Any,
    draw: Any,
) -> str:
    """
    Infer winner.

    Rules:
    - Group stage can end in empate.
    - Knockout stages must always have a winner.
    - Prefer Home Team Win / Away Team Win / Draw columns.
    """

    if csv_bool(home_team_win):
        return home_team

    if csv_bool(away_team_win):
        return away_team

    if csv_bool(draw):
        if fase == "fase_grupos":
            return "empate"

        raise ValueError(
            f"Knockout match cannot have ganador='empate': "
            f"{home_team} vs {away_team}"
        )

    result_clean = "" if pd.isna(result) else str(result).strip().lower()

    if "home team win" in result_clean:
        return home_team

    if "away team win" in result_clean:
        return away_team

    if "draw" in result_clean:
        if fase == "fase_grupos":
            return "empate"

        raise ValueError(
            f"Knockout match cannot have ganador='empate': "
            f"{home_team} vs {away_team}"
        )

    if home_goals > away_goals:
        return home_team

    if away_goals > home_goals:
        return away_team

    if fase == "fase_grupos":
        return "empate"

    raise ValueError(
        f"Cannot infer knockout winner from tied score: " f"{home_team} vs {away_team}"
    )


def load_partidos_index(*paths: Path) -> dict[tuple[str, str, str], dict]:
    """
    Builds an index:
      (fase, equipo_1, equipo_2) -> partido metadata
    """
    index = {}

    for path in paths:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        for _, partidos in data.items():
            for partido in partidos:
                key = (
                    partido["fase"],
                    partido["equipo_1"],
                    partido["equipo_2"],
                )

                if key in index:
                    raise ValueError(f"Duplicated match key: {key}")

                index[key] = partido

    return index

"""
Strip official results from the 2022 World Cup matches JSON, rebase
the kickoff dates into June-July 2026 (Madrid local time) so we can
exercise the 24h prediction lock with a realistic future calendar,
and KEEP ONLY the group-stage matches.

Why drop knockouts here: in a real tournament the knockout brackets
are unknown until group stage ends. The seed mirrors that — only
group-stage matches go in at bootstrap. The admin will append the 16
knockout matches to the neutral JSON as the brackets resolve, and
re-run `npm run wc2022:upload` to insert them. The upload script
itself does NOT filter by fase, so any new entry will be picked up.

Reads `data/partidos/2022/partidos_resultados_2022.json` (the 64
matches with real scores) and produces
`data/partidos/2022/partidos_2022_sin_resultados.json` with:

  · 48 group-stage matches only
  · same shape (no key removed)
  · result fields nulled (marcador_*, prorroga, penaltis, ganador)
  · `fecha` rebased: original day → 2026-06-11 + delta_days, fixed at
    18:00:00 Madrid local time

Why rebase: the original JSON has every match at "YYYY-MM-DD 02:00:00"
which is a placeholder, not the real kickoff. For the test tournament
(wc_2022_test) we want plausible future dates so the 24h lock can be
exercised. The user will tweak specific match dates manually when
testing the lock.

Idempotent: re-running produces a byte-identical output for the same
input.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
INPUT_PATH = REPO_ROOT / "data" / "partidos" / "2022" / "partidos_resultados_2022.json"
OUTPUT_PATH = REPO_ROOT / "data" / "partidos" / "2022" / "partidos_2022_sin_resultados.json"

NULLABLE_RESULT_KEYS = (
    "marcador_equipo_1_90_mins",
    "marcador_equipo_2_90_mins",
    "prorroga",
    "penaltis",
    "ganador",
)

# Anchor: 2022 inaugural Qatar–Ecuador → 2026 inaugural target.
# All other matches keep their day-offset relative to the inaugural.
ORIGINAL_ANCHOR_DATE = datetime(2022, 11, 20)
TARGET_ANCHOR_DATE = datetime(2026, 6, 11)
DATE_DELTA = TARGET_ANCHOR_DATE - ORIGINAL_ANCHOR_DATE  # 1299 days

# Fixed kickoff hour, Madrid local time. Plausible evening match slot.
KICKOFF_HOUR = 18
KICKOFF_MINUTE = 0


def rebase_fecha(fecha: str) -> str:
    """`2022-11-20 02:00:00` → `2026-06-11 18:00:00` (and same delta for other days)."""
    original = datetime.strptime(fecha, "%Y-%m-%d %H:%M:%S")
    new_day = original + DATE_DELTA
    new_dt = new_day.replace(hour=KICKOFF_HOUR, minute=KICKOFF_MINUTE, second=0)
    return new_dt.strftime("%Y-%m-%d %H:%M:%S")


def transform_record(record: dict) -> dict:
    copy = dict(record)
    for key in NULLABLE_RESULT_KEYS:
        if key not in copy:
            raise KeyError(
                f"Expected key '{key}' missing in record "
                f"external_id={copy.get('external_id')!r}"
            )
        copy[key] = None
    if "fecha" not in copy:
        raise KeyError(
            f"Expected key 'fecha' missing in record "
            f"external_id={copy.get('external_id')!r}"
        )
    copy["fecha"] = rebase_fecha(copy["fecha"])
    return copy


def main() -> None:
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input not found: {INPUT_PATH}")

    with INPUT_PATH.open("r", encoding="utf-8") as f:
        records = json.load(f)

    if not isinstance(records, list):
        raise TypeError(
            f"Expected JSON array at top level of {INPUT_PATH}, "
            f"got {type(records).__name__}"
        )

    group_only = [r for r in records if r.get("fase") == "fase_grupos"]
    transformed = [transform_record(r) for r in group_only]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=4)
        f.write("\n")

    print(f"Read   {len(records)} matches from {INPUT_PATH}")
    print(f"Filter group_stage only: kept {len(transformed)} of {len(records)}")
    print(f"Wrote  {len(transformed)} matches to   {OUTPUT_PATH}")
    print(f"Date delta applied: +{DATE_DELTA.days} days")
    print(f"Kickoff hour fixed at: {KICKOFF_HOUR:02d}:{KICKOFF_MINUTE:02d}:00 (Madrid local)")
    print(
        f"First match {transformed[0]['external_id']}: "
        f"{records[0]['fecha']} → {transformed[0]['fecha']}"
    )
    print(
        f"Last match  {transformed[-1]['external_id']}: "
        f"{records[-1]['fecha']} → {transformed[-1]['fecha']}"
    )


if __name__ == "__main__":
    main()

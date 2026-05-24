import type { Breakdown, ScoringOutput, ScoringRulesV1 } from "./types";

export type FixtureForTable = {
  fixture_id: string;
  group_code: string;
  home_team_id: string;
  away_team_id: string;
  home_team_code: string;
  away_team_code: string;
  home_goals_90: number;
  away_goals_90: number;
};

export type GroupTableRow = {
  team_id: string;
  team_code: string;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  played: number;
};

export type GroupTable = {
  group_code: string;
  rows: GroupTableRow[];
  complete: boolean;
};

export function computeGroupTables(
  fixtures: FixtureForTable[],
  expectedMatchesPerGroup: number,
): Map<string, GroupTable> {
  const byGroup = new Map<string, FixtureForTable[]>();
  for (const f of fixtures) {
    if (!byGroup.has(f.group_code)) byGroup.set(f.group_code, []);
    byGroup.get(f.group_code)!.push(f);
  }

  const result = new Map<string, GroupTable>();
  for (const [groupCode, fxs] of byGroup) {
    const rowsById = new Map<string, GroupTableRow>();
    const ensure = (teamId: string, teamCode: string): GroupTableRow => {
      let row = rowsById.get(teamId);
      if (!row) {
        row = { team_id: teamId, team_code: teamCode, pts: 0, gf: 0, ga: 0, gd: 0, played: 0 };
        rowsById.set(teamId, row);
      }
      return row;
    };

    for (const f of fxs) {
      const home = ensure(f.home_team_id, f.home_team_code);
      const away = ensure(f.away_team_id, f.away_team_code);
      home.played += 1;
      away.played += 1;
      home.gf += f.home_goals_90;
      home.ga += f.away_goals_90;
      away.gf += f.away_goals_90;
      away.ga += f.home_goals_90;
      if (f.home_goals_90 > f.away_goals_90) home.pts += 3;
      else if (f.home_goals_90 < f.away_goals_90) away.pts += 3;
      else {
        home.pts += 1;
        away.pts += 1;
      }
    }

    for (const row of rowsById.values()) row.gd = row.gf - row.ga;

    const rows = [...rowsById.values()].sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team_code.localeCompare(b.team_code);
    });

    result.set(groupCode, {
      group_code: groupCode,
      rows,
      complete: fxs.length >= expectedMatchesPerGroup,
    });
  }

  return result;
}

export type GroupQualificationPredictionInput = {
  user_id: string;
  group_code: string;
  predicted_team_ids: string[];
};

export function scoreGroupQualificationPrediction(
  p: GroupQualificationPredictionInput,
  table: GroupTable | undefined,
  rules: ScoringRulesV1,
): ScoringOutput {
  const breakdown: Breakdown = {};
  if (!table || !table.complete || table.rows.length < 2) {
    return { subtotal: 0, multiplier: 1, total: 0, breakdown };
  }
  const qualified = new Set([table.rows[0].team_id, table.rows[1].team_id]);
  let hits = 0;
  for (const teamId of p.predicted_team_ids) {
    if (qualified.has(teamId)) hits += 1;
  }
  const points = hits * rules.group_qualification.team_correct;
  if (points > 0) breakdown.team_correct = points;
  return { subtotal: points, multiplier: 1, total: points, breakdown };
}

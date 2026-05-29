import type { Breakdown, ScoringOutput, ScoringRulesV1 } from "./types";

// WC2026 format: the 8 best third-placed teams (across the 12 groups) advance
// to the round of 32, on top of the top 2 of every group. Centralised here so
// the prediction form, the scoring engine and the admin standings view all
// agree. Change this single constant if the tournament format changes.
export const BEST_THIRDS_ADVANCE = 8;

// Standard group/third-place ordering: points, then goal difference, then
// goals for, then team code as a deterministic last resort.
function compareStandings(
  a: { pts: number; gd: number; gf: number; team_code: string },
  b: { pts: number; gd: number; gf: number; team_code: string },
): number {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.team_code.localeCompare(b.team_code);
}

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

    const rows = [...rowsById.values()].sort(compareStandings);

    result.set(groupCode, {
      group_code: groupCode,
      rows,
      complete: fxs.length >= expectedMatchesPerGroup,
    });
  }

  return result;
}

export type ThirdPlaceRanking = {
  team_id: string;
  team_code: string;
  group_code: string;
  pts: number;
  gd: number;
  gf: number;
  /** True when this third-placed team ranks among the best thirds that advance. */
  advanced: boolean;
};

export type AdvancingTeams = {
  /** Every team_id that advances to the round of 32. */
  advancing: Set<string>;
  /** Per-group advancing team_ids (top 2 + the third if it ranks in). */
  byGroup: Map<string, Set<string>>;
  /** The third-placed teams ranked globally, best first. */
  thirds: ThirdPlaceRanking[];
  /** True once every expected group table is complete. */
  allGroupsComplete: boolean;
};

// Compute who advances to R32: the top 2 of every completed group, plus the
// `thirdsAdvance` best third-placed teams. The best-thirds ranking is only
// resolved once ALL groups are complete (you cannot rank the 12 thirds until
// every group has finished); until then only the top-2 advance. Pass
// `thirdsAdvance = 0` for formats without a best-thirds round.
export function computeAdvancingTeams(
  tables: Map<string, GroupTable>,
  expectedGroups: number,
  thirdsAdvance: number = BEST_THIRDS_ADVANCE,
): AdvancingTeams {
  const advancing = new Set<string>();
  const byGroup = new Map<string, Set<string>>();
  const thirds: ThirdPlaceRanking[] = [];
  let completeCount = 0;

  for (const [code, t] of tables) {
    if (!t.complete || t.rows.length < 2) continue;
    completeCount += 1;
    const set = new Set<string>([t.rows[0].team_id, t.rows[1].team_id]);
    byGroup.set(code, set);
    advancing.add(t.rows[0].team_id);
    advancing.add(t.rows[1].team_id);
    if (t.rows.length >= 3) {
      const third = t.rows[2];
      thirds.push({
        team_id: third.team_id,
        team_code: third.team_code,
        group_code: code,
        pts: third.pts,
        gd: third.gd,
        gf: third.gf,
        advanced: false,
      });
    }
  }

  const allGroupsComplete = expectedGroups > 0 && completeCount >= expectedGroups;

  thirds.sort(compareStandings);
  if (allGroupsComplete && thirdsAdvance > 0) {
    for (let i = 0; i < thirds.length && i < thirdsAdvance; i += 1) {
      thirds[i].advanced = true;
      advancing.add(thirds[i].team_id);
      byGroup.get(thirds[i].group_code)?.add(thirds[i].team_id);
    }
  }

  return { advancing, byGroup, thirds, allGroupsComplete };
}

export type GroupQualificationPredictionInput = {
  user_id: string;
  group_code: string;
  predicted_team_ids: string[];
};

// Awards `team_correct` points per predicted team that actually advances to
// R32 (top 2 of its group OR a best third). `advancingTeamIds` is the global
// set from computeAdvancingTeams — teams from incomplete groups are simply not
// in it, so they score 0 until their group resolves.
export function scoreGroupQualificationPrediction(
  p: GroupQualificationPredictionInput,
  advancingTeamIds: Set<string>,
  rules: ScoringRulesV1,
): ScoringOutput {
  const breakdown: Breakdown = {};
  let hits = 0;
  for (const teamId of p.predicted_team_ids) {
    if (advancingTeamIds.has(teamId)) hits += 1;
  }
  const points = hits * rules.group_qualification.team_correct;
  if (points > 0) breakdown.team_correct = points;
  return { subtotal: points, multiplier: 1, total: points, breakdown };
}

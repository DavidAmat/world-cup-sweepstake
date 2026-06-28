import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { madridDateKey, formatDayMonthEs } from "@/lib/dates/madridTime";
import { bucketFromBreakdown, type CategoryBucket } from "./breakdownLabels";

// View-models for /clasificacion. All aggregations happen in JS over
// the rows returned by Supabase — no SQL views needed for 10 users ×
// ~104 fixtures.
//
// IMPORTANT: `prediction_scores.points_total` arrives as a string
// because the column is `numeric(8,2)`. We coerce with Number() at the
// reading boundary.

export type ProfileRef = {
  user_id: string;
  display_name: string;
  initials: string;
  role: string;
};

export type RoundRef = {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  stage_code: string;
};

export type StageRef = {
  code: string;
  name: string;
  sort_order: number;
};

// --- Shared loader ---------------------------------------------------

export async function loadLeaderboardData(tournamentId: string) {
  const supabase = await createClient();

  const [profilesRes, scoresRaw, fixturesRes, roundsRes, stagesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, initials, role")
      .order("display_name", { ascending: true }),
    fetchAllRows((from, to) =>
      supabase
        .from("prediction_scores")
        .select("user_id, fixture_id, prediction_type, points_total, points_breakdown")
        .eq("tournament_id", tournamentId)
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("fixtures")
      .select("id, round_id, stage_id, kickoff_at")
      .eq("tournament_id", tournamentId),
    supabase
      .from("rounds")
      .select("id, code, name, sort_order, stage:stages ( code )")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("stages")
      .select("code, name, sort_order")
      .eq("tournament_id", tournamentId)
      .order("sort_order", { ascending: true }),
  ]);

  const profiles = (profilesRes.data ?? []) as ProfileRef[];
  const rawScores = scoresRaw ?? [];
  const fixtures = fixturesRes.data ?? [];
  const rawRounds = (roundsRes.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    sort_order: number;
    stage: { code: string } | null;
  }>;
  const rawStages = stagesRes.data ?? [];

  const scores = rawScores.map((s) => ({
    user_id: s.user_id,
    fixture_id: s.fixture_id as string | null,
    prediction_type: s.prediction_type as
      | "group_phase"
      | "knockout"
      | "initial"
      | "group_qualification",
    points_total: Number(s.points_total),
    points_breakdown: (s.points_breakdown ?? {}) as Record<string, unknown>,
  }));

  const rounds: RoundRef[] = rawRounds.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sort_order: r.sort_order,
    stage_code: r.stage?.code ?? "group_stage",
  }));

  const stages: StageRef[] = rawStages.map((s) => ({
    code: s.code,
    name: s.name,
    sort_order: s.sort_order,
  }));

  const fixtureToRound = new Map<string, string>();
  const fixtureToStage = new Map<string, string>();
  // Madrid calendar day each fixture is played on ("YYYY-MM-DD"). Drives the
  // date-based X axis of the evolution chart.
  const fixtureToDate = new Map<string, string>();
  const stageByRound = new Map<string, string>(rounds.map((r) => [r.id, r.stage_code]));
  for (const f of fixtures) {
    fixtureToRound.set(f.id, f.round_id);
    fixtureToStage.set(f.id, stageByRound.get(f.round_id) ?? "group_stage");
    if (f.kickoff_at) fixtureToDate.set(f.id, madridDateKey(f.kickoff_at as string));
  }

  return {
    profiles,
    scores,
    rounds,
    stages,
    fixtureToRound,
    fixtureToStage,
    fixtureToDate,
  };
}

export type LeaderboardData = Awaited<ReturnType<typeof loadLeaderboardData>>;

// --- General ranking -------------------------------------------------

export type RankingRow = {
  profile: ProfileRef;
  total: number;
  position: number; // 1-based, with ties sharing position
  isTop: boolean;
  isBottom: boolean;
};

export function buildGeneralRanking(data: LeaderboardData): RankingRow[] {
  const totalsByUser = new Map<string, number>();
  for (const s of data.scores) {
    totalsByUser.set(s.user_id, (totalsByUser.get(s.user_id) ?? 0) + s.points_total);
  }

  const rows = data.profiles.map((p) => ({
    profile: p,
    total: totalsByUser.get(p.user_id) ?? 0,
  }));
  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.profile.display_name.localeCompare(b.profile.display_name);
  });

  const maxTotal = rows[0]?.total ?? 0;
  const minTotal = rows.length > 0 ? rows[rows.length - 1].total : 0;

  let lastTotal: number | null = null;
  let lastPosition = 0;
  return rows.map((r, idx) => {
    const position = r.total === lastTotal ? lastPosition : idx + 1;
    lastTotal = r.total;
    lastPosition = position;
    return {
      profile: r.profile,
      total: r.total,
      position,
      isTop: rows.length > 1 && r.total === maxTotal && maxTotal > 0,
      isBottom: rows.length > 1 && r.total === minTotal && r.total !== maxTotal,
    };
  });
}

// --- By round --------------------------------------------------------

export type ByRoundCell = { points: number; hasFixture: boolean };
export type ByRoundRow = {
  profile: ProfileRef;
  total: number; // sum of all match-related rounds
  byRound: Map<string, number>; // roundCode → points
};

export function buildByRound(data: LeaderboardData): {
  rounds: RoundRef[]; // only rounds that have scored fixtures
  rows: ByRoundRow[];
  totalsByRound: Map<string, number>;
} {
  const roundsWithScores = new Set<string>();
  for (const s of data.scores) {
    if (s.prediction_type !== "group_phase" && s.prediction_type !== "knockout") continue;
    if (!s.fixture_id) continue;
    const rId = data.fixtureToRound.get(s.fixture_id);
    if (rId) roundsWithScores.add(rId);
  }
  const rounds = data.rounds.filter((r) => roundsWithScores.has(r.id));
  const roundCodeById = new Map(rounds.map((r) => [r.id, r.code]));

  const rows: ByRoundRow[] = data.profiles.map((p) => ({
    profile: p,
    total: 0,
    byRound: new Map(rounds.map((r) => [r.code, 0])),
  }));
  const rowByUser = new Map(rows.map((r) => [r.profile.user_id, r]));

  for (const s of data.scores) {
    if (s.prediction_type !== "group_phase" && s.prediction_type !== "knockout") continue;
    if (!s.fixture_id) continue;
    const rId = data.fixtureToRound.get(s.fixture_id);
    if (!rId) continue;
    const code = roundCodeById.get(rId);
    if (!code) continue;
    const row = rowByUser.get(s.user_id);
    if (!row) continue;
    row.byRound.set(code, (row.byRound.get(code) ?? 0) + s.points_total);
    row.total += s.points_total;
  }

  rows.sort(
    (a, b) => b.total - a.total || a.profile.display_name.localeCompare(b.profile.display_name),
  );

  const totalsByRound = new Map<string, number>();
  for (const r of rounds) {
    let s = 0;
    for (const row of rows) s += row.byRound.get(r.code) ?? 0;
    totalsByRound.set(r.code, s);
  }

  return { rounds, rows, totalsByRound };
}

// --- By stage --------------------------------------------------------

export type ByStageRow = {
  profile: ProfileRef;
  total: number;
  byStage: Map<string, number>; // stageCode → points
};

export function buildByStage(data: LeaderboardData): {
  stages: StageRef[];
  rows: ByStageRow[];
} {
  const stagesWithScores = new Set<string>();
  for (const s of data.scores) {
    if (s.prediction_type !== "group_phase" && s.prediction_type !== "knockout") continue;
    if (!s.fixture_id) continue;
    const st = data.fixtureToStage.get(s.fixture_id);
    if (st) stagesWithScores.add(st);
  }
  const stages = data.stages.filter((st) => stagesWithScores.has(st.code));

  const rows: ByStageRow[] = data.profiles.map((p) => ({
    profile: p,
    total: 0,
    byStage: new Map(stages.map((s) => [s.code, 0])),
  }));
  const rowByUser = new Map(rows.map((r) => [r.profile.user_id, r]));

  for (const s of data.scores) {
    if (s.prediction_type !== "group_phase" && s.prediction_type !== "knockout") continue;
    if (!s.fixture_id) continue;
    const st = data.fixtureToStage.get(s.fixture_id);
    if (!st) continue;
    const row = rowByUser.get(s.user_id);
    if (!row) continue;
    row.byStage.set(st, (row.byStage.get(st) ?? 0) + s.points_total);
    row.total += s.points_total;
  }

  rows.sort(
    (a, b) => b.total - a.total || a.profile.display_name.localeCompare(b.profile.display_name),
  );
  return { stages, rows };
}

// --- By category -----------------------------------------------------

export type ByCategoryRow = {
  profile: ProfileRef;
  total: number;
  byCategory: Record<CategoryBucket, number>;
};

export function buildByCategory(data: LeaderboardData): ByCategoryRow[] {
  const rows: ByCategoryRow[] = data.profiles.map((p) => ({
    profile: p,
    total: 0,
    byCategory: {
      match_outcome: 0,
      knockout_extra: 0,
      initial: 0,
      group_qualification: 0,
    },
  }));
  const rowByUser = new Map(rows.map((r) => [r.profile.user_id, r]));

  for (const s of data.scores) {
    const row = rowByUser.get(s.user_id);
    if (!row) continue;
    const buckets = bucketFromBreakdown(s.points_breakdown);
    row.byCategory.match_outcome += buckets.match_outcome;
    row.byCategory.knockout_extra += buckets.knockout_extra;
    row.byCategory.initial += buckets.initial;
    row.byCategory.group_qualification += buckets.group_qualification;
    row.total += s.points_total;
  }

  rows.sort(
    (a, b) => b.total - a.total || a.profile.display_name.localeCompare(b.profile.display_name),
  );
  return rows;
}

// --- Evolution -------------------------------------------------------

export type EvolutionPoint = {
  dateKey: string; // Madrid calendar day, "YYYY-MM-DD"
  label: string; // "01-Jun"
  cumulativeByUser: Map<string, number>;
};

// Daily cumulative evolution. For each distinct fixture date we sum every
// match point each user earned up to and including that day. A fixture only
// has a `prediction_scores` row once its result is confirmed, so unplayed
// matches contribute nothing and the cumulative simply stays flat.
//
// The X axis runs from the first fixture date up to the LAST date that has any
// results — future dates with no results are dropped so the chart doesn't
// trail off into a flat horizontal line. As new results are entered the axis
// automatically extends.
export function buildEvolution(data: LeaderboardData): EvolutionPoint[] {
  // Per-day, per-user match-point increments, and the set of days with results.
  const incByDate = new Map<string, Map<string, number>>();
  const datesWithScores = new Set<string>();
  for (const s of data.scores) {
    if (s.prediction_type !== "group_phase" && s.prediction_type !== "knockout") continue;
    if (!s.fixture_id) continue;
    const dateKey = data.fixtureToDate.get(s.fixture_id);
    if (!dateKey) continue;
    datesWithScores.add(dateKey);
    let bucket = incByDate.get(dateKey);
    if (!bucket) {
      bucket = new Map();
      incByDate.set(dateKey, bucket);
    }
    bucket.set(s.user_id, (bucket.get(s.user_id) ?? 0) + s.points_total);
  }

  if (datesWithScores.size === 0) return [];

  // ISO "YYYY-MM-DD" strings sort correctly lexicographically.
  const lastDate = [...datesWithScores].sort().at(-1)!;

  const axisDates = [...new Set(data.fixtureToDate.values())]
    .filter((d) => d <= lastDate)
    .sort();

  // initial / group_qualification have no fixture date; apply them entirely on
  // the first day so each line starts from a realistic baseline.
  const baseExtras = new Map<string, number>();
  for (const s of data.scores) {
    if (s.prediction_type !== "initial" && s.prediction_type !== "group_qualification") continue;
    baseExtras.set(s.user_id, (baseExtras.get(s.user_id) ?? 0) + s.points_total);
  }

  const points: EvolutionPoint[] = [];
  const cumulative = new Map<string, number>(baseExtras);
  for (const dateKey of axisDates) {
    const inc = incByDate.get(dateKey);
    if (inc) {
      for (const [user, pts] of inc) {
        cumulative.set(user, (cumulative.get(user) ?? 0) + pts);
      }
    }
    points.push({
      dateKey,
      label: formatDayMonthEs(dateKey),
      cumulativeByUser: new Map(cumulative),
    });
  }

  // Make sure every profile is represented (baseline if no match scores yet)
  for (const p of data.profiles) {
    for (const pt of points) {
      if (!pt.cumulativeByUser.has(p.user_id)) {
        pt.cumulativeByUser.set(p.user_id, baseExtras.get(p.user_id) ?? 0);
      }
    }
  }

  return points;
}

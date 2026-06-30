// "Resultado Justo" derivation — the heart of La Porra Justa.
//
// Given the REAL confirmed result and the stoppage-time ("al 90") goals to
// subtract per team, produce the fair result that the existing pure scorers
// (scoreGroupMatch / scoreKnockoutMatch) will then consume unchanged.
//
// This function is pure and never touches the database.

export type RealResultForFair = {
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  went_penalties: boolean;
  qualified_team_id: string | null;
};

export type FairDerivation = {
  home_goals_90: number;
  away_goals_90: number;
  went_extra_time: boolean;
  went_penalties: boolean;
  winner_team_id: string | null; // 90' winner (null on a fair draw)
  qualified_team_id: string | null; // advancer (knockout only)
};

export type DeriveFairArgs = {
  real: RealResultForFair;
  homeTeamId: string | null;
  awayTeamId: string | null;
  addedHome: number; // stoppage-time goals to subtract from home
  addedAway: number; // stoppage-time goals to subtract from away
  isKnockout: boolean;
};

const clampNonNeg = (n: number) => (n < 0 ? 0 : n);

export function deriveFairResult(args: DeriveFairArgs): FairDerivation {
  const { real, homeTeamId, awayTeamId, addedHome, addedAway, isKnockout } = args;

  const fh = clampNonNeg(real.home_goals_90 - addedHome);
  const fa = clampNonNeg(real.away_goals_90 - addedAway);

  // Group stage: just the adjusted 90' score. No advancer, no overtime.
  if (!isKnockout) {
    return {
      home_goals_90: fh,
      away_goals_90: fa,
      went_extra_time: false,
      went_penalties: false,
      winner_team_id: fh > fa ? homeTeamId : fa > fh ? awayTeamId : null,
      qualified_team_id: null,
    };
  }

  // Knockout, fair score has a 90' winner → decided in regulation. The fair
  // advancer is that fair winner, even if a DIFFERENT team really advanced
  // (e.g. the real match was a late equalizer that went to penalties — Case 2).
  if (fh !== fa) {
    const winner = fh > fa ? homeTeamId : awayTeamId;
    return {
      home_goals_90: fh,
      away_goals_90: fa,
      went_extra_time: false,
      went_penalties: false,
      winner_team_id: winner,
      qualified_team_id: winner,
    };
  }

  // Knockout, fair score is a draw.
  if (real.went_extra_time) {
    // The real match was ALSO level at 90' and really went to extra time /
    // penalties. The fair draw matches reality, so we keep exactly what
    // happened (real ET, real penalties, real advancer). Both teams scored in
    // stoppage time and the net score stayed level.
    return {
      home_goals_90: fh,
      away_goals_90: fa,
      went_extra_time: real.went_extra_time,
      went_penalties: real.went_penalties,
      winner_team_id: null,
      qualified_team_id: real.qualified_team_id,
    };
  }

  // Counterfactual extra time (Case 1): the real match was decided in 90' by a
  // late goal; removing it produces a draw that would have gone to extra time.
  // We reward "prórroga" but never "penaltis" (we cannot know the counterfactual
  // shootout), and the team that really advanced is assumed to still advance.
  return {
    home_goals_90: fh,
    away_goals_90: fa,
    went_extra_time: true,
    went_penalties: false,
    winner_team_id: null,
    qualified_team_id: real.qualified_team_id,
  };
}

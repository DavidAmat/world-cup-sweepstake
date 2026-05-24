import { resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());

export const PATHS = {
  tournamentJson: resolve(REPO_ROOT, "data/seeds/wc_2026/tournament.json"),
  teamsJson: resolve(REPO_ROOT, "data/seeds/wc_2026/teams.json"),
  fixturesJson: resolve(REPO_ROOT, "data/seeds/wc_2026/fixtures.json"),
};

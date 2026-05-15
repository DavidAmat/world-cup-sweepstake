import { resolve } from "node:path";

const REPO_ROOT = resolve(process.cwd());

export const PATHS = {
  tournamentJson: resolve(REPO_ROOT, "data/seeds/wc_2022/tournament.json"),
  teamsJson: resolve(REPO_ROOT, "data/seeds/wc_2022/teams.json"),
  fixturesJson: resolve(REPO_ROOT, "data/partidos/2022/partidos_2022_sin_resultados.json"),
};

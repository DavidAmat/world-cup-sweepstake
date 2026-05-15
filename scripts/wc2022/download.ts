import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PythonMatchesSchema, TournamentSchema, type PythonMatch } from "./lib/schemas";
import { PATHS } from "./lib/paths";
import { assertSafeTarget, detectTarget } from "./lib/env";
import { createScriptAdminClient } from "./lib/supabase";
import { fatal, info, step, warn } from "./lib/log";
import {
  roundToJornada,
  stageToFase,
  tipoPartidoFromFase,
  utcIsoToMadridLocal,
} from "./lib/format";
import type { RoundCode, StageCode } from "./lib/catalogs";

// Reads fixtures (and any match_results, if present) from Supabase and
// projects them into the Python pipeline JSON shape so a `wc2022:upload`
// re-run from local would be a no-op. Two modes:
//   default        → print a diff against the local JSON, do not write
//   --write        → overwrite the local JSON with the DB snapshot

async function fetchSnapshot(): Promise<PythonMatch[]> {
  const tournament = TournamentSchema.parse(JSON.parse(readFileSync(PATHS.tournamentJson, "utf8")));
  const supabase = createScriptAdminClient();

  step(`Reading fixtures from DB (tournament=${tournament.slug})`);

  const { data: tournamentRow, error: tErr } = await supabase
    .from("tournaments")
    .select("id, slug")
    .eq("slug", tournament.slug)
    .maybeSingle();
  if (tErr) throw new Error(`fetch tournament: ${tErr.message}`);
  if (!tournamentRow) {
    fatal(
      `Tournament with slug "${tournament.slug}" not found in DB.\n` +
        "  Run `npm run wc2022:upload` first.",
    );
  }

  const { data: fixtures, error: fErr } = await supabase
    .from("fixtures")
    .select(
      `
        external_id,
        group_code,
        kickoff_at,
        home_team:teams!fixtures_home_team_id_fkey ( display_name ),
        away_team:teams!fixtures_away_team_id_fkey ( display_name ),
        stage:stages ( code ),
        round:rounds ( code ),
        result:match_results ( home_goals_90, away_goals_90, went_extra_time, went_penalties, winner_team_id )
      `,
    )
    .eq("tournament_id", tournamentRow.id)
    .order("kickoff_at", { ascending: true });
  if (fErr) throw new Error(`fetch fixtures: ${fErr.message}`);
  if (!fixtures) return [];

  // Supabase typegen treats match_results as a single object (1:1 via
  // unique fixture_id) but at runtime supabase-js may return an array.
  // The helper normalizes both shapes.
  type MatchResultProjection = {
    home_goals_90: number;
    away_goals_90: number;
    went_extra_time: boolean;
    went_penalties: boolean;
    winner_team_id: string | null;
  };
  function resultOf(raw: unknown): MatchResultProjection | null {
    if (!raw) return null;
    if (Array.isArray(raw)) return (raw[0] ?? null) as MatchResultProjection | null;
    return raw as MatchResultProjection;
  }

  // Build a winner_team_id → display_name lookup (single round-trip).
  const winnerIds = Array.from(
    new Set(
      fixtures
        .map((f) => resultOf(f.result)?.winner_team_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const winnerNameById = new Map<string, string>();
  if (winnerIds.length > 0) {
    const { data: winnerRows, error: wErr } = await supabase
      .from("teams")
      .select("id, display_name")
      .in("id", winnerIds);
    if (wErr) throw new Error(`fetch winner teams: ${wErr.message}`);
    for (const r of winnerRows ?? []) winnerNameById.set(r.id, r.display_name);
  }

  const matches: PythonMatch[] = [];
  for (const f of fixtures) {
    if (!f.external_id) {
      warn(`Skipping fixture with NULL external_id (id missing in DB)`);
      continue;
    }
    const home = f.home_team?.display_name ?? "";
    const away = f.away_team?.display_name ?? "";
    if (!home || !away) {
      warn(`Skipping ${f.external_id}: unresolved team(s) in DB`);
      continue;
    }
    const stageCode = f.stage?.code as StageCode | undefined;
    const roundCode = f.round?.code as RoundCode | undefined;
    if (!stageCode || !roundCode) {
      warn(`Skipping ${f.external_id}: missing stage/round in DB`);
      continue;
    }

    const fase = stageToFase(stageCode);
    const jornada = roundToJornada(roundCode);
    const result = resultOf(f.result);

    let ganador: string | null = null;
    if (result) {
      if (result.went_penalties || result.went_extra_time) {
        ganador = result.winner_team_id
          ? (winnerNameById.get(result.winner_team_id) ?? null)
          : null;
      } else if (result.home_goals_90 > result.away_goals_90) {
        ganador = home;
      } else if (result.away_goals_90 > result.home_goals_90) {
        ganador = away;
      } else if (fase === "fase_grupos") {
        ganador = "empate";
      } else if (result.winner_team_id) {
        ganador = winnerNameById.get(result.winner_team_id) ?? null;
      }
    }

    matches.push({
      external_id: f.external_id,
      fase,
      tipo_partido: tipoPartidoFromFase(fase),
      jornada,
      grupo: f.group_code,
      equipo_1: home,
      equipo_2: away,
      fecha: utcIsoToMadridLocal(f.kickoff_at),
      marcador_equipo_1_90_mins: result?.home_goals_90 ?? null,
      marcador_equipo_2_90_mins: result?.away_goals_90 ?? null,
      prorroga: result ? Boolean(result.went_extra_time) : null,
      penaltis: result ? Boolean(result.went_penalties) : null,
      ganador,
    });
  }

  return matches;
}

type DiffSummary = {
  added: string[];
  removed: string[];
  modified: { external_id: string; changes: Record<string, [unknown, unknown]> }[];
};

function diff(localList: PythonMatch[], remoteList: PythonMatch[]): DiffSummary {
  const local = new Map(localList.map((m) => [m.external_id, m]));
  const remote = new Map(remoteList.map((m) => [m.external_id, m]));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: DiffSummary["modified"] = [];

  for (const id of remote.keys()) if (!local.has(id)) added.push(id);
  for (const id of local.keys()) if (!remote.has(id)) removed.push(id);

  for (const [id, r] of remote) {
    const l = local.get(id);
    if (!l) continue;
    const changes: Record<string, [unknown, unknown]> = {};
    for (const key of Object.keys(r) as (keyof PythonMatch)[]) {
      const a = JSON.stringify(l[key]);
      const b = JSON.stringify(r[key]);
      if (a !== b) changes[key as string] = [l[key], r[key]];
    }
    if (Object.keys(changes).length > 0) modified.push({ external_id: id, changes });
  }

  return { added, removed, modified };
}

async function main() {
  const target = detectTarget();
  assertSafeTarget(target, { writes: false });

  const writeMode = process.argv.includes("--write");

  const remote = await fetchSnapshot();
  step("Snapshot");
  info("matches in DB", remote.length);

  let local: PythonMatch[] = [];
  if (existsSync(PATHS.fixturesJson)) {
    local = PythonMatchesSchema.parse(JSON.parse(readFileSync(PATHS.fixturesJson, "utf8")));
    info("matches in local JSON", local.length);
  } else {
    info("local JSON", "(missing)");
  }

  const summary = diff(local, remote);
  step("Diff (local → DB)");
  info("added (in DB, not local)", summary.added.length);
  info("removed (in local, not DB)", summary.removed.length);
  info("modified", summary.modified.length);

  if (summary.added.length > 0) for (const id of summary.added) info("+", id);
  if (summary.removed.length > 0) for (const id of summary.removed) info("-", id);
  if (summary.modified.length > 0) {
    for (const m of summary.modified) {
      info("~", m.external_id);
      for (const [key, [oldVal, newVal]] of Object.entries(m.changes)) {
        console.log(`     ${key}: ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`);
      }
    }
  }

  if (writeMode) {
    step("Writing snapshot to local JSON");
    writeFileSync(PATHS.fixturesJson, JSON.stringify(remote, null, 4) + "\n", "utf8");
    info("wrote", PATHS.fixturesJson);
  } else {
    step("Done (read-only — pass --write to overwrite local JSON)");
  }
}

main().catch((err) => {
  fatal("download failed", err);
});

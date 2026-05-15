// Pure helpers for the JSON import flow. Kept out of actions.ts so they
// can be reused by previewImport and commitImport without going through
// the "use server" boundary.

import { z } from "zod";
import {
  ImportFixturesSchema,
  resolveRound,
  resolveStage,
  type Fase,
  type PythonMatch,
} from "@/lib/fixtures/pythonFormat";
import type { RoundCode, StageCode } from "@/lib/fixtures/catalogs";
import { madridLocalToUtcIso } from "@/lib/dates/madridTime";

export type TeamLookup = {
  id: string;
  display_name: string;
  canonical_name: string;
  aliases: string[];
};

export type ResolveCtx = {
  tournamentId: string;
  teamsByNormalisedName: Map<string, TeamLookup>;
  stageIdByCode: Map<StageCode, string>;
  roundIdByCode: Map<RoundCode, string>;
  existingExternalIds: Set<string>;
};

export type ResolvedRow =
  | {
      kind: "create" | "update";
      external_id: string;
      summary: string;
      row: {
        tournament_id: string;
        external_id: string;
        stage_id: string;
        round_id: string;
        group_code: string | null;
        home_team_id: string | null;
        home_placeholder: string | null;
        away_team_id: string | null;
        away_placeholder: string | null;
        kickoff_at: string;
        venue: string | null;
        status: "scheduled";
      };
    }
  | { kind: "error"; external_id: string; summary: string; reason: string };

export type ResolveReport = {
  rows: ResolvedRow[];
  counts: { create: number; update: number; error: number; total: number };
};

const PLACEHOLDER_PREFIXES = [
  "ganador",
  "perdedor",
  "segundo",
  "tercero",
  "cuarto",
  "primero",
  "primer",
  "winner",
  "runner-up",
  "runnerup",
  "loser",
  "tbd",
];

// A real team name never starts with a digit and never contains the
// word "grupo"/"group" — so those are strong placeholder signals
// ("2.º Grupo C", "1er de A"). The rest are explicit prefixes.
function looksLikePlaceholder(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (n === "") return false;
  if (n.startsWith("?")) return true;
  if (/^\d/.test(n)) return true;
  if (/\bgrupo\b|\bgroup\b/.test(n)) return true;
  return PLACEHOLDER_PREFIXES.some((w) => n.startsWith(w));
}

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export function buildTeamLookup(teams: TeamLookup[]): Map<string, TeamLookup> {
  const map = new Map<string, TeamLookup>();
  for (const t of teams) {
    map.set(normalise(t.display_name), t);
    map.set(normalise(t.canonical_name), t);
    for (const alias of t.aliases ?? []) {
      map.set(normalise(alias), t);
    }
  }
  return map;
}

function resolveSide(
  ctx: ResolveCtx,
  name: string,
): { team_id: string | null; placeholder: string | null; error?: string } {
  const found = ctx.teamsByNormalisedName.get(normalise(name));
  if (found) return { team_id: found.id, placeholder: null };
  if (looksLikePlaceholder(name)) return { team_id: null, placeholder: name.trim() };
  return {
    team_id: null,
    placeholder: null,
    error: `Equipo no reconocido y tampoco parece un placeholder: "${name}".`,
  };
}

export function parseImportPayload(raw: string): PythonMatch[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`JSON inválido: ${(e as Error).message}`);
  }
  try {
    return ImportFixturesSchema.parse(parsed);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const head = e.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join(" · ");
      const extra = e.issues.length > 3 ? ` (+${e.issues.length - 3} más)` : "";
      throw new Error(`Schema inválido: ${head}${extra}`);
    }
    throw e;
  }
}

export function resolveImport(matches: PythonMatch[], ctx: ResolveCtx): ResolveReport {
  const rows: ResolvedRow[] = [];
  let create = 0;
  let update = 0;
  let error = 0;

  for (const match of matches) {
    const summary = `${match.equipo_1} vs ${match.equipo_2}`;
    try {
      const stageId = ctx.stageIdByCode.get(resolveStage(match.fase as Fase));
      const roundId = ctx.roundIdByCode.get(resolveRound(match.fase as Fase, match.jornada));
      if (!stageId || !roundId) {
        throw new Error(`Stage/Round no encontrados para fase=${match.fase}`);
      }

      const home = resolveSide(ctx, match.equipo_1);
      const away = resolveSide(ctx, match.equipo_2);
      if (home.error) throw new Error(home.error);
      if (away.error) throw new Error(away.error);
      if (home.team_id !== null && away.team_id !== null && home.team_id === away.team_id) {
        throw new Error("Local y visitante no pueden ser el mismo equipo.");
      }

      const kickoffUtc = madridLocalToUtcIso(match.fecha);
      const kind: "create" | "update" = ctx.existingExternalIds.has(match.external_id)
        ? "update"
        : "create";

      rows.push({
        kind,
        external_id: match.external_id,
        summary,
        row: {
          tournament_id: ctx.tournamentId,
          external_id: match.external_id,
          stage_id: stageId,
          round_id: roundId,
          group_code: match.grupo,
          home_team_id: home.team_id,
          home_placeholder: home.placeholder,
          away_team_id: away.team_id,
          away_placeholder: away.placeholder,
          kickoff_at: kickoffUtc,
          venue: match.venue ?? null,
          status: "scheduled",
        },
      });
      if (kind === "create") create++;
      else update++;
    } catch (e) {
      rows.push({
        kind: "error",
        external_id: match.external_id,
        summary,
        reason: (e as Error).message,
      });
      error++;
    }
  }

  return { rows, counts: { create, update, error, total: matches.length } };
}

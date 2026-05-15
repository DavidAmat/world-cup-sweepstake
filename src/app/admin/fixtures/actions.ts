"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { madridLocalToUtcIso } from "@/lib/dates/madridTime";
import { readCreatePayload, readUpdatePayload } from "./schemas";
import {
  buildTeamLookup,
  parseImportPayload,
  resolveImport,
  type ResolveCtx,
  type ResolveReport,
  type TeamLookup,
} from "./_import";
import type { RoundCode, StageCode } from "@/lib/fixtures/catalogs";

function flatten(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}

function sameSide(home: { team_id: string | null }, away: { team_id: string | null }) {
  return home.team_id !== null && away.team_id !== null && home.team_id === away.team_id;
}

export async function updateFixture(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  let payload;
  try {
    payload = readUpdatePayload(formData);
  } catch (e) {
    const msg = e instanceof z.ZodError ? flatten(e) : (e as Error).message;
    redirect(`/admin/fixtures/${formData.get("id") ?? ""}?error=${encodeURIComponent(msg)}`);
  }

  if (sameSide(payload.home, payload.away)) {
    redirect(
      `/admin/fixtures/${payload.id}?error=${encodeURIComponent(
        "El equipo local y el visitante no pueden ser el mismo.",
      )}`,
    );
  }

  let kickoffUtc: string;
  try {
    kickoffUtc = madridLocalToUtcIso(payload.kickoff_at);
  } catch (e) {
    redirect(`/admin/fixtures/${payload.id}?error=${encodeURIComponent((e as Error).message)}`);
  }

  const { error } = await supabase
    .from("fixtures")
    .update({
      kickoff_at: kickoffUtc,
      home_team_id: payload.home.team_id,
      home_placeholder: payload.home.placeholder,
      away_team_id: payload.away.team_id,
      away_placeholder: payload.away.placeholder,
      venue: payload.venue,
      status: payload.status,
    })
    .eq("id", payload.id)
    .eq("tournament_id", tournament.id);

  if (error) {
    redirect(`/admin/fixtures/${payload.id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/fixtures");
  revalidatePath(`/admin/fixtures/${payload.id}`);
  redirect(`/admin/fixtures/${payload.id}?ok=updated`);
}

export async function createFixture(formData: FormData) {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  let payload;
  try {
    payload = readCreatePayload(formData);
  } catch (e) {
    const msg = e instanceof z.ZodError ? flatten(e) : (e as Error).message;
    redirect(`/admin/fixtures/new?error=${encodeURIComponent(msg)}`);
  }

  if (sameSide(payload.home, payload.away)) {
    redirect(
      `/admin/fixtures/new?error=${encodeURIComponent(
        "El equipo local y el visitante no pueden ser el mismo.",
      )}`,
    );
  }

  // Stage/round consistency check: the round must belong to the
  // selected stage AND the tournament. The select on the form is
  // already filtered, but the server has to defend itself.
  const { data: round, error: roundErr } = await supabase
    .from("rounds")
    .select("id, stage_id, tournament_id")
    .eq("id", payload.round_id)
    .eq("tournament_id", tournament.id)
    .maybeSingle();
  if (roundErr || !round || round.stage_id !== payload.stage_id) {
    redirect(
      `/admin/fixtures/new?error=${encodeURIComponent(
        "La jornada no pertenece a la fase seleccionada.",
      )}`,
    );
  }

  // Uniqueness check on (tournament_id, external_id). Doing it
  // beforehand gives a nicer error message than the constraint
  // violation.
  const { data: existing } = await supabase
    .from("fixtures")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("external_id", payload.external_id)
    .maybeSingle();
  if (existing) {
    redirect(
      `/admin/fixtures/new?error=${encodeURIComponent(
        `Ya existe un fixture con external_id "${payload.external_id}".`,
      )}`,
    );
  }

  let kickoffUtc: string;
  try {
    kickoffUtc = madridLocalToUtcIso(payload.kickoff_at);
  } catch (e) {
    redirect(`/admin/fixtures/new?error=${encodeURIComponent((e as Error).message)}`);
  }

  const { data: inserted, error } = await supabase
    .from("fixtures")
    .insert({
      tournament_id: tournament.id,
      external_id: payload.external_id,
      stage_id: payload.stage_id,
      round_id: payload.round_id,
      group_code: payload.group_code,
      home_team_id: payload.home.team_id,
      home_placeholder: payload.home.placeholder,
      away_team_id: payload.away.team_id,
      away_placeholder: payload.away.placeholder,
      kickoff_at: kickoffUtc,
      venue: payload.venue,
      status: payload.status,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    redirect(`/admin/fixtures/new?error=${encodeURIComponent(error?.message ?? "Insert failed")}`);
  }

  revalidatePath("/admin/fixtures");
  redirect(`/admin/fixtures/${inserted.id}?ok=created`);
}

// ---------------------------------------------------------------------
// Bulk import via pasted JSON (the camino preferente for knockouts).
// ---------------------------------------------------------------------

export type PreviewState = {
  ok: boolean;
  error?: string;
  report?: ResolveReport;
};

async function buildImportCtx(): Promise<{
  ctx: ResolveCtx;
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  tournamentId: string;
}> {
  const { supabase } = await requireAdmin();
  const tournament = await getDefaultTournament();

  const [stagesRes, roundsRes, teamsRes, existingRes] = await Promise.all([
    supabase.from("stages").select("id, code").eq("tournament_id", tournament.id),
    supabase.from("rounds").select("id, code").eq("tournament_id", tournament.id),
    supabase
      .from("teams")
      .select("id, display_name, canonical_name, aliases")
      .eq("tournament_id", tournament.id),
    supabase.from("fixtures").select("external_id").eq("tournament_id", tournament.id),
  ]);

  const stageIdByCode = new Map<StageCode, string>();
  for (const s of stagesRes.data ?? []) stageIdByCode.set(s.code as StageCode, s.id);

  const roundIdByCode = new Map<RoundCode, string>();
  for (const r of roundsRes.data ?? []) roundIdByCode.set(r.code as RoundCode, r.id);

  const teamLookups: TeamLookup[] = (teamsRes.data ?? []).map((t) => ({
    id: t.id,
    display_name: t.display_name,
    canonical_name: t.canonical_name,
    aliases: Array.isArray(t.aliases) ? (t.aliases as string[]) : [],
  }));

  const existingExternalIds = new Set<string>();
  for (const f of existingRes.data ?? []) {
    if (f.external_id) existingExternalIds.add(f.external_id);
  }

  return {
    ctx: {
      tournamentId: tournament.id,
      teamsByNormalisedName: buildTeamLookup(teamLookups),
      stageIdByCode,
      roundIdByCode,
      existingExternalIds,
    },
    supabase,
    tournamentId: tournament.id,
  };
}

export async function previewImport(
  _previous: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  const payload = String(formData.get("payload") ?? "").trim();
  if (!payload) {
    return { ok: false, error: "Pega un JSON antes de validar." };
  }

  try {
    const matches = parseImportPayload(payload);
    const { ctx } = await buildImportCtx();
    const report = resolveImport(matches, ctx);
    return { ok: report.counts.error === 0, report };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function commitImport(formData: FormData) {
  const payload = String(formData.get("payload") ?? "").trim();
  if (!payload) {
    redirect(`/admin/fixtures/import?error=${encodeURIComponent("No hay JSON que importar.")}`);
  }

  const { ctx, supabase } = await buildImportCtx();

  let report: ResolveReport;
  try {
    const matches = parseImportPayload(payload);
    report = resolveImport(matches, ctx);
  } catch (e) {
    redirect(`/admin/fixtures/import?error=${encodeURIComponent((e as Error).message)}`);
  }

  if (report.counts.error > 0) {
    redirect(
      `/admin/fixtures/import?error=${encodeURIComponent(
        `El JSON tiene ${report.counts.error} fila(s) con error. Corrige el preview antes de confirmar.`,
      )}`,
    );
  }

  const rows = report.rows
    .filter((r): r is Extract<typeof r, { kind: "create" | "update" }> => r.kind !== "error")
    .map((r) => r.row);

  if (rows.length === 0) {
    redirect(
      `/admin/fixtures/import?error=${encodeURIComponent("No hay filas válidas para importar.")}`,
    );
  }

  const { error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "tournament_id,external_id" });

  if (error) {
    redirect(`/admin/fixtures/import?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin/fixtures");
  const summary = `${report.counts.create} nuevos, ${report.counts.update} actualizados.`;
  redirect(`/admin/fixtures?ok=imported:${encodeURIComponent(summary)}`);
}

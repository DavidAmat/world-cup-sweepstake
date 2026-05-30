import Link from "next/link";
import { TeamName } from "@/components/ui/TeamName";
import { NavSubmitButton } from "@/components/ui/SubmitButton";
import { requireAuth } from "@/lib/permissions/requireAuth";
import { getDefaultTournament } from "@/lib/tournament/getDefaultTournament";
import { getInitialLockState } from "@/lib/predictions/initialLock";
import { GROUP_CODES } from "../schemas";

type SearchParams = Promise<{ cat?: string }>;

const CATEGORIES = [
  { value: "campeon", label: "Campeón" },
  { value: "subcampeon", label: "Subcampeón" },
  { value: "pichichi", label: "Pichichi" },
  { value: "mejor_jugador", label: "Mejor jugador" },
  { value: "ultimo", label: "Último de la porra" },
  { value: "clasificados", label: "Clasificados de grupo" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const INPUT_CLS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

export default async function PublicInitialPredictionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { cat } = await searchParams;
  const category: Category = CATEGORIES.some((c) => c.value === cat)
    ? (cat as Category)
    : "campeon";

  const { supabase } = await requireAuth();
  const tournament = await getDefaultTournament();
  const { locked } = await getInitialLockState(tournament.id);

  if (!locked) {
    return (
      <main className="mx-auto max-w-5xl p-10">
        <h1 className="text-2xl font-bold">Predicciones iniciales · vista pública</h1>
        <p className="mt-4 rounded-md border border-warning-light bg-warning-light p-3 text-sm text-warning-fg">
          Las predicciones de los demás se harán públicas cuando el administrador las bloquee.
          Hasta entonces solo ves las tuyas.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/predictions/initial" className="underline">
            ← Volver a mis predicciones
          </Link>
        </p>
      </main>
    );
  }

  const [{ data: profiles }, { data: preds }, { data: gqp }, { data: teams }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name, initials").order("display_name"),
    supabase
      .from("initial_predictions")
      .select(
        "user_id, champion_team_id, runner_up_team_id, top_scorer_text, best_player_text, last_place_user_id",
      )
      .eq("tournament_id", tournament.id),
    supabase
      .from("group_qualification_predictions")
      .select("user_id, group_code, team_id")
      .eq("tournament_id", tournament.id),
    supabase.from("teams").select("id, display_name").eq("tournament_id", tournament.id),
  ]);

  const teamName = (id: string | null | undefined) =>
    id ? (teams?.find((t) => t.id === id)?.display_name ?? "—") : "—";

  const userName = (id: string | null | undefined) =>
    id ? (profiles?.find((u) => u.user_id === id)?.display_name ?? "—") : "—";

  const predByUser = new Map((preds ?? []).map((p) => [p.user_id, p]));
  // user_id → group_code → Set(team_id) (order is not predicted)
  const gqpByUser = new Map<string, Map<string, Set<string>>>();
  for (const row of gqp ?? []) {
    const byGroup = gqpByUser.get(row.user_id) ?? new Map<string, Set<string>>();
    const set = byGroup.get(row.group_code) ?? new Set<string>();
    set.add(row.team_id);
    byGroup.set(row.group_code, set);
    gqpByUser.set(row.user_id, byGroup);
  }

  function renderValue(userId: string) {
    const p = predByUser.get(userId);
    if (category === "campeon") return <TeamName name={teamName(p?.champion_team_id)} />;
    if (category === "subcampeon") return <TeamName name={teamName(p?.runner_up_team_id)} />;
    if (category === "pichichi") return p?.top_scorer_text || "— sin predicción —";
    if (category === "mejor_jugador") return p?.best_player_text || "— sin predicción —";
    if (category === "ultimo")
      return p?.last_place_user_id ? userName(p.last_place_user_id) : "— sin predicción —";
    return null; // "clasificados" is rendered as a grid below, not a single value
  }

  return (
    <main className="mx-auto max-w-5xl p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predicciones iniciales · vista pública</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Lo que predijo cada participante antes de empezar el torneo.
          </p>
        </div>
        <Link href="/predictions/initial" className="text-sm underline whitespace-nowrap">
          Mis predicciones
        </Link>
      </div>

      <form method="get" className="mt-6 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Categoría</span>
          <select name="cat" defaultValue={category} className={INPUT_CLS}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <NavSubmitButton className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          Ver
        </NavSubmitButton>
      </form>

      <section className="mt-6 flex flex-col gap-3">
        {(profiles ?? []).map((u) => {
          const value = renderValue(u.user_id);
          const byGroup = gqpByUser.get(u.user_id);
          return (
            <article
              key={u.user_id}
              className="rounded-md border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold">
                  {u.initials}
                </span>
                <span className="font-semibold">{u.display_name}</span>
              </div>
              {category === "clasificados" ? (
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {!byGroup || byGroup.size === 0 ? (
                    <p className="text-zinc-500">— sin predicción —</p>
                  ) : (
                    GROUP_CODES.map((g) => {
                      const ids = [...(byGroup.get(g) ?? [])];
                      return (
                        <div key={g}>
                          <span className="font-semibold">Grupo {g}: </span>
                          <span className="text-zinc-600 inline-flex flex-wrap items-center gap-1">
                            {ids.length
                              ? ids.map((id, i) => (
                                  <span key={id} className="inline-flex items-center gap-1">
                                    {i > 0 && <span className="text-zinc-400">·</span>}
                                    <TeamName name={teamName(id)} />
                                  </span>
                                ))
                              : "—"}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-700">{value}</p>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

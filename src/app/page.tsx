import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListChecks, ClipboardList, BarChart2, User, Trophy, Calendar } from "lucide-react";

const FEATURE_CARDS = [
  {
    href: "/predictions/initial",
    icon: ListChecks,
    title: "Predicciones Iniciales",
    description: "Campeón, subcampeón, pichichi, mejor jugador y clasificados de cada grupo.",
    color: "bg-primary/10 text-primary border-primary/20",
    iconBg: "bg-primary/15",
  },
  {
    href: "/predictions/matches",
    icon: ClipboardList,
    title: "Predicciones Partidos",
    description: "Predice el marcador de cada partido antes de que empiece la jornada.",
    color: "bg-success/10 text-success-fg border-success/20",
    iconBg: "bg-success/15",
  },
  {
    href: "/clasificacion",
    icon: BarChart2,
    title: "Clasificación General",
    description: "Consulta quién va por delante en la porra.",
    color: "bg-warning/10 text-warning-fg border-warning/20",
    iconBg: "bg-warning/15",
  },
  {
    href: "/my-scores",
    icon: User,
    title: "Mis Predicciones",
    description: "Tu puntuación desglosada por partidos y categorías.",
    color: "bg-info/10 text-info-fg border-info/20",
    iconBg: "bg-info/15",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Not logged in → simple welcome
  if (!claims?.sub) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-10 text-center">
        <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Trophy className="text-primary h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Porra Mundial 2026</h1>
          <p className="mt-2 text-zinc-500">App privada para gestionar la porra entre amigos.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="bg-primary rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-zinc-200 px-6 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  // Logged in → check if the user has accepted the active tournament's terms
  const { data: activeTournament } = await supabase
    .from("tournaments")
    .select("id, name")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeTournament) {
    const { data: acceptance } = await supabase
      .from("terms_acceptances")
      .select("id")
      .eq("tournament_id", activeTournament.id)
      .eq("user_id", claims.sub)
      .limit(1)
      .maybeSingle();

    if (!acceptance) {
      redirect("/rules");
    }
  }

  // Terms accepted → show the mosaic dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", claims.sub)
    .single();

  const displayName = profile?.display_name ?? "jugador";

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Hola, {displayName} <span className="wave">👋</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">¿Qué quieres hacer hoy?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURE_CARDS.map(({ href, icon: Icon, title, description, color, iconBg }) => (
          <Link
            key={href}
            href={href}
            className={`group flex gap-4 rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${color}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-70">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
        <span>
          Mundial 2026 · {activeTournament?.name ?? "En preparación"}.{" "}
          <Link href="/rules" className="underline hover:text-zinc-900">
            Ver normas
          </Link>
        </span>
      </div>
    </main>
  );
}

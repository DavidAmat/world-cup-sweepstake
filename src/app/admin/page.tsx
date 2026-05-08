import { requireAdmin } from "@/lib/permissions/requireAdmin";

export default async function AdminPage() {
  const { profile } = await requireAdmin();

  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Hola {profile.display_name}. Próximamente aquí: gestión de fixtures, jugadores, resultados,
        reglas de puntuación y reset de datos de prueba.
      </p>
    </main>
  );
}

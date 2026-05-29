import { requireAdmin } from "@/lib/permissions/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { Avatar } from "@/components/profiles/Avatar";
import { avatarUrlFor } from "@/lib/profiles/avatars";
import { formatMadridDateTimeFull } from "@/lib/dates/madridTime";
import { Users, LogIn, ShieldAlert } from "lucide-react";

const RECENT_LOGINS_LIMIT = 200;

export default async function AdminUsersPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // Profiles (display name, initials, role, scam flag).
  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, display_name, initials, role, is_scam")
    .order("display_name");

  // Emails live in auth.users — fetch them via the admin API and key by id.
  const emailById = new Map<string, string>();
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const page = data?.users ?? [];
    for (const u of page) if (u.email) emailById.set(u.id, u.email);
    if (page.length < 200) break;
  }

  // Recent logins, newest first, with the participant's display name.
  const { data: logins } = await admin
    .from("login_events")
    .select("id, logged_at, profiles(display_name)")
    .order("logged_at", { ascending: false })
    .limit(RECENT_LOGINS_LIMIT);

  const users = profiles ?? [];

  return (
    <main className="mx-auto max-w-4xl p-10">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-zinc-500" aria-hidden />
        <h1 className="text-2xl font-bold">Usuarios</h1>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Participantes registrados y registro de accesos (hora de Madrid).
      </p>

      {/* Users */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Participantes ({users.length})</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Usuario</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Rol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr key={u.user_id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar
                        displayName={u.display_name}
                        initials={u.initials}
                        avatarUrl={avatarUrlFor(u.display_name)}
                        size={32}
                      />
                      <span className="font-medium">{u.display_name}</span>
                      {u.is_scam && (
                        <ShieldAlert
                          className="h-3.5 w-3.5 text-red-500"
                          aria-label="Cuenta scam"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{emailById.get(u.user_id) ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {u.role === "admin" ? (
                      <span className="text-primary bg-primary/10 rounded-full px-2 py-0.5 text-xs font-semibold">
                        Admin
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        Jugador
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Login log */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-zinc-500" aria-hidden />
          <h2 className="text-lg font-semibold">Accesos recientes</h2>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Cada vez que un usuario inicia sesión con su email y contraseña. Últimos{" "}
          {RECENT_LOGINS_LIMIT}.
        </p>

        {logins && logins.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Usuario</th>
                  <th className="px-4 py-2 font-medium">Fecha y hora (Madrid)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logins.map((ev) => (
                  <tr key={ev.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium">{ev.profiles?.display_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-600">
                      {formatMadridDateTimeFull(ev.logged_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no hay accesos registrados.
          </p>
        )}
      </section>
    </main>
  );
}

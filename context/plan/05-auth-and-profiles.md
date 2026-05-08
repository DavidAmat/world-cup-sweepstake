# 05 — Auth + profiles + roles

> Referencia del índice: `context/plan/01-plan.md` §7 → Hito 05.
>
> Depende de: hito 04 (tablas `profiles`, `terms_acceptances`,
> helpers `is_admin`).

---

## 1. Goal

Que un humano pueda **registrarse**, **iniciar sesión**, **cerrar
sesión**, ser **promovido a admin** desde Studio, y que la
distinción admin/player se respete en la app:

- `/admin/*` solo accesible a admins.
- `/dashboard` y similares requieren sesión.
- `/`, `/login`, `/register` son públicas.

Se queda preparado el flujo de **aceptación de normas** (tabla
`terms_acceptances` ya existe) pero la activación dura del redirect
"si no has aceptado, ve a /rules" se hace en cuanto exista al menos
una `scoring_rules` versión activa (hito 11). Para hito 05 montamos
solo la página y el botón de aceptar.

---

## 2. Scope

Dentro:

- Migración `handle_new_user` que crea fila en `profiles` al
  insertarse un `auth.users`.
- Helpers `requireAuth()` y `requireAdmin()` server-only.
- Server actions de auth (`signUp`, `signIn`, `signOut`) en
  `src/lib/auth/actions.ts`.
- Páginas `/login` y `/register` con formularios en español.
- Página `/rules` con placeholder en español + botón de aceptación
  que escribe en `terms_acceptances` (idempotente por
  `unique(tournament_id, user_id, rules_version)`).
- Header con estado de auth (login/logout, nombre del usuario).
- Protección de `/dashboard` y `/admin/*`.
- Pequeño mapeador `translateAuthError` para mostrar errores de
  Supabase Auth en español.

Fuera (queda para hitos posteriores):

- Recuperación de contraseña (más adelante; admin la resetea
  desde Studio mientras tanto).
- OAuth Google / otros proveedores.
- Email confirmation (off en local y prod por simplicidad).
- Reglas de puntuación reales (hito 11).
- Forzar redirect a `/rules` si el usuario no aceptó (hito 11/14).
- Avatares / foto de perfil.

---

## 3. Decisiones cerradas para este hito

- **Sin email confirmation**: `enable_confirmations = false` en
  local (ya está) y en producción Supabase. El "ya activado por
  defecto" del dashboard puede estar a true; lo desactivamos en el
  dashboard prod si hace falta. Para 10 amigos no es relevante.
- **Sin recuperación self-service**: si alguien olvida su
  contraseña, el admin la resetea desde Supabase Studio
  (Authentication → Users → "Reset password"). Documentado en el
  README al cerrar el hito.
- **`getClaims()` en helpers** (no `getUser()` ni `getSession()`).
  Es la recomendación oficial de Supabase para proteger rutas
  server-side y no añade latencia de red.
- **Server Actions, no Route Handlers**, para los formularios de
  auth. Más limpio en App Router de Next 16.
- **Errores en español**: pequeño mapeador de los strings comunes
  de Supabase Auth (`invalid login credentials`, `user already
  registered`, etc.). Si no hay match, se muestra el mensaje
  original.
- **Promover a admin a mano**: el primer usuario que se registra
  recibe `role='player'` por defecto. Para promoverlo, ejecutas
  `update profiles set role='admin' where user_id='<uuid>'` en
  Studio (o `psql`). El plan documenta el comando exacto.
- **Trigger `handle_new_user` con `SECURITY DEFINER`**: sin esto,
  el insert en `profiles` lo intentaría hacer el usuario que se
  acaba de registrar y la RLS de profiles lo bloquearía
  (no tenemos policy de insert para `authenticated`).
- **Display name e initials**:
  - `display_name`: viene del meta data del registro
    (`raw_user_meta_data.display_name`). Fallback: parte local
    del email (`split_part(email,'@',1)`).
  - `initials`: por defecto las dos primeras letras del display
    name en mayúsculas. El usuario podrá cambiarlas en el futuro
    desde su perfil (no en este hito).

---

## 4. Migración

### 4.1 `…_handle_new_user.sql`

```sql
-- ============================================================================
-- Migration: handle_new_user trigger
-- ----------------------------------------------------------------------------
-- Whenever a row is inserted in auth.users (i.e. someone registers via
-- supabase.auth.signUp()), automatically create the matching public.profiles
-- row with role='player'. Display name comes from the signup metadata; if
-- absent, we fall back to the email prefix.
--
-- SECURITY DEFINER + search_path locked is required because the new user
-- doesn't have insert privileges on profiles (no RLS policy grants it).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  computed_display_name text;
begin
  computed_display_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (user_id, display_name, initials, role)
  values (
    new.id,
    computed_display_name,
    upper(left(computed_display_name, 2)),
    'player'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Idempotencia: si un día queremos modificar el trigger, hacemos
una nueva migración que lo recrea (`drop trigger if exists … ;
create trigger …`). Por ahora, esta es la única.

---

## 5. Estructura de ficheros nuevos

```
src/
  lib/
    permissions/
      requireAuth.ts          ← getClaims-based, server-only
      requireAdmin.ts         ← reusa requireAuth + chequea profiles.role
    auth/
      actions.ts              ← signUp, signIn, signOut server actions
      errors.ts               ← translateAuthError(string) → string
  app/
    (auth)/
      login/
        page.tsx              ← form + error display
      register/
        page.tsx              ← form + error display
    (app)/
      dashboard/
        page.tsx              ← await requireAuth() arriba
    admin/
      page.tsx                ← await requireAdmin() arriba
    rules/
      page.tsx                ← placeholder normas + botón aceptar
      actions.ts              ← acceptTerms server action
    layout.tsx                ← incluye <Header />
  components/
    layout/
      Header.tsx              ← nombre del usuario + login/logout
supabase/
  migrations/
    <timestamp>_handle_new_user.sql
```

Las páginas existentes (`/login`, `/register`, `/dashboard`,
`/admin`) se reescriben sobre los stubs actuales. La home `/`
queda casi igual pero con el header arriba.

---

## 6. Esqueletos de código

### 6.1 `src/lib/auth/errors.ts`

```ts
export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message))
    return "Email o contraseña incorrectos.";
  if (/user already registered|already been registered/i.test(message))
    return "Ya existe una cuenta con ese email.";
  if (/password should be at least/i.test(message))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (/unable to validate email address/i.test(message))
    return "El email no parece válido.";
  if (/email rate limit/i.test(message))
    return "Demasiados intentos. Espera unos minutos y vuelve a probar.";
  return message;
}
```

### 6.2 `src/lib/auth/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "./errors";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !password || !displayName) {
    redirect(`/register?error=${encodeURIComponent("Faltan campos por rellenar.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) {
    redirect(`/register?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

### 6.3 `src/lib/permissions/requireAuth.ts`

```ts
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAuth() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  return {
    userId: data.claims.sub as string,
    email: data.claims.email as string | undefined,
    supabase,
  };
}
```

### 6.4 `src/lib/permissions/requireAdmin.ts`

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireAuth } from "./requireAuth";

export async function requireAdmin() {
  const { userId, supabase } = await requireAuth();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("user_id", userId)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return { userId, supabase, profile };
}
```

### 6.5 `src/components/layout/Header.tsx` (esquema)

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export async function Header() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  let displayName: string | null = null;
  if (claims?.sub) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", claims.sub)
      .single();
    displayName = profile?.display_name ?? null;
  }

  return (
    <header className="border-b bg-white dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link href="/" className="font-bold">Porra Mundial 2026</Link>
        <nav className="flex items-center gap-4 text-sm">
          {claims ? (
            <>
              <span className="text-zinc-500">Hola, {displayName ?? "jugador"}</span>
              <Link href="/dashboard" className="hover:underline">Mi porra</Link>
              <form action={signOut}>
                <button className="hover:underline">Cerrar sesión</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">Iniciar sesión</Link>
              <Link href="/register" className="hover:underline">Crear cuenta</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
```

### 6.6 `/admin/page.tsx`

```tsx
import { requireAdmin } from "@/lib/permissions/requireAdmin";

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Hola {profile.display_name}. Próximamente aquí: gestión de fixtures,
        jugadores, resultados y reglas de puntuación.
      </p>
    </main>
  );
}
```

---

## 7. Página `/rules`

### 7.1 Contenido

Por ahora, un texto de placeholder en español que explica cómo
funcionará el sistema de puntuación a alto nivel y un botón
"Acepto las normas". No hay reglas concretas todavía — eso llega
en hito 11.

### 7.2 Acción de aceptación

```ts
// src/app/rules/actions.ts
"use server";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/permissions/requireAuth";

const PLACEHOLDER_RULES_VERSION = 0; // hito 11 lo conecta con scoring_rules.

export async function acceptTerms(formData: FormData) {
  const tournamentId = String(formData.get("tournamentId") ?? "");
  if (!tournamentId) redirect("/dashboard");

  const { userId, supabase } = await requireAuth();
  const { error } = await supabase
    .from("terms_acceptances")
    .insert({
      tournament_id: tournamentId,
      user_id: userId,
      rules_version: PLACEHOLDER_RULES_VERSION,
    });

  // Idempotente: si ya existe, ignoramos (unique constraint).
  if (error && !/duplicate key/i.test(error.message)) {
    redirect(`/rules?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}
```

> Pendiente para hito 11: reemplazar `PLACEHOLDER_RULES_VERSION` con
> la versión activa de `scoring_rules` para el torneo.

---

## 8. Verificación

Una vez todo escrito y `npm run db:reset` aplicado:

1. `npm run dev`.
2. Ir a `http://localhost:3000/register`. Crear cuenta con email +
   password + nombre. Confirmar redirect a `/dashboard`.
3. Cerrar sesión desde el header.
4. Ir a `/login`, autenticarse, confirmar redirect a `/dashboard`.
5. Ir a `/admin` → debe redirigir a `/dashboard` (no eres admin).
6. Promover a admin via psql:
   ```bash
   PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres \
     -c "update public.profiles set role='admin' where user_id=(select id from auth.users where email='<tu-email>');"
   ```
7. Refrescar `/admin` → ahora se muestra la página.
8. Verificar en Studio que la fila `profiles` se creó al registrarse
   (trigger `handle_new_user` funcionando).

---

## 9. Acceptance criteria

- [ ] Migración `handle_new_user` aplicada en local + prod.
- [ ] `/register` y `/login` funcionan; muestran errores en español.
- [ ] Tras registro, se crea fila `profiles` con `role='player'`.
- [ ] `/admin` redirige a `/dashboard` para non-admins.
- [ ] Tras promoción manual a admin via psql/Studio, `/admin`
      carga.
- [ ] Header refleja estado de auth (logueado vs no).
- [ ] `/rules` muestra placeholder + botón Aceptar; si lo pulsas
      registra una fila en `terms_acceptances` (no rompe si ya
      existe).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` pasan.
- [ ] Bitácora `05-auth-and-profiles-implementation.md` creada.

---

## 10. Riesgos / dudas

- **`getClaims()` puede fallar si las JWKS aún no están cacheadas
  al primer request**: en local no hemos visto problemas; si surge
  en producción se cae a `getUser()` con un fallback en el helper.
- **`split_part(email,'@',1)` puede dejar nombres tipo
  `j.lopez+test`**: aceptable, el usuario edita el display name
  cuando montemos perfil editable.
- **El trigger se dispara antes de que el usuario haga login**:
  ese es justo el comportamiento deseado.
- **Revocar admin**: si quieres degradar a un usuario, otro
  `update` en psql/Studio. Decisión: no UI para esto en este hito.

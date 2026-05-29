# 05 — Auth + profiles + roles · bitácora de implementación

> Hito ejecutado: ver plan en `05-auth-and-profiles-plan.md`.

## Resumen

Hito 05 completado. La app tiene auth funcional con Supabase:
registro, login, logout, header con estado, helpers
`requireAuth`/`requireAdmin`, distinción admin/player aplicada en
`/admin/*`, y página `/rules` con flujo de aceptación de normas
listo (versión placeholder `0` hasta que hito 11 conecte
`scoring_rules`).

Trigger SQL `handle_new_user` en local + producción crea fila en
`profiles` automáticamente al registrarse un usuario, con
`display_name` extraído del meta data del signup y fallback al
prefijo del email.

## Comandos / artefactos clave

```bash
# 1. Migración SQL
supabase migration new handle_new_user
# (escrito SECURITY DEFINER trigger en migrations/<ts>_handle_new_user.sql)
npm run db:reset                           # local OK
npm run db:push                            # prod OK

# 2. Smoke-test API (local)
PUBKEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
curl -X POST http://192.168.0.112:54321/auth/v1/signup \
  -H "apikey: $PUBKEY" -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass1234","data":{"display_name":"Tester"}}'
# → returns access_token + user object, email_confirmed_at filled
#   (enable_confirmations=false in supabase/config.toml, hito 03)

# 3. Verificación del trigger
PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres \
  -c "select user_id, display_name, initials, role from public.profiles;"
# → Tester / TE / player ✅

# 4. Promoción a admin
PGPASSWORD=postgres psql -h 192.168.0.112 -p 54322 -U postgres -d postgres \
  -c "update public.profiles set role='admin' where user_id=(select id from auth.users where email='test@example.com');"

# 5. Smoke-test páginas (dev server local)
for p in / /login /register /dashboard /admin /rules; do
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3000$p"
done
# /          200
# /login     200
# /register  200
# /dashboard 307 → /login
# /admin     307 → /login
# /rules     307 → /login
```

## Ficheros nuevos

```
src/lib/permissions/requireAuth.ts        getClaims-based, server-only
src/lib/permissions/requireAdmin.ts       reusa requireAuth + chequeo role
src/lib/auth/actions.ts                   signUp / signIn / signOut server actions
src/lib/auth/errors.ts                    translateAuthError(string)
src/components/layout/Header.tsx          server component con auth state
src/app/(auth)/login/page.tsx             form español
src/app/(auth)/register/page.tsx          form español + display_name
src/app/(app)/dashboard/page.tsx          protegida, saluda al usuario
src/app/admin/page.tsx                    protegida con requireAdmin
src/app/rules/page.tsx                    placeholder + aceptación
src/app/rules/actions.ts                  acceptTerms server action
supabase/migrations/20260508170251_handle_new_user.sql
```

`src/app/layout.tsx` se actualizó para incluir `<Header />` arriba.
`eslint.config.mjs` se extendió con `globalIgnores` para `.venv/`,
`data/`, `context/`, `supabase/`, `scripts/`, y el
`database.types.ts` autogenerado.

## Decisiones tomadas durante la implementación

1. **Email confirmation off**. `supabase/config.toml` ya tiene
   `enable_confirmations = false` (hito 03). En el dashboard de
   producción habrá que verificar / desactivar manualmente si
   estuviera activo. Nota: el smoke-test contra el local devolvió
   `email_confirmed_at` ya rellenado, lo que confirma el setting.

2. **`getClaims()` en lugar de `getUser()` o `getSession()`**.
   Recomendado por Supabase: valida el JWT localmente con la
   cached JWKS, sin roundtrip de red. `requireAuth` y `Header` lo
   usan; `requireAdmin` añade un `select role from profiles`.

3. **Trigger con `SECURITY DEFINER`**. Sin esto, el insert en
   `profiles` lo intentaría hacer el rol del nuevo usuario y la
   RLS lo bloquearía (no hay policy de insert para players —
   admins-only). `set search_path = public` para evitar inyección.

4. **`display_name` por defecto desde el meta data del signup**, con
   fallback a `split_part(email,'@',1)`. `initials = upper(left
   (display_name, 2))`. Aceptable para hito 05; un perfil
   editable llegará en otro hito si hace falta.

5. **`PLACEHOLDER_RULES_VERSION = 0`** en `acceptTerms`. Permite
   que el flujo funcione antes de tener `scoring_rules` real
   (hito 11). Cuando llegue hito 11 cambiamos esa constante por la
   versión activa del torneo y todo encaja.

6. **`/rules` no es de aceptación obligatoria todavía**. La página
   informa pero no se redirige a ella desde `/dashboard` si no
   has aceptado. Esto se activa en hito 11/14 cuando haya algo
   real que aceptar.

7. **Header como Server Component asíncrono** que consulta auth
   state y profile. Se renderiza en cada request porque el body
   depende de cookies — Next 16 marca todas las rutas como
   dinámicas (`ƒ`) en el build, esperado.

8. **Sin recovery de password self-service**. Si un usuario
   olvida su contraseña, el admin la resetea desde Supabase
   Studio (Authentication → Users → "Send reset link" o cambia
   manualmente). Decisión consciente para mantener el alcance
   acotado.

9. **Promoción a admin manual via psql/Studio**. No hay UI para
   esto. Comando documentado en este log.

10. **ESLint ignora `.venv/`**. Tu pipeline Python paralelo
    (pyproject.toml + uv) trae libs JS/TS dentro de `.venv/lib/`
    que ESLint estaba leyendo (1063 errores). `globalIgnores`
    extendido en `eslint.config.mjs`.

## Verificaciones realizadas

| Verificación                                            | Resultado |
|---------------------------------------------------------|-----------|
| `supabase db reset` aplica las 6 migraciones             | ✅ |
| `npm run typecheck`                                      | ✅ |
| `npm run lint` (tras ignores)                            | ✅ |
| `npm run build` — 7 rutas (home + auth + protected)       | ✅ |
| `POST /auth/v1/signup` crea user + dispara trigger        | ✅ |
| `profiles` tiene fila con `Tester / TE / player`          | ✅ |
| `update profiles set role='admin' …` funciona            | ✅ |
| Páginas públicas → 200 con texto en español               | ✅ |
| Páginas protegidas → 307 a `/login`                       | ✅ |
| Header muestra "Iniciar sesión / Crear cuenta" en anon    | ✅ |
| `npm run db:push` aplica migración a prod                 | ✅ |

## Errores y resoluciones

- **Lint a `.venv/jupyterlab/browser-test.js`**: ESLint flat
  config no respeta `.gitignore` por defecto. Resuelto con
  `globalIgnores`.

- **`curl 127.0.0.1:54321` rechazado**: Supabase CLI bindea al
  IP de LAN (`192.168.0.112`). Mismo issue que en hito 04, ya
  documentado.

## Acceptance criteria del hito

- [x] Migración `handle_new_user` aplicada en local + prod.
- [x] `/register` y `/login` funcionales; errores en español vía
      `translateAuthError`.
- [x] Tras registro, fila `profiles` se crea con `role='player'`.
- [x] `/admin` redirige a `/dashboard` para non-admins (vía
      `requireAdmin`).
- [x] Promoción manual a admin via psql funciona.
- [x] Header refleja estado de auth.
- [x] `/rules` muestra placeholder + flujo de aceptación
      (idempotente vía unique constraint).
- [x] Typecheck, lint, build pasan.
- [x] Bitácora `05-auth-and-profiles-implementation.md` creada.

## Estado tras el hito

- **Local:** 6 migraciones aplicadas, trigger activo, 1 usuario
  de prueba (Tester, admin) en la DB. La app sirve toda la
  navegación auth-aware.
- **Producción:** mismas 6 migraciones aplicadas, sin usuarios
  todavía. La app de Vercel ya tiene los 4 env vars cargados, así
  que en cuanto tengas un usuario registrado deberías poder
  loguearte allí también.

## Cómo administrar usuarios desde Supabase Studio

- **Reset password de un usuario**: Studio → Authentication →
  Users → seleccionar usuario → "Send recovery link" (envía email
  de reset) o cambiar contraseña directamente desde el panel.
- **Promover a admin**:
  ```sql
  update public.profiles set role='admin'
   where user_id = (select id from auth.users where email = '<email>');
  ```
- **Degradar a player**: misma query con `role='player'`.

## Próximo hito

Hito 06 — Seeds e importación de master data.

- Definir el formato JSON de seeds (Catar 2022 primero) y
  schemas Zod.
- Script `scripts/seed/wc-2022.ts` que inserta tournament,
  teams, players, stages, rounds y fixtures usando el admin
  client.
- El JSON viene de tu pipeline Python (`data/raw/*.json` →
  `data/seeds/wc_2022/*.json` después de la normalización que
  estás trabajando).
- Pasos manuales mínimos: ejecutar `npm run seed:wc2022` una
  vez, verificar conteos, y dejarlo listo para que en hito 09
  (predicciones) podamos empezar a meter apuestas reales.

import { signUp } from "@/lib/auth/actions";

type SearchParams = Promise<{ error?: string }>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md p-10">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Solo necesitas un email y una contraseña. Tu nombre se mostrará al resto de jugadores en la
        clasificación.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={signUp} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            type="text"
            name="displayName"
            autoComplete="name"
            required
            maxLength={40}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
          <span className="text-xs text-zinc-500">Mínimo 8 caracteres.</span>
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Crear cuenta
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿Ya tienes cuenta?{" "}
        <a href="/login" className="underline">
          Inicia sesión
        </a>
        .
      </p>
    </main>
  );
}

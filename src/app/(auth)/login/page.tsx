import { signIn } from "@/lib/auth/actions";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md p-10">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Introduce tu email y contraseña para acceder a la porra.
      </p>

      {error && <ErrorBanner message={error} className="mt-4" />}

      <form action={signIn} className="mt-6 flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          Entrar
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        ¿Problemas para acceder? Pide tus credenciales al administrador.
      </p>
    </main>
  );
}

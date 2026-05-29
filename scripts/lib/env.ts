import { fatal, info, step, warn } from "./log";

const LOCAL_HOSTS = ["127.0.0.1", "localhost", "192.168.0.112"];

// Supabase CLI binds the local API to the host's LAN IP, not 127.0.0.1.
// `.env.local` keeps `127.0.0.1` because Next.js can resolve it from
// inside its own server runtime, but a plain Node fetch (tsx) cannot.
// We rewrite the URL transparently for scripts.
const LOCAL_LAN_HOST = "192.168.0.112";

export type Target = {
  url: string;
  isLocal: boolean;
  hasConfirmFlag: boolean;
};

export function detectTarget(): Target {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) fatal("NEXT_PUBLIC_SUPABASE_URL is not set");
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fatal(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${rawUrl}`);
  }

  let url = rawUrl;
  if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
    parsed.hostname = LOCAL_LAN_HOST;
    url = parsed.toString().replace(/\/$/, "");
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  }

  const isLocal = LOCAL_HOSTS.includes(parsed.hostname);
  const hasConfirmFlag = process.argv.includes("--confirm-prod");
  return { url, isLocal, hasConfirmFlag };
}

export function assertSafeTarget(target: Target, opts: { writes: boolean }): void {
  step("Target");
  info("URL", target.url);
  info("Local", String(target.isLocal));
  if (opts.writes && !target.isLocal && !target.hasConfirmFlag) {
    fatal(
      "Refusing to write to a non-local Supabase URL without --confirm-prod.\n" +
        "  Re-run with the flag if you intend to apply changes to production.",
    );
  }
  if (opts.writes && !target.isLocal) {
    warn("Target is NON-LOCAL. Writes will hit production.");
  }
}

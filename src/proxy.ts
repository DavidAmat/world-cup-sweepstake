import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Until Supabase env vars are wired (e.g. Vercel preview without them),
  // skip the session refresh instead of crashing every request.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh tokens via getClaims() (preferred over getSession() server-side).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  // Gate /admin here (before render) instead of via redirect() inside the
  // page. redirect() in a streaming Server Component emits a client-side
  // redirect that mis-resolves nested paths (/admin/fixtures → wrongly
  // /dashboard/fixtures). A Proxy redirect is a clean server 307.
  const pathname = new URL(request.url).pathname;

  // Forced password change: a logged-in user with a temporary password is
  // redirected to /cambiar-password on every navigation until they set a new
  // one. Only gate GET navigations so server-action POSTs (e.g. sign-out) and
  // the change-password form submit are never intercepted. Auth pages and the
  // change-password page itself are exempt.
  const PWD_EXEMPT = ["/cambiar-password", "/login", "/register"];
  if (
    claims?.sub &&
    request.method === "GET" &&
    !PWD_EXEMPT.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const { data: gateProfile } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("user_id", claims.sub)
      .single();
    if (gateProfile?.must_change_password) {
      return NextResponse.redirect(new URL("/cambiar-password", request.url));
    }
  }

  // Gate /admin here (before render) instead of via redirect() inside the
  // page. redirect() in a streaming Server Component emits a client-side
  // redirect that mis-resolves nested paths (/admin/fixtures → wrongly
  // /dashboard/fixtures). A Proxy redirect is a clean server 307.
  if (pathname.startsWith("/admin")) {
    if (!claims?.sub) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", claims.sub)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

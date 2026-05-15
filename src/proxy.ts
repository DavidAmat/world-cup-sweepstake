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
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

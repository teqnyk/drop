import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refresh the Supabase session and gate /dashboard.
 *
 * **This file stays middleware.ts despite Next 16's deprecation warning, and
 * must not be renamed to proxy.ts.** Next 16.0 made proxy.ts default to the
 * Node.js runtime, and the runtime config option is explicitly unavailable in
 * proxy files — "Setting the runtime config option in Proxy will throw an
 * error". OpenNext's Cloudflare build then refuses the whole worker with
 * "Node.js middleware is not currently supported", so the app cannot deploy at
 * all. middleware.ts still defaults to the edge runtime, which is what Workers
 * needs.
 *
 * A deprecation warning in the dev log is the cost. A build that cannot deploy
 * is the alternative. Revisit when OpenNext supports Node middleware.
 *
 * The middleware is the only place that can write refreshed auth cookies, so
 * it runs on the dashboard routes even when it does not redirect.
 *
 * It answers "is there a session", not "is this the creator" — the allowlist
 * lives in lib/auth.ts and is enforced by the page and by every server action.
 * Two checks, because a redirect is a courtesy and the action-level check is
 * the actual boundary.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const allowlist = process.env.DROP_CREATOR_EMAILS?.trim();

  // Unconfigured: let the page decide. In development it explains itself; in
  // production it refuses. Redirecting to a sign-in page that cannot work
  // would just be a loop.
  if (!url || !key || !allowlist) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/signin";
    signIn.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/signin"],
};

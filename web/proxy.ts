import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, authEnabled } from "@/lib/supabase/config";

// pages that need a signed-in student
const PRIVATE = ["/learn", "/room"];

export async function proxy(request: NextRequest) {
  if (!authEnabled) return NextResponse.next();

  // keep the google session fresh on every request
  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  if (!data?.claims && PRIVATE.some((p) => path === p || path.startsWith(`${p}/`))) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }
  return response;
}

export const config = {
  // everything except next's own files and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav)$).*)"],
};

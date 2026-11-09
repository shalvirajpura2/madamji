import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

// for route handlers: reads and refreshes the sign-in cookies
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // called from a place that can't set cookies; the proxy refreshes them instead
        }
      },
    },
  });
}

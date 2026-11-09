import { NextResponse } from "next/server";
import { log } from "@/lib/activity";
import { LIMITS } from "@/lib/limits";
import { clientIp, limit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

// google sends the student back here; swap the one-time code for a session cookie
export async function GET(req: Request) {
  const url = new URL(req.url);
  const home = new URL("/", url.origin);
  const ip = clientIp(req);

  const blocked = await limit("signin_ip", ip, LIMITS.signInIp, { ip });
  if (blocked) {
    home.searchParams.set("signin", "failed");
    return NextResponse.redirect(home);
  }

  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      log({ kind: "signed_in", studentId: data.user?.id ?? "", email: data.user?.email ?? "", ip });
      return NextResponse.redirect(home);
    }
    console.error("google sign-in failed", error.message);
  }
  home.searchParams.set("signin", "failed");
  return NextResponse.redirect(home);
}

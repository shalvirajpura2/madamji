import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// google sends the student back here; swap the one-time code for a session cookie
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const home = new URL("/", url.origin);

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(home);
    console.error("google sign-in failed", error.message);
  }
  home.searchParams.set("signin", "failed");
  return NextResponse.redirect(home);
}

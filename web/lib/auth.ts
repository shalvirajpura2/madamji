import { NextResponse } from "next/server";
import { authEnabled } from "./supabase/config";
import { supabaseServer } from "./supabase/server";

export type SignedIn = { id: string; email: string; name: string };

/** The signed-in google user, verified on the server. Never trust a student id the browser sends. */
export async function currentUser(): Promise<SignedIn | null> {
  if (!authEnabled) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    name: String(meta.given_name ?? meta.full_name ?? meta.name ?? "").trim(),
  };
}

/**
 * The student id a request may act as. With sign-in set up it is always the google user's id.
 * Without it (local dev only) the id the browser sent is used, like before.
 */
export async function studentIdFor(sentId: unknown): Promise<{ id: string; email: string } | { error: NextResponse }> {
  if (authEnabled) {
    const user = await currentUser();
    if (!user) return { error: NextResponse.json({ error: "Please sign in with Google first." }, { status: 401 }) };
    return { id: user.id, email: user.email };
  }
  if (process.env.NODE_ENV === "production") {
    return { error: NextResponse.json({ error: "Sign-in is not set up yet." }, { status: 503 }) };
  }
  const id = String(sentId ?? "").slice(0, 64);
  if (!id) return { error: NextResponse.json({ error: "Tell us your name first." }, { status: 400 }) };
  return { id, email: "" };
}

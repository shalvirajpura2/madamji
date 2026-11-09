import { connection, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { store } from "@/lib/store";
import { authEnabled } from "@/lib/supabase/config";

// who is signed in, and their saved student profile if they have one
export async function GET() {
  await connection(); // per visitor, never prerendered
  const headers = { "Cache-Control": "no-store" };
  if (!authEnabled) return NextResponse.json({ auth: false }, { headers });
  const user = await currentUser();
  if (!user) return NextResponse.json({ auth: true, user: null }, { headers });
  let profile = null;
  try {
    const s = await store.getStudent(user.id);
    if (s) profile = { id: s.id, name: s.name, grade: s.grade };
  } catch (e) {
    console.error("could not load student", e);
  }
  return NextResponse.json({ auth: true, user, profile }, { headers });
}

import { connection, NextResponse } from "next/server";
import { currentUser, studentIdFor } from "@/lib/auth";
import { LIMITS, TRIAL } from "@/lib/limits";
import { clientIp, limit } from "@/lib/rate-limit";
import { store, trialUsage, type Trial } from "@/lib/store";
import { authEnabled } from "@/lib/supabase/config";

async function trialFor(studentId: string): Promise<Trial | null> {
  try {
    const used = trialUsage(await store.listClassesFor(studentId));
    return { long: { used: used.long, max: TRIAL.long }, short: { used: used.short, max: TRIAL.short } };
  } catch (e) {
    console.error("could not load trial usage", e);
    return null;
  }
}

// who is signed in, their saved student profile, and how much of the free trial is left
export async function GET(req: Request) {
  await connection(); // per visitor, never prerendered
  const headers = { "Cache-Control": "no-store" };
  const ip = clientIp(req);
  const blocked = await limit("read_ip", ip, LIMITS.readIp, { ip });
  if (blocked) return blocked;

  if (!authEnabled) {
    // local dev: the browser says who it is
    const id = new URL(req.url).searchParams.get("id");
    const who = id ? await studentIdFor(id) : null;
    const trial = who && "id" in who ? await trialFor(who.id) : null;
    return NextResponse.json({ auth: false, trial }, { headers });
  }

  const user = await currentUser();
  if (!user) return NextResponse.json({ auth: true, user: null }, { headers });
  let profile = null;
  try {
    const s = await store.getStudent(user.id);
    if (s) profile = { id: s.id, name: s.name, grade: s.grade };
  } catch (e) {
    console.error("could not load student", e);
  }
  return NextResponse.json({ auth: true, user, profile, trial: await trialFor(user.id) }, { headers });
}

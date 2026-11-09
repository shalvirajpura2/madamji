import { NextResponse } from "next/server";
import { CLASSES_PER_IP_PER_DAY, TRIAL } from "@/lib/limits";
import { checkStaff } from "@/lib/staff";
import { store } from "@/lib/store";

// staff only: every class started (with who, where from and how it ended), and the activity log
export async function POST(req: Request) {
  const { passcode, view } = await req.json().catch(() => ({}));
  const denied = await checkStaff(req, passcode);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store" };
  try {
    if (view === "activity") return NextResponse.json({ activity: await store.listActivity(300) }, { headers });
    return NextResponse.json(
      { classes: await store.listClasses(300), limits: { trial: TRIAL, ipPerDay: CLASSES_PER_IP_PER_DAY } },
      { headers },
    );
  } catch (e) {
    console.error("could not load staff data", e);
    return NextResponse.json({ error: "This is unavailable right now. Did you run supabase/schema.sql?" }, { status: 503 });
  }
}

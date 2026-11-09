import { NextResponse } from "next/server";
import { studentIdFor } from "@/lib/auth";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const { studentId } = await req.json().catch(() => ({}));
  const who = await studentIdFor(studentId);
  if ("error" in who) return NextResponse.json({ progress: [] }, { status: who.error.status });
  try {
    const progress = await store.listProgress(who.id);
    return NextResponse.json({ progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("could not load progress", e);
    return NextResponse.json({ progress: [], offline: true });
  }
}

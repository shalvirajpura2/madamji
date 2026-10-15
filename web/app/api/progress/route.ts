import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const { studentId } = await req.json().catch(() => ({}));
  if (!studentId) return NextResponse.json({ progress: [] });
  try {
    const progress = await store.listProgress(String(studentId));
    return NextResponse.json({ progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("could not load progress", e);
    return NextResponse.json({ progress: [], offline: true });
  }
}

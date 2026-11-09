import { NextResponse } from "next/server";
import { checkStaff } from "@/lib/staff";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({}));
  const denied = await checkStaff(req, passcode);
  if (denied) return denied;
  try {
    return NextResponse.json({ alerts: await store.listAlerts(100) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("could not load alerts", e);
    return NextResponse.json({ error: "Alerts are unavailable right now" }, { status: 503 });
  }
}

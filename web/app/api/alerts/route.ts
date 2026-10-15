import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const { passcode } = await req.json().catch(() => ({}));
  const expected = process.env.STAFF_PASSCODE;
  if (!expected || passcode !== expected) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  try {
    return NextResponse.json({ alerts: await store.listAlerts(100) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("could not load alerts", e);
    return NextResponse.json({ error: "Alerts are unavailable right now" }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { checkStaff } from "@/lib/staff";
import { store } from "@/lib/store";

// staff only: list recent classes, or one class transcript by id
export async function POST(req: Request) {
  const { passcode, id } = await req.json().catch(() => ({}));
  const denied = await checkStaff(req, passcode);
  if (denied) return denied;
  try {
    if (id) {
      const transcript = await store.getTranscript(String(id));
      if (!transcript) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ transcript }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ classes: await store.listTranscripts(50) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("could not load transcripts", e);
    return NextResponse.json({ error: "Transcripts are unavailable right now" }, { status: 503 });
  }
}

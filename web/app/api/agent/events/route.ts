import { NextResponse } from "next/server";
import { store } from "@/lib/store";

// the voice agent reports here: progress, remembered facts and safety alerts

export async function POST(req: Request) {
  const secret = process.env.AGENT_SECRET;
  if (!secret || req.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const e = await req.json().catch(() => null);
  if (!e?.type) return NextResponse.json({ error: "bad event" }, { status: 400 });

  try {
    if (e.type === "progress") {
      await store.saveProgress({
        studentId: e.studentId,
        chapterId: e.chapterId,
        sectionsDone: Number(e.sectionsDone) || 0,
        sections: Number(e.sections) || 0,
        completed: Boolean(e.completed),
        correct: Number(e.correct) || 0,
        attempted: Number(e.attempted) || 0,
        recap: String(e.recap ?? "").slice(0, 1000),
      });
    } else if (e.type === "fact") {
      await store.addFact(e.studentId, String(e.fact ?? ""));
    } else if (e.type === "alert") {
      console.warn(`\u0007🚨 SAFETY ALERT [${e.severity}] ${e.category}: ${e.summary} (student ${e.studentName})`);
      await store.addAlert({
        studentId: e.studentId ?? "",
        studentName: e.studentName ?? "",
        chapterId: e.chapterId ?? "",
        severity: e.severity === "high" ? "high" : "medium",
        category: String(e.category ?? ""),
        summary: String(e.summary ?? ""),
        quote: String(e.quote ?? ""),
        source: String(e.source ?? "teacher"),
      });
    } else {
      return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }
  } catch (err) {
    console.error(`could not store ${e.type} event`, err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

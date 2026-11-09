import { NextResponse } from "next/server";
import { log } from "@/lib/activity";
import { studentIdFor } from "@/lib/auth";
import { LIMITS } from "@/lib/limits";
import { clientIp, limit } from "@/lib/rate-limit";
import { store } from "@/lib/store";

// creates the student profile. the name is set once and can't be changed afterwards; the class can.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const blocked = await limit("profile_ip", ip, LIMITS.profileIp, { ip });
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const who = await studentIdFor(body.id);
  if ("error" in who) return who.error;
  const grade = Number(body.grade);
  if (![6, 10].includes(grade)) return NextResponse.json({ error: "Pick your class." }, { status: 400 });

  try {
    const existing = await store.getStudent(who.id);
    const name = existing?.name ?? String(body.name ?? "").trim().slice(0, 40);
    if (!name) return NextResponse.json({ error: "Tell us your name." }, { status: 400 });
    await store.saveStudent({ id: who.id, name, grade, email: who.email });
    if (!existing) log({ kind: "profile_created", studentId: who.id, email: who.email, ip, detail: { name, grade } });
    return NextResponse.json({ ok: true, profile: { id: who.id, name, grade } });
  } catch (e) {
    console.error("could not save student", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

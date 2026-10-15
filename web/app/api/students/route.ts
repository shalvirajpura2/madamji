import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").slice(0, 64);
  const name = String(body.name ?? "").trim().slice(0, 40);
  const grade = Number(body.grade);
  if (!id || !name || ![6, 10].includes(grade)) {
    return NextResponse.json({ error: "Name and class are needed." }, { status: 400 });
  }
  try {
    await store.saveStudent({ id, name, grade });
  } catch (e) {
    console.error("could not save student", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

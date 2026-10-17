import { NextResponse } from "next/server";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { chapterById } from "@/lib/content";
import { allow, clientKey } from "@/lib/rate-limit";
import { store } from "@/lib/store";

const CLASSES_PER_HOUR = Number(process.env.CLASSES_PER_HOUR || 10);

const AGENT_NAME = process.env.AGENT_NAME || "ustaad-teacher";

type Body = {
  room_config?: { agents?: { agent_name?: string; metadata?: string }[] };
};

type ClassRequest = { student?: { id?: string; name?: string; grade?: number }; chapterId?: string; minutes?: number };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return bad("The classroom is not set up yet (missing LiveKit keys).", 503);
  }

  if (!allow(clientKey(req), CLASSES_PER_HOUR, 60 * 60 * 1000)) {
    return bad("You have started a lot of classes in the last hour. Please take a short break and try again later.", 429);
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  let request: ClassRequest = {};
  try {
    request = JSON.parse(body.room_config?.agents?.[0]?.metadata || "{}");
  } catch {
    return bad("Bad class request.");
  }

  const chapter = chapterById(request.chapterId ?? "");
  const id = String(request.student?.id ?? "").slice(0, 64);
  const name = String(request.student?.name ?? "").trim().slice(0, 40);
  const grade = Number(request.student?.grade);
  if (!chapter || !id || !name || ![6, 10].includes(grade)) return bad("Pick a chapter and tell us your name first.");

  // memory is optional: a store hiccup should never keep a child out of class
  let facts: string[] = [];
  let progress = null;
  try {
    await store.saveStudent({ id, name, grade });
    facts = (await store.getStudent(id))?.facts ?? [];
    progress = (await store.listProgress(id)).find((p) => p.chapterId === chapter.id) ?? null;
  } catch (e) {
    console.error("store unavailable, starting class without memory", e);
  }

  const minutes = Number(request.minutes) >= 25 ? 25 : 15;
  const metadata = JSON.stringify({
    chapterId: chapter.id,
    minutes,
    student: { id, name, grade, facts },
    progress: progress && {
      sectionsDone: progress.sectionsDone,
      completed: progress.completed,
      recap: progress.recap,
    },
  });

  const roomName = `class-${chapter.id}-${crypto.randomUUID().slice(0, 8)}`;
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: `student-${id}`, name, ttl: "45m" });
  token.addGrant({ room: roomName, roomJoin: true, canPublish: true, canPublishData: true, canSubscribe: true });
  token.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: AGENT_NAME, metadata })],
  });

  return NextResponse.json(
    { serverUrl: LIVEKIT_URL, roomName, participantName: name, participantToken: await token.toJwt() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

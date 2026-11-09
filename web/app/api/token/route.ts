import { NextResponse } from "next/server";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import { log } from "@/lib/activity";
import { studentIdFor } from "@/lib/auth";
import { chapterById } from "@/lib/content";
import { CLASSES_PER_IP_PER_DAY, LIMITS, TRIAL } from "@/lib/limits";
import { clientIp, limit } from "@/lib/rate-limit";
import { store, trialUsage } from "@/lib/store";

const AGENT_NAME = process.env.AGENT_NAME || "ustaad-teacher";

type Body = {
  room_config?: { agents?: { agent_name?: string; metadata?: string }[] };
};

type ClassRequest = { student?: { id?: string; name?: string; grade?: number }; chapterId?: string; minutes?: number };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const TRIAL_USED: Record<number, string> = {
  25: "You've used your free 25-minute class. You still have a 15-minute class left.",
  15: "You've used your free 15-minute classes. You still have a 25-minute class left.",
};

export async function POST(req: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return bad("The classroom is not set up yet (missing LiveKit keys).", 503);
  }

  const ip = clientIp(req);
  const tooMany = "You have started a lot of classes in the last hour. Please take a short break and try again later.";
  const ipBlocked = await limit("class_ip", ip, LIMITS.classIp, { ip }, tooMany);
  if (ipBlocked) return ipBlocked;

  const body = (await req.json().catch(() => ({}))) as Body;
  let request: ClassRequest = {};
  try {
    request = JSON.parse(body.room_config?.agents?.[0]?.metadata || "{}");
  } catch {
    return bad("Bad class request.");
  }

  const who = await studentIdFor(request.student?.id);
  if ("error" in who) return who.error;
  const id = who.id;

  const userBlocked = await limit("class_user", id, LIMITS.classUser, { ip, studentId: id, email: who.email }, tooMany);
  if (userBlocked) return userBlocked;

  const chapter = chapterById(request.chapterId ?? "");
  const grade = Number(request.student?.grade);
  if (!chapter || ![6, 10].includes(grade)) return bad("Pick a chapter first.");

  // the saved profile is the source of truth for the name; the browser can't rename a student
  let saved = null;
  try {
    saved = await store.getStudent(id);
  } catch (e) {
    console.error("could not load student", e);
    return bad("The classroom is busy right now. Please try again in a minute.", 503);
  }
  const name = saved?.name ?? String(request.student?.name ?? "").trim().slice(0, 40);
  if (!name) return bad("Tell us your name first.");
  if (!saved) {
    await store.saveStudent({ id, name, grade, email: who.email }).catch((e) => console.error("could not save student", e));
  }

  const minutes = Number(request.minutes) >= 25 ? 25 : 15;
  const roomName = `class-${chapter.id}-${crypto.randomUUID().slice(0, 8)}`;

  // every class spends credits, so if we can't check the trial we don't start one
  let claim;
  try {
    claim = await store.claimClass(
      {
        id: roomName,
        studentId: id,
        studentName: name,
        email: who.email,
        ip,
        userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
        chapterId: chapter.id,
        minutes,
      },
      { long: TRIAL.long, short: TRIAL.short, ipPerDay: CLASSES_PER_IP_PER_DAY },
    );
  } catch (e) {
    console.error("could not claim a class", e);
    return bad("The classroom is busy right now. Please try again in a minute.", 503);
  }

  if (claim === "trial_used" || claim === "ip_limit") {
    log({ kind: "class_blocked", studentId: id, email: who.email, ip, detail: { reason: claim, minutes, chapterId: chapter.id } });
    if (claim === "ip_limit") {
      return bad("Too many free classes have been started from your network today. Please try again tomorrow.", 429);
    }
    const used = await store.listClassesFor(id).then(trialUsage).catch(() => null);
    const otherLeft = used && (minutes >= 25 ? used.short < TRIAL.short : used.long < TRIAL.long);
    const message = otherLeft ? TRIAL_USED[minutes] : "You've used all your free classes. More classes are coming soon!";
    return NextResponse.json({ error: message, trialUsed: true }, { status: 403 });
  }
  log({
    kind: claim === "rejoin" ? "class_rejoined" : "class_started",
    studentId: id,
    email: who.email,
    ip,
    detail: { classId: roomName, chapterId: chapter.id, minutes },
  });

  // memory is optional: a store hiccup should never keep a child out of class
  let facts: string[] = saved?.facts ?? [];
  let progress = null;
  try {
    progress = (await store.listProgress(id)).find((p) => p.chapterId === chapter.id) ?? null;
  } catch (e) {
    console.error("store unavailable, starting class without memory", e);
    facts = [];
  }

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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConnectionState, TokenSource } from "livekit-client";
import { RoomAudioRenderer, SessionProvider, useSession } from "@livekit/components-react";
import { Logo } from "@/components/logo";
import { Teacher } from "@/components/teacher";
import type { Chapter } from "@/lib/content";
import { useStudent } from "@/lib/student";
import { LiveClassroom } from "./live-classroom";
import { Tour, tourSeen } from "./tour";

const AGENT_NAME = process.env.NEXT_PUBLIC_AGENT_NAME || "ustaad-teacher";

type MicCheck = "unknown" | "checking" | "ok" | "blocked" | "missing";

type ClassLength = 15 | 25;
const LENGTHS: { minutes: ClassLength; note: string }[] = [
  { minutes: 15, note: "A quick class: a part or two" },
  { minutes: 25, note: "A full class: most of the chapter" },
];
const LENGTH_KEY = "madamji.minutes";

function readLength(): ClassLength {
  try {
    return localStorage.getItem(LENGTH_KEY) === "25" ? 25 : 15;
  } catch {
    return 15;
  }
}

function saveLength(minutes: ClassLength) {
  try {
    localStorage.setItem(LENGTH_KEY, String(minutes));
  } catch {}
}

export function StudyRoom({ chapter, nextChapter }: { chapter: Chapter; nextChapter: { id: string; title: string } | null }) {
  const student = useStudent();
  const router = useRouter();

  useEffect(() => {
    if (student === null) router.replace("/");
  }, [student, router]);

  if (!student) return <p className="m-auto text-ink-soft">Opening the classroom…</p>;
  return <Session chapter={chapter} nextChapter={nextChapter} student={student} />;
}

function Session({
  chapter,
  nextChapter,
  student,
}: {
  chapter: Chapter;
  nextChapter: { id: string; title: string } | null;
  student: { id: string; name: string; grade: number };
}) {
  const tokenSource = useMemo(() => TokenSource.endpoint("/api/token"), []);
  const [minutes, setMinutes] = useState<ClassLength>(readLength);
  const session = useSession(tokenSource, {
    agentName: AGENT_NAME,
    agentMetadata: JSON.stringify({ student, chapterId: chapter.id, minutes }),
    agentConnectTimeoutMilliseconds: 25_000,
  });
  const [mic, setMic] = useState<MicCheck>("unknown");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [touring, setTouring] = useState(() => !tourSeen());
  const router = useRouter();

  async function checkMic(): Promise<MicCheck> {
    setMic("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMic("ok");
      return "ok";
    } catch (e) {
      const name = (e as DOMException).name;
      const result = name === "NotFoundError" || name === "OverconstrainedError" ? "missing" : "blocked";
      setMic(result);
      return result;
    }
  }

  async function enter(withMic: boolean) {
    setJoinError(null);
    setJoining(true);
    try {
      const micState = withMic ? await checkMic() : mic;
      const useMic = withMic && micState === "ok";
      if (withMic && !useMic) return;
      await session.start({
        tracks: {
          microphone: {
            enabled: useMic,
            publishOptions: { preConnectBuffer: true },
          },
        },
      });
      setJoined(true);
    } catch (e) {
      console.error(e);
      const reason = /"error":"([^"]+)"/.exec(String((e as Error).message))?.[1];
      setJoinError(reason ?? "We couldn't open the classroom. Check your internet and try again.");
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    setLeaving(true);
    await session.end().catch(() => {});
    router.push("/learn");
  }

  useEffect(() => {
    return () => {
      session.end().catch(() => {});
    };
    // end the class when the student navigates away
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dropped = joined && !leaving && session.connectionState === ConnectionState.Disconnected;

  if (leaving) return <p className="m-auto text-ink-soft">See you soon! 👋</p>;

  if (!joined || dropped) {
    if (touring) return <Tour chapter={chapter} onClose={() => setTouring(false)} />;
    return (
      <Lobby
        onTour={() => setTouring(true)}
        chapter={chapter}
        studentName={student.name}
        mic={mic}
        joining={joining || session.connectionState === "connecting"}
        error={dropped ? "The class got disconnected. Your progress is saved, tap below to rejoin." : joinError}
        rejoin={dropped}
        onEnter={() => enter(true)}
        onEnterWithoutMic={() => enter(false)}
        minutes={minutes}
        onMinutes={(m) => {
          setMinutes(m);
          saveLength(m);
        }}
      />
    );
  }

  return (
    <SessionProvider session={session}>
      <LiveClassroom chapter={chapter} nextChapter={nextChapter} onLeave={leave} />
      <RoomAudioRenderer />
    </SessionProvider>
  );
}

function Lobby(p: {
  chapter: Chapter;
  studentName: string;
  mic: MicCheck;
  joining: boolean;
  error: string | null;
  rejoin: boolean;
  onEnter: () => void;
  onEnterWithoutMic: () => void;
  minutes: ClassLength;
  onMinutes: (minutes: ClassLength) => void;
  onTour: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 sm:py-10">
      <div className="self-start">
        <Logo />
      </div>
      <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-end">
        <Teacher pose="idle" mood="happy" wave className="h-56 w-44 shrink-0 animate-float" />
        <div className="paper-card w-full flex-1 rounded-3xl p-6 sm:p-8 animate-rise">
          <p className="text-sm font-semibold text-ink-soft">
            Class {p.chapter.grade} · {p.chapter.book}
          </p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{p.chapter.title}</h1>
          <p className="mt-1 text-lg text-ink-soft">
            Meera Ma&apos;am is ready for you, {p.studentName}. She will teach, ask you questions and answer your doubts.
          </p>

          <fieldset className="mt-5">
            <legend className="mb-2 font-bold">How long is today&apos;s class?</legend>
            <div className="grid grid-cols-2 gap-3">
              {LENGTHS.map((l) => (
                <button
                  key={l.minutes}
                  type="button"
                  aria-pressed={p.minutes === l.minutes}
                  onClick={() => p.onMinutes(l.minutes)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left transition ${
                    p.minutes === l.minutes ? "border-leaf bg-leaf/10" : "border-line bg-white hover:border-marigold"
                  }`}
                >
                  <span className="block text-xl font-extrabold">⏱ {l.minutes} min</span>
                  <span className="text-sm text-ink-soft">{l.note}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <ul className="mt-5 grid gap-2 text-[15px] font-medium sm:grid-cols-3">
            <li className="rounded-2xl bg-paper-deep/70 px-3 py-2">🎧 Headphones help, but are not a must</li>
            <li className="rounded-2xl bg-paper-deep/70 px-3 py-2">🎤 Allow the microphone when asked</li>
            <li className="rounded-2xl bg-paper-deep/70 px-3 py-2">🗣️ Talk any time, even to interrupt</li>
          </ul>

          {p.mic === "blocked" && (
            <div role="alert" className="mt-5 rounded-2xl border-2 border-coral/40 bg-coral/10 p-4">
              <p className="font-bold">Your microphone is blocked.</p>
              <p className="text-[15px]">
                Click the 🔒 lock icon next to the website address, set Microphone to <b>Allow</b>, then tap Enter class
                again. Or join with typing only.
              </p>
            </div>
          )}
          {p.mic === "missing" && (
            <div role="alert" className="mt-5 rounded-2xl border-2 border-coral/40 bg-coral/10 p-4">
              <p className="font-bold">We couldn&apos;t find a microphone.</p>
              <p className="text-[15px]">Plug in earphones with a mic, or join with typing only.</p>
            </div>
          )}
          {p.error && (
            <p role="alert" className="mt-5 rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 font-semibold">
              {p.error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={p.onEnter}
              disabled={p.joining}
              className="rounded-2xl bg-leaf px-7 py-4 text-xl font-bold text-white shadow-[0_5px_0_#2c6b42] transition enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-60"
            >
              {p.joining ? "Opening the door…" : p.rejoin ? "Rejoin class" : "Enter class 🚪"}
            </button>
            {(p.mic === "blocked" || p.mic === "missing") && (
              <button onClick={p.onEnterWithoutMic} disabled={p.joining} className="rounded-2xl border-2 border-line bg-white px-5 py-3.5 font-bold">
                Join with typing only
              </button>
            )}
            <button onClick={p.onTour} className="font-semibold text-ink-soft underline underline-offset-4">
              First time? Take the 30-second tour
            </button>
            <Link href="/learn" className="ml-auto font-semibold text-ink-soft underline underline-offset-4">
              Back to chapters
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

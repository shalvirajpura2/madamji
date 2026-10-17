"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Chapter } from "@/lib/content";
import type { LessonState } from "@/lib/lesson";
import { ClassroomView } from "./classroom-view";

// A 30-second walkthrough of the classroom on a sample class, for first-time students.

type Step = { target?: string; title: string; body: string };

const STEPS: Step[] = [
  { title: "Welcome to your class! 👋", body: "Here is a 30-second tour of the classroom, so you know where everything is." },
  { target: "teacher", title: "Meera Ma'am", body: "Your science teacher. Her face shows when she is speaking, listening or thinking." },
  { target: "board", title: "The chalkboard", body: "She writes each point here as she explains. Ask her to draw something and it appears here too." },
  { target: "status", title: "Whose turn is it?", body: "This bar always tells you. Green means it is your turn to talk." },
  { target: "mic", title: "Your microphone", body: "Green means Ma'am can hear you. Just talk any time, even in the middle of her sentence, to ask a doubt." },
  { target: "hand", title: "Raise your hand", body: "Feeling shy? Tap this and she will stop and listen to you." },
  { target: "question", title: "Practice questions", body: "Say your answer or tap it. If it is wrong, she gives a hint, never the answer. You will get it!" },
  { target: "hint", title: "Need help?", body: "Tap Hint any time a question feels hard." },
  { target: "doubts", title: "Doubt list", body: "If you ask many doubts, the extra ones go here. Ma'am answers all of them before the class ends." },
  { target: "timer", title: "Class timer", body: "Shows how much time is left in your 15 or 25 minute class." },
  { target: "pause", title: "Pause", body: "Need a break? Pause stops everything, even the timer. Tap Resume when you are back." },
  { target: "type", title: "Prefer typing?", body: "Type to Ma'am instead of talking. Hinglish is fine!" },
  { title: "You're ready! 🎉", body: "Tap Enter class and say hello to Ma'am. You can see this tour again from the ? button in class." },
];

const TOUR_KEY = "madamji.tour.done";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_KEY, "1");
  } catch {}
}

function findTarget(root: HTMLElement | null, name?: string): HTMLElement | null {
  if (!root || !name) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find((el) => el.offsetParent !== null) ?? null;
}

export function Tour({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [narrow, setNarrow] = useState(false);

  const steps = STEPS;
  const [endsAt] = useState(() => Date.now() + 12 * 60 * 1000);
  const step = steps[i];

  const finish = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  const measure = useCallback(() => {
    setNarrow(window.innerWidth < 640);
    const el = findTarget(root, step.target);
    setBox(el ? el.getBoundingClientRect() : null);
  }, [root, step.target]);

  useLayoutEffect(() => {
    const el = findTarget(root, step.target);
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [root, step.target, measure]);

  useEffect(() => {
    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    const scroller = root?.parentElement;
    scroller?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      scroller?.removeEventListener("scroll", onResize);
    };
  }, [measure, finish, root, steps.length]);

  const demo: LessonState = useMemo(
    () => ({
      v: 1,
      chapter: chapter.id,
      phase: "question",
      section: 0,
      sections: chapter.sections.length,
      sectionsDone: 0,
      revealed: chapter.sections[0].beats.length,
      question: { id: chapter.sections[0].questions[0].id, index: 0, count: chapter.sections[0].questions.length, status: "open", picked: "", answer: null, explain: null, eliminated: [], hints: 0 },
      score: { correct: 0, attempted: 0 },
      paused: false,
      mood: "curious",
      status: "ok",
      minutes: 15,
      endsAt,
      doubts: [{ text: "why does a compass point north?", answered: false }],
    }),
    [chapter, endsAt],
  );

  const pad = 8;
  const last = i === steps.length - 1;
  const card = (
    <div className="paper-card w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-pop" role="dialog" aria-label={step.title}>
      <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">
        Tour · {i + 1} of {steps.length}
      </p>
      <h2 className="mt-1 text-xl font-extrabold">{step.title}</h2>
      <p className="mt-1 text-[15px] leading-snug">{step.body}</p>
      <div className="mt-4 flex items-center gap-2">
        <button onClick={finish} className="text-sm font-semibold text-ink-soft underline underline-offset-4">
          Skip tour
        </button>
        <div className="ml-auto flex gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="rounded-2xl border-2 border-line bg-white px-4 py-2 font-bold">
              Back
            </button>
          )}
          <button
            autoFocus
            onClick={() => (last ? finish() : setI(i + 1))}
            className="rounded-2xl bg-leaf px-5 py-2 font-bold text-white shadow-[0_4px_0_#2c6b42] active:translate-y-1 active:shadow-none"
          >
            {last ? "Got it!" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );

  // place the card next to the highlighted part on big screens, as a bottom sheet on phones
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (box && !narrow) {
    const below = box.bottom + 16 + 220 < window.innerHeight;
    const left = Math.min(Math.max(16, box.left + box.width / 2 - 192), window.innerWidth - 400);
    cardStyle = below ? { left, top: box.bottom + 16 } : { left, top: Math.max(16, box.top - 16 - 220) };
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-paper">
      <div ref={setRoot} className="pointer-events-none flex min-h-full flex-col select-none" aria-hidden>
        <ClassroomView
          chapter={chapter}
          lesson={demo}
          teacher={{ pose: "listening", mood: "curious", level: 0 }}
          status={{ tone: "turn", text: "Your turn! Say or tap your answer" }}
          captions={{ teacher: "Quick question, it's on the screen. Which of these will a magnet pull?", student: "" }}
          micOn
          hearing={false}
          banner={null}
          pendingAnswer={false}
          onAnswer={() => {}}
          onRaiseHand={() => {}}
          onPause={() => {}}
          onResume={() => {}}
          onContinue={() => {}}
          onHint={() => {}}
          onToggleMic={() => {}}
          onSendText={() => {}}
          onLeave={() => {}}
        />
      </div>
      {box ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-marigold transition-all duration-300"
          style={{
            left: box.left - pad,
            top: box.top - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(43 33 24 / 0.62)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/60" />
      )}
      {narrow ? (
        <div
          className={`fixed inset-x-0 z-10 flex justify-center p-3 ${
            box && box.top > window.innerHeight / 2 ? "top-0" : "bottom-0"
          }`}
        >
          {card}
        </div>
      ) : (
        <div className="fixed z-10 w-96" style={cardStyle}>
          {card}
        </div>
      )}
    </div>
  );
}

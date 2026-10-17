"use client";

import { useEffect, useMemo, useState } from "react";
import type { Chapter } from "@/lib/content";
import type { LessonState, Mood } from "@/lib/lesson";
import type { TeacherPose } from "@/components/teacher";
import { ClassroomView } from "./classroom-view";
import type { StatusTone } from "./controls";

type Frame = { lesson: LessonState; pose: TeacherPose; tone: StatusTone; text: string; caption: string };

function frames(chapter: Chapter): Frame[] {
  const base = (over: Partial<LessonState>): LessonState => ({
    v: 1, chapter: chapter.id, phase: "teach", section: 0, sections: chapter.sections.length, sectionsDone: 0,
    revealed: 0, question: null, score: { correct: 0, attempted: 0 }, paused: false, mood: "explaining", status: "ok",
    minutes: 15, endsAt: Date.now() + 11 * 60 * 1000,
    doubts: [{ text: "why is copper not magnetic", answered: false }],
    ...over,
  });
  const out: Frame[] = [
    { lesson: base({ phase: "intro", mood: "happy" }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking · just talk to interrupt", caption: "Namaste Aarav! Aaj hum magnets ke baare mein padhenge…" },
  ];
  const s = chapter.sections[0];
  s.beats.forEach((b, i) =>
    out.push({ lesson: base({ revealed: i + 1 }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking · just talk to interrupt", caption: b.board }),
  );
  out.push({ lesson: base({ phase: "check", revealed: s.beats.length, mood: "curious" }), pose: "listening", tone: "turn", text: "Any doubts? Ask now, or tap No doubts", caption: "Toh, koi doubt?" });
  const q = s.questions[0];
  const qs = (status: "open" | "retry" | "correct" | "revealed", picked = "", answer: string | null = null) => ({
    id: q.id, index: 0, count: s.questions.length, status, picked, answer,
    explain: answer ? "An iron nail is made of iron, a magnetic material." : null,
  });
  out.push({ lesson: base({ phase: "question", revealed: s.beats.length, question: qs("open"), mood: "curious" }), pose: "listening", tone: "turn", text: "Your turn! Say or tap your answer", caption: "Quick question, screen pe dekho…" });
  out.push({ lesson: base({ phase: "question", revealed: s.beats.length, question: qs("retry", q.options?.[0] ?? "True"), mood: "encouraging" }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking", caption: "Hmm, close! Ek baar aur socho…" });
  out.push({ lesson: base({ phase: "feedback", revealed: s.beats.length, question: qs("correct", q.options?.[1] ?? "False", q.options?.[1] ?? "False"), mood: "happy", score: { correct: 1, attempted: 1 } }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking", caption: "Bilkul sahi! Iron nail is magnetic." });
  out.push({ lesson: base({ phase: "teach", revealed: 1, section: 1, sectionsDone: 1, paused: true, pausedAt: Date.now() - 20000, mood: "calm", score: { correct: 1, attempted: 1 } }), pose: "idle", tone: "paused", text: "Class paused", caption: "Theek hai, chhota sa break." });
  out.push({ lesson: base({ phase: "teach", section: 3, sectionsDone: 3, revealed: 1, mood: "explaining", drawing: { n: 1, kind: "template", template: "magnets", params: { left: "N", right: "N" }, title: "two north poles facing each other" } }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking · just talk to interrupt", caption: "Let me draw that for you. See, the field lines from both north poles bend away from each other..." });
  out.push({ lesson: base({ phase: "doubts", section: 1, sectionsDone: 2, doubt: 1, mood: "explaining", endsAt: Date.now() + 100 * 1000, doubts: [{ text: "why is copper not magnetic", answered: true }, { text: "can a magnet lose its power", answered: false }] }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking", caption: "Next doubt on our list: can a magnet lose its power?" });
  out.push({ lesson: base({ phase: "wrap", section: chapter.sections.length - 1, sectionsDone: chapter.sections.length, mood: "proud", score: { correct: 7, attempted: 8 } }), pose: "speaking", tone: "speaking", text: "Ma'am is speaking", caption: "Aaj ki class yahin khatam!" });
  return out;
}

export function Preview({ chapter }: { chapter: Chapter }) {
  const list = useMemo(() => frames(chapter), [chapter]);
  const [i, setI] = useState(0);
  const [level, setLevel] = useState(0);
  const f = list[i];

  useEffect(() => {
    if (f.pose !== "speaking") return;
    const t = setInterval(() => setLevel(Math.random() * 0.45), 120);
    return () => clearInterval(t);
  }, [f.pose]);

  return (
    <>
      <div className="fixed top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-sm text-paper shadow-lg">
        <button onClick={() => setI((n) => Math.max(0, n - 1))}>◀</button>
        <span>
          preview {i + 1}/{list.length}: {f.lesson.phase}
        </span>
        <button onClick={() => setI((n) => Math.min(list.length - 1, n + 1))}>▶</button>
      </div>
      <ClassroomView
        chapter={chapter}
        lesson={f.lesson}
        teacher={{ pose: f.pose, mood: f.lesson.mood as Mood, level: f.pose === "speaking" ? level : 0 }}
        status={{ tone: f.tone, text: f.text }}
        captions={{ teacher: f.caption, student: i > 3 ? "B, iron nail" : "" }}
        micOn
        hearing={f.tone === "you"}
        banner={null}
        pendingAnswer={false}
        nextChapter={null}
        onAnswer={() => setI((n) => Math.min(list.length - 1, n + 1))}
        onRaiseHand={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        onContinue={() => setI((n) => n + 1)}
        onHint={() => {}}
        onToggleMic={() => {}}
        onSendText={() => {}}
        onLeave={() => {}}
      />
    </>
  );
}

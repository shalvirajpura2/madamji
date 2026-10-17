"use client";

import { Teacher, type TeacherPose } from "@/components/teacher";
import type { Chapter } from "@/lib/content";
import type { LessonState, Mood } from "@/lib/lesson";
import { Board } from "./board";
import { Captions } from "./captions";
import { ClassTimer } from "./class-timer";
import { DoubtList } from "./doubt-list";
import { Controls, StatusPill, type StatusTone } from "./controls";
import { QuestionCard } from "./question-card";

export type ClassroomViewProps = {
  chapter: Chapter;
  lesson: LessonState | null;
  teacher: { pose: TeacherPose; mood: Mood; level: number };
  status: { tone: StatusTone; text: string };
  captions: { teacher: string; student: string };
  micOn: boolean;
  banner: string | null;
  pendingAnswer: boolean;
  nextChapter?: { id: string; title: string } | null;
  onAnswer: (questionId: string, answer: { choice?: number; text?: string }) => void;
  onRaiseHand: () => void;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  onHint: () => void;
  onToggleMic: () => void;
  onSendText: (text: string) => void;
  onLeave: () => void;
};

export function ClassroomView(p: ClassroomViewProps) {
  const { chapter, lesson } = p;
  const section = chapter.sections[lesson?.section ?? 0];
  const question = lesson?.question ? section?.questions.find((q) => q.id === lesson.question!.id) : undefined;
  const done = lesson?.sectionsDone ?? 0;
  const finishedChapter = done >= chapter.sections.length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-3 sm:px-5 sm:py-4">
      <header className="flex flex-wrap items-center gap-3">
        <button
          onClick={p.onLeave}
          className="rounded-2xl border-2 border-line bg-white px-3 py-2 font-bold transition hover:border-coral"
        >
          ← Leave
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-soft">Class {chapter.grade} · Science</p>
          <h1 className="truncate text-xl font-extrabold sm:text-2xl">{chapter.title}</h1>
        </div>
        <ol className="flex items-center gap-1.5" aria-label="Chapter parts">
          {chapter.sections.map((s, i) => {
            const current = lesson && i === lesson.section && !["intro", "wrap", "doubts"].includes(lesson.phase);
            const finished = i < done;
            return (
              <li
                key={s.id}
                title={s.title}
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold transition sm:h-8 sm:min-w-8 sm:px-2 sm:text-sm ${
                  current ? "bg-marigold text-ink ring-4 ring-marigold/30" : finished ? "bg-leaf text-white" : "bg-line text-ink-soft"
                }`}
              >
                {finished && !current ? "✓" : i + 1}
              </li>
            );
          })}
        </ol>
        <ClassTimer endsAt={lesson?.endsAt} minutes={lesson?.minutes} phase={lesson?.phase} />
        {lesson && lesson.score.attempted > 0 && (
          <span className="rounded-full bg-chalk-yellow/60 px-3 py-1.5 font-extrabold" title="Questions right">
            ⭐ {lesson.score.correct}/{lesson.score.attempted}
          </span>
        )}
      </header>

      {p.banner && (
        <div role="alert" className="rounded-2xl border-2 border-coral/40 bg-coral/10 px-4 py-3 font-semibold text-ink animate-rise">
          {p.banner}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={`relative ${question ? "flex-none" : "min-h-[340px] flex-1"}`}>
            <Board chapter={chapter} lesson={lesson} compact={Boolean(question)} />
            {lesson?.paused && (
              <div className="absolute inset-0 z-30 flex items-center justify-center rounded-sm bg-ink/55">
                <div className="paper-card rounded-3xl px-8 py-6 text-center animate-pop">
                  <p className="text-4xl">☕</p>
                  <p className="text-2xl font-extrabold">Short break</p>
                  <button onClick={p.onResume} className="mt-3 rounded-2xl bg-leaf px-6 py-3 text-lg font-bold text-white">
                    I&apos;m back ▶
                  </button>
                </div>
              </div>
            )}
          </div>

          {question && lesson?.question && (
            <QuestionCard
              question={question}
              state={lesson.question}
              pending={p.pendingAnswer}
              onAnswer={(a) => p.onAnswer(question.id, a)}
            />
          )}

          {lesson?.phase === "wrap" && (
            <div className="paper-card flex flex-wrap items-center gap-4 rounded-3xl p-5 animate-rise">
              <span className="text-4xl">{finishedChapter ? "🎉" : "⏰"}</span>
              <div className="flex-1">
                <p className="text-xl font-extrabold">
                  {finishedChapter ? `Shabash! You finished ${chapter.title}.` : "Class time is over for today."}
                </p>
                <p className="text-ink-soft">
                  {finishedChapter
                    ? "Ma'am will remember how you did for next time."
                    : `You did ${done} of ${chapter.sections.length} parts. Next class starts from part ${done + 1}.`}
                </p>
              </div>
              {!finishedChapter && (
                <a href={`/room/${chapter.id}`} className="rounded-2xl bg-leaf px-5 py-3 font-bold text-white">
                  Continue the chapter →
                </a>
              )}
              {finishedChapter && p.nextChapter && (
                <a href={`/room/${p.nextChapter.id}`} className="rounded-2xl bg-leaf px-5 py-3 font-bold text-white">
                  Next: {p.nextChapter.title} →
                </a>
              )}
              <a href="/learn" className="rounded-2xl border-2 border-line bg-white px-5 py-3 font-bold">
                All chapters
              </a>
            </div>
          )}
        </div>

        <aside className="order-first flex flex-col gap-3 lg:order-none">
          <div className="paper-card flex items-center gap-3 rounded-3xl p-3 lg:flex-col lg:items-center lg:p-4">
            <Teacher
              pose={p.teacher.pose}
              mood={p.teacher.mood}
              level={p.teacher.level}
              className="h-24 w-20 shrink-0 lg:h-64 lg:w-52"
            />
            <div className="min-w-0 flex-1 lg:w-full lg:text-center">
              <p className="text-lg font-extrabold">Meera Ma&apos;am</p>
              <p className="hidden text-sm text-ink-soft lg:block">Science teacher</p>
              <Captions text={p.captions.teacher} className="max-h-[4.6rem] text-[15px] leading-snug font-medium lg:hidden" />
            </div>
          </div>
          <div className="paper-card hidden min-h-28 flex-col gap-2 rounded-3xl p-4 lg:flex" aria-live="polite">
            <p className="text-xs font-bold tracking-wide text-ink-soft uppercase">Ma&apos;am is saying</p>
            <Captions text={p.captions.teacher} className="max-h-40 text-[15px] leading-snug font-medium" />
            {p.captions.student && (
              <p className="mt-auto line-clamp-2 border-t-2 border-dashed border-line pt-2 text-sm text-ink-soft">
                <span className="font-bold text-leaf">You: </span>
                {p.captions.student}
              </p>
            )}
          </div>
          <DoubtList doubts={lesson?.doubts} current={lesson?.phase === "doubts" ? lesson.doubt : -1} />
        </aside>
      </div>

      <footer className="sticky bottom-0 -mx-3 flex flex-col gap-3 border-t-2 border-line bg-paper/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <StatusPill tone={p.status.tone} text={p.status.text} />
        <Controls
          micOn={p.micOn}
          paused={Boolean(lesson?.paused)}
          phase={lesson?.phase}
          disabled={!lesson}
          onToggleMic={p.onToggleMic}
          onRaiseHand={p.onRaiseHand}
          onPause={p.onPause}
          onResume={p.onResume}
          onContinue={p.onContinue}
          onHint={p.onHint}
          onSendText={p.onSendText}
        />
      </footer>
    </div>
  );
}

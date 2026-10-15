import type { Chapter } from "@/lib/content";
import type { LessonState } from "@/lib/lesson";
import { Diagram, hasDiagram } from "./diagrams";

const BULLET_COLORS = ["var(--color-chalk-yellow)", "var(--color-chalk-pink)", "var(--color-chalk-blue)", "var(--color-chalk-green)"];

export function Board({ chapter, lesson, compact = false }: { chapter: Chapter; lesson: LessonState | null; compact?: boolean }) {
  const phase = lesson?.phase ?? "intro";
  const section = chapter.sections[lesson?.section ?? 0];

  if (!lesson || phase === "intro") {
    return (
      <BoardFrame>
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
          <p className="chalk text-xl opacity-80">Today&apos;s chapter</p>
          <h2 className="chalk chalk-write text-4xl font-bold sm:text-5xl">{chapter.title}</h2>
          <svg viewBox="0 0 300 12" className="w-64" aria-hidden>
            <path d="M4 8 Q80 2 150 7 T296 5" stroke="var(--color-chalk-yellow)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <p className="chalk max-w-lg text-xl opacity-90">{chapter.tagline}</p>
        </div>
      </BoardFrame>
    );
  }

  if (phase === "wrap") {
    return (
      <BoardFrame>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <p className="chalk text-5xl">⭐</p>
          <h2 className="chalk chalk-write text-4xl font-bold">Chapter complete!</h2>
          <p className="chalk text-2xl" style={{ color: "var(--color-chalk-yellow)" }}>
            Score: {lesson.score.correct} / {lesson.score.attempted}
          </p>
          <ul className="chalk mt-2 space-y-1 text-lg opacity-90">
            {chapter.sections.map((s) => (
              <li key={s.id}>✓ {s.title}</li>
            ))}
          </ul>
        </div>
      </BoardFrame>
    );
  }

  const lines = section.beats.slice(0, Math.max(lesson.revealed, 0));
  const diagram = compact ? undefined : [...lines].reverse().find((b) => hasDiagram(b.diagram))?.diagram;

  return (
    <BoardFrame compact={compact}>
      <div className={`flex h-full flex-col ${compact ? "gap-2" : "gap-4"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={`chalk font-bold ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`} style={{ color: "var(--color-chalk-yellow)" }}>
            {section.title}
          </h2>
          <span className="chalk shrink-0 text-base opacity-70">
            Part {lesson.section + 1}/{chapter.sections.length}
          </span>
        </div>
        <ul className={`flex flex-col ${compact ? "gap-1" : "gap-3"}`}>
          {lines.map((b, i) => (
            <li
              key={`${section.id}-${i}`}
              className={`chalk flex gap-3 leading-snug ${compact ? "text-lg" : "chalk-write text-xl sm:text-2xl"}`}
            >
              <span style={{ color: BULLET_COLORS[i % BULLET_COLORS.length] }}>✦</span>
              <span>{b.board}</span>
            </li>
          ))}
        </ul>
        {diagram && (
          <div className="mt-auto flex min-h-0 justify-center">
            <Diagram id={diagram} />
          </div>
        )}
      </div>
    </BoardFrame>
  );
}

function BoardFrame({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`chalkboard h-full overflow-hidden rounded-sm ${compact ? "p-4 sm:p-5" : "min-h-[320px] p-5 sm:p-7"}`}>
      <div className="relative z-10 h-full">{children}</div>
      <div className="absolute right-6 -bottom-[14px] z-20 flex gap-2" aria-hidden>
        <span className="h-2.5 w-10 rounded-full bg-chalk shadow" />
        <span className="h-2.5 w-7 rounded-full bg-chalk-yellow shadow" />
        <span className="h-4 w-14 rounded-sm bg-[#d9c8a8] shadow" />
      </div>
    </div>
  );
}

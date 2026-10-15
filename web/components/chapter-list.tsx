"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChapterArt } from "@/components/chapter-art";
import { Teacher } from "@/components/teacher";
import type { Chapter } from "@/lib/content";
import type { ProgressRecord } from "@/lib/store/types";
import { saveStudent, useStudent } from "@/lib/student";

export function ChapterList({ chapters }: { chapters: Chapter[] }) {
  const student = useStudent();
  const router = useRouter();
  const [progress, setProgress] = useState<Record<string, ProgressRecord>>({});

  useEffect(() => {
    if (student === null) router.replace("/");
  }, [student, router]);

  useEffect(() => {
    if (!student) return;
    let alive = true;
    fetch("/api/progress", { method: "POST", body: JSON.stringify({ studentId: student.id }) })
      .then((r) => r.json())
      .then((d: { progress: ProgressRecord[] }) => {
        if (alive) setProgress(Object.fromEntries(d.progress.map((p) => [p.chapterId, p])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [student]);

  if (!student) return <div className="m-auto text-ink-soft">Loading your classroom…</div>;

  const mine = chapters.filter((c) => c.grade === student.grade);
  const nextUp = mine.find((c) => !progress[c.id]?.completed) ?? mine[0];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <Teacher pose="idle" mood="happy" className="h-24 w-20" />
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Namaste, {student.name}!</h1>
          <p className="text-lg text-ink-soft">Pick a chapter. Ma&apos;am will take it from there.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border-2 border-line bg-white p-1">
          {[6, 10].map((g) => (
            <button
              key={g}
              onClick={() => saveStudent({ ...student, grade: g })}
              className={`rounded-full px-4 py-1.5 font-bold transition ${
                student.grade === g ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              Class {g}
            </button>
          ))}
        </div>
      </header>

      {mine.length === 0 && (
        <p className="paper-card rounded-2xl p-6 text-lg">Chapters for class {student.grade} are coming soon.</p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {mine.map((c, i) => {
          const p = progress[c.id];
          const total = c.sections.length;
          const done = p?.completed ? total : Math.min(p?.sectionsDone ?? 0, total);
          const label = p?.completed ? "Revise chapter" : done > 0 ? `Continue part ${done + 1}` : "Start class";
          const isNext = c.id === nextUp?.id;
          return (
            <Link
              key={c.id}
              href={`/room/${c.id}`}
              className={`paper-card group flex flex-col gap-4 rounded-3xl p-5 transition hover:-translate-y-1 animate-rise ${
                isNext ? "ring-4 ring-marigold/50" : ""
              }`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <ChapterArt icon={c.icon} className="h-16 w-16 transition group-hover:rotate-6" />
                {isNext && (
                  <span className="rounded-full bg-marigold px-3 py-1 text-xs font-bold tracking-wide uppercase">
                    Up next
                  </span>
                )}
                {p?.completed && (
                  <span className="rounded-full bg-leaf px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
                    Done ✓
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-soft">{c.book}</p>
                <h2 className="text-2xl leading-tight font-extrabold">{c.title}</h2>
                <p className="mt-1 text-[15px] leading-snug text-ink-soft">{c.tagline}</p>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex gap-1.5" aria-label={`${done} of ${total} parts done`}>
                  {c.sections.map((s, j) => (
                    <span key={s.id} className={`h-2.5 flex-1 rounded-full ${j < done ? "bg-leaf" : "bg-line"}`} />
                  ))}
                </div>
                {p?.recap && <p className="line-clamp-2 text-sm text-ink-soft">Last time: {p.recap}</p>}
                <span className="mt-1 rounded-2xl bg-ink py-3 text-center text-lg font-bold text-paper transition group-hover:bg-leaf">
                  {label} →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <Link href="/" className="self-center text-sm font-semibold text-ink-soft underline underline-offset-4">
        Change name
      </Link>
    </div>
  );
}

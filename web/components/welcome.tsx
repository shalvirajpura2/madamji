"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Teacher } from "@/components/teacher";
import { clearStudent, newStudentId, saveStudent, useStudent } from "@/lib/student";

const GRADES = [
  { grade: 6, label: "Class 6", note: "Curiosity book · stories & experiments", color: "bg-sky/10 border-sky" },
  { grade: 10, label: "Class 10", note: "Board exam prep · concepts & numericals", color: "bg-plum/10 border-plum" },
];

export function Welcome() {
  const student = useStudent();
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  const ready = name.trim().length > 0 && grade !== null;

  function start() {
    if (!ready) return;
    const profile = { id: student?.id ?? newStudentId(), name: name.trim(), grade: grade! };
    saveStudent(profile);
    fetch("/api/students", { method: "POST", body: JSON.stringify(profile) }).catch(() => {});
    router.push("/learn");
  }

  const returning = student && !editing;
  const bubble = returning
    ? `Arre ${student.name}, welcome back! Chalo, aaj kya padhenge?`
    : "Namaste! Main Meera Ma'am hoon, aapki science teacher. Aapka naam kya hai?";

  return (
    <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col items-center text-center md:items-start md:text-left">
        <p className="mb-2 rounded-full bg-marigold/15 px-3 py-1 text-sm font-semibold text-marigold-deep">
          MadamJi · voice science class
        </p>
        <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">
          Learn science by <span className="text-leaf">talking</span> to your teacher
        </h1>
        <div className="relative mt-6 flex items-end gap-3">
          <Teacher pose="speaking" mood="happy" wave className="h-52 w-40 shrink-0 animate-float sm:h-64 sm:w-48" />
          <div className="paper-card relative mb-16 max-w-60 rounded-2xl rounded-bl-sm px-4 py-3 text-left text-[15px] font-medium animate-pop">
            {student === undefined ? "…" : bubble}
          </div>
        </div>
      </section>

      <section className="paper-card rounded-3xl p-6 sm:p-8 animate-rise">
        {returning ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-ink-soft">Signed in on this device as</p>
              <p className="text-3xl font-bold">
                {student.name} <span className="text-lg font-semibold text-ink-soft">· Class {student.grade}</span>
              </p>
            </div>
            <Link
              href="/learn"
              className="rounded-2xl bg-leaf px-6 py-4 text-center text-xl font-bold text-white shadow-[0_5px_0_#2c6b42] transition active:translate-y-1 active:shadow-none"
            >
              Go to my chapters →
            </Link>
            <button
              onClick={() => {
                setName("");
                setGrade(null);
                setEditing(true);
                clearStudent();
              }}
              className="text-sm font-semibold text-ink-soft underline underline-offset-4"
            >
              Not {student.name}? Start as someone else
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-lg font-bold">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                placeholder="e.g. Aarav"
                className="rounded-2xl border-2 border-line bg-paper px-4 py-3 text-xl font-semibold outline-none focus:border-marigold"
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-lg font-bold">Which class are you in?</legend>
              <div className="grid grid-cols-2 gap-3">
                {GRADES.map((g) => (
                  <button
                    type="button"
                    key={g.grade}
                    onClick={() => setGrade(g.grade)}
                    aria-pressed={grade === g.grade}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      grade === g.grade ? `${g.color} scale-[1.02] border-[3px]` : "border-line bg-paper hover:border-marigold"
                    }`}
                  >
                    <span className="block text-2xl font-extrabold">{g.label}</span>
                    <span className="mt-1 block text-sm leading-snug text-ink-soft">{g.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!ready}
              className="rounded-2xl bg-marigold px-6 py-4 text-xl font-bold text-ink shadow-[0_5px_0_var(--color-marigold-deep)] transition enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
            >
              Chalo, class chalein →
            </button>
            <p className="text-center text-sm text-ink-soft">
              No sign-up. Your name stays on this device and helps Ma&apos;am remember you.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}

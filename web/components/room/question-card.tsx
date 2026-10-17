"use client";

import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/content";
import type { QuestionState } from "@/lib/lesson";

type Props = {
  question: Question;
  state: QuestionState;
  pending: boolean;
  onAnswer: (answer: { choice?: number; text?: string }) => void;
};

const LETTERS = "ABCD";

function same(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function QuestionCard({ question, state, pending, onAnswer }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [question.id]);
  const locked = pending || state.status === "correct" || state.status === "revealed";
  const done = state.status === "correct" || state.status === "revealed";

  const options =
    question.type === "mcq"
      ? question.options ?? []
      : question.type === "truefalse"
        ? ["True", "False"]
        : question.type === "fill"
          ? question.choices ?? []
          : [];

  function optionTone(option: string, index: number) {
    if (!done && question.type === "mcq" && state.eliminated?.includes(index)) {
      return "border-line bg-paper-deep/40 text-ink-soft/50 line-through opacity-50";
    }
    const isPicked = state.picked && same(state.picked, option);
    const isAnswer = state.answer && same(state.answer, option);
    if (done && isAnswer) return "border-leaf bg-leaf/15 text-leaf";
    if (state.status === "correct" && isPicked) return "border-leaf bg-leaf/15 text-leaf";
    if ((state.status === "retry" || state.status === "revealed") && isPicked) return "border-coral bg-coral/10 text-coral line-through decoration-2";
    return "border-line bg-white hover:border-marigold hover:-translate-y-0.5";
  }

  return (
    <div
      ref={ref}
      data-tour="question"
      key={`${question.id}-${state.status}`}
      className={`paper-card relative rounded-3xl p-5 sm:p-6 ${state.status === "retry" ? "animate-[wiggle_0.4s_ease-in-out_2]" : "animate-rise"}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-sky/15 px-3 py-1 text-sm font-bold text-sky">
          Question {state.index + 1} of {state.count}
        </span>
        <Badge status={state.status} />
      </div>

      <p className="text-xl leading-snug font-bold sm:text-2xl">{question.prompt.replace("____", "______")}</p>

      {options.length > 0 && (
        <div className={`mt-4 grid gap-2.5 ${question.type === "mcq" ? "sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {options.map((option, i) => (
            <button
              key={option}
              disabled={locked || (question.type === "mcq" && state.eliminated?.includes(i))}
              onClick={() => onAnswer({ choice: i })}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition disabled:cursor-default ${optionTone(option, i)}`}
            >
              {question.type === "mcq" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-deep text-base font-extrabold">
                  {LETTERS[i]}
                </span>
              )}
              {option}
            </button>
          ))}
        </div>
      )}

      {(question.type === "short" || question.type === "number" || (question.type === "fill" && !options.length)) && !done && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer({ text: text.trim() });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={locked}
            placeholder={question.type === "number" ? `Your answer${question.unit ? ` in ${question.unit}` : ""}` : "Type your answer"}
            inputMode={question.type === "number" ? "decimal" : "text"}
            className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg outline-none focus:border-marigold"
          />
          <button disabled={locked || !text.trim()} className="rounded-2xl bg-ink px-5 font-bold text-paper disabled:opacity-40">
            Check
          </button>
        </form>
      )}

      {done && state.explain && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-[15px] leading-snug ${state.status === "correct" ? "bg-leaf/10" : "bg-marigold/15"}`}>
          {state.status === "revealed" && state.answer && <strong>Answer: {state.answer}. </strong>}
          {state.explain}
        </p>
      )}

      {!done && (
        <p className="mt-3 text-sm font-medium text-ink-soft">
          {pending
            ? "Checking…"
            : state.status === "retry"
              ? "Not quite yet. Listen to Ma'am's hint and try again, you can do it!"
              : (state.hints ?? 0) > 0
                ? "Use the hint and give it a try!"
                : "Say your answer out loud, or tap it."}
        </p>
      )}
    </div>
  );
}

function Badge({ status }: { status: QuestionState["status"] }) {
  if (status === "correct") return <span className="animate-pop text-lg font-extrabold text-leaf">✓ Correct!</span>;
  if (status === "retry") return <span className="text-lg font-extrabold text-coral">Try again</span>;
  if (status === "revealed") return <span className="text-lg font-extrabold text-marigold-deep">Let&apos;s learn it</span>;
  return null;
}

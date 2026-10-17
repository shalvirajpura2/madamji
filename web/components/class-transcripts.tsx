"use client";

import { useEffect, useState } from "react";
import type { TranscriptEntry, TranscriptRecord, TranscriptSummary } from "@/lib/store/types";

async function fetchTranscripts(passcode: string, id?: string) {
  const res = await fetch("/api/transcripts", { method: "POST", body: JSON.stringify({ passcode, id }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not load");
  return data;
}

const time = (ms: number) => new Date(ms).toLocaleString();
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ClassTranscripts({ passcode }: { passcode: string }) {
  const [classes, setClasses] = useState<TranscriptSummary[] | null>(null);
  const [open, setOpen] = useState<TranscriptRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTranscripts(passcode)
      .then((d) => setClasses(d.classes))
      .catch((e: Error) => setError(e.message));
  }, [passcode]);

  if (error) return <p className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 font-semibold">{error}</p>;
  if (!classes) return <p className="text-ink-soft">Loading classes…</p>;

  if (open) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setOpen(null)} className="self-start font-bold text-ink-soft underline underline-offset-4">
          ← All classes
        </button>
        <div className="paper-card rounded-3xl p-5">
          <h2 className="text-2xl font-extrabold">
            {open.studentName} · {open.chapterTitle}
          </h2>
          <p className="text-sm text-ink-soft">
            {time(open.startedAt)} · {open.minutes} min class · parts {open.sectionsDone}/{open.sections} · content
            version <code className="rounded bg-paper-deep px-1">{open.chapterVersion}</code>
            {open.models && ` · ${Object.values(open.models).join(" · ")}`}
          </p>
          {open.error && <p className="mt-2 font-semibold text-coral">Ended with an error: {open.error}</p>}
          <p className="mt-2 text-sm text-ink-soft">
            Grey boxes are what the lesson plan asked for (board line and teacher notes). If something the teacher said
            is wrong and it is in the notes, fix the chapter file; if it is not, the AI improvised it.
          </p>
        </div>
        <ol className="flex flex-col gap-2">
          {open.entries.map((e, i) => (
            <Entry key={i} entry={e} />
          ))}
        </ol>
      </div>
    );
  }

  if (!classes.length) return <p className="paper-card rounded-3xl p-6 text-lg text-ink-soft">No classes recorded yet.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {classes.map((c) => (
        <li key={c.id}>
          <button
            onClick={() => fetchTranscripts(passcode, c.id).then((d) => setOpen(d.transcript)).catch((e: Error) => setError(e.message))}
            className="paper-card flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-3xl p-4 text-left transition hover:-translate-y-0.5"
          >
            <span className="text-lg font-extrabold">{c.studentName}</span>
            <span className="font-semibold">{c.chapterTitle}</span>
            <span className="text-sm text-ink-soft">
              {time(c.startedAt)} · {c.minutes} min · parts {c.sectionsDone}/{c.sections} · {c.turns ?? "?"} entries · v
              {c.chapterVersion}
            </span>
            {c.error && <span className="text-sm font-bold text-coral">error</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Entry({ entry: e }: { entry: TranscriptEntry }) {
  const at = <span className="w-12 shrink-0 text-xs text-ink-soft tabular-nums">{clock(e.t)}</span>;
  const text = (key: string) => String(e[key] ?? "");

  if (e.kind === "step") {
    return (
      <li className="flex gap-3 rounded-2xl bg-paper-deep/60 px-4 py-2 text-sm">
        {at}
        <div>
          <b>
            Plan: {text("step")} · part {text("part")}
            {e.beat ? `, point ${text("beat")}` : ""}
          </b>
          {e.board ? <p>Board: “{text("board")}”</p> : null}
          {e.notes ? <p className="text-ink-soft">Notes: {text("notes")}</p> : null}
          {e.prompt ? <p>Question: {text("prompt")}</p> : null}
          {e.verdict ? <p>Graded: {text("verdict")} (said “{text("picked")}”)</p> : null}
          {e.doubt ? <p>Doubt: {text("doubt")}</p> : null}
        </div>
      </li>
    );
  }
  if (e.kind === "tool") {
    return (
      <li className="flex gap-3 rounded-2xl border-2 border-plum/30 bg-plum/5 px-4 py-2 text-sm">
        {at}
        <div className="min-w-0">
          <b className="text-plum">Tool: {text("name")}</b> <code>{JSON.stringify(e.args)}</code>
          {e.output ? <p className="line-clamp-3 text-ink-soft">→ {text("output")}</p> : null}
        </div>
      </li>
    );
  }
  if (e.kind === "event") {
    return (
      <li className="flex gap-3 px-4 py-1 text-sm text-ink-soft">
        {at}
        <span>
          ● {text("name")} {Object.entries(e).filter(([k]) => !["t", "kind", "name"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(", ")}
        </span>
      </li>
    );
  }
  const teacher = e.kind === "teacher";
  return (
    <li className={`flex gap-3 rounded-2xl px-4 py-2 ${teacher ? "bg-white" : "bg-leaf/10"}`}>
      {at}
      <p>
        <b className={teacher ? "text-marigold-deep" : "text-leaf"}>{teacher ? "Ma'am" : "Student"}: </b>
        {text("text")}
        {e.interrupted ? <span className="ml-2 text-xs font-bold text-coral">(interrupted)</span> : null}
      </p>
    </li>
  );
}

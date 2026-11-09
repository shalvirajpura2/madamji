"use client";

import { useEffect, useState } from "react";
import type { ActivityKind, ActivityRecord } from "@/lib/store/types";

const POLL_MS = 15_000;

const KINDS: Record<ActivityKind, { label: string; tone: string }> = {
  signed_in: { label: "Signed in", tone: "bg-sky/15 text-sky" },
  profile_created: { label: "New student", tone: "bg-plum/15 text-plum" },
  class_started: { label: "Class started", tone: "bg-leaf/15 text-leaf" },
  class_rejoined: { label: "Rejoined", tone: "bg-leaf/10 text-leaf" },
  class_finished: { label: "Class ended", tone: "bg-ink/10 text-ink" },
  class_blocked: { label: "Class blocked", tone: "bg-marigold/20 text-marigold-deep" },
  rate_limited: { label: "Rate limited", tone: "bg-coral/15 text-coral" },
  staff_login_failed: { label: "Wrong staff passcode", tone: "bg-coral/15 text-coral" },
};

function describe(a: ActivityRecord): string {
  const d = a.detail as Record<string, string | number | null | undefined>;
  switch (a.kind) {
    case "profile_created":
      return `${d.name} · class ${d.grade}`;
    case "class_started":
    case "class_rejoined":
      return `${d.chapterId} · ${d.minutes} min`;
    case "class_finished": {
      const secs = Number(d.durationSeconds) || 0;
      const parts = d.sections ? ` · ${d.sectionsDone}/${d.sections} parts` : "";
      return `${d.chapterId} · ${d.status} after ${Math.floor(secs / 60)}m ${secs % 60}s${parts}${d.error ? ` · ${d.error}` : ""}`;
    }
    case "class_blocked":
      return `${d.reason === "trial_used" ? "free classes used up" : "too many free classes from this network today"} · ${d.minutes} min`;
    case "rate_limited":
      return `${d.limit}: over ${d.max} in ${Number(d.windowSeconds) >= 3600 ? `${Number(d.windowSeconds) / 3600}h` : `${d.windowSeconds}s`}`;
    case "staff_login_failed":
      return d.attempts ? `attempt ${d.attempts}` : "";
    default:
      return "";
  }
}

export function StaffActivity({ passcode }: { passcode: string }) {
  const [activity, setActivity] = useState<ActivityRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ActivityKind | "all">("all");

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/staff", { method: "POST", body: JSON.stringify({ passcode, view: "activity" }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load activity");
        if (!stop) {
          setActivity(data.activity);
          setError(null);
        }
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [passcode]);

  if (error) return <p className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 font-semibold">{error}</p>;
  if (!activity) return <p className="text-ink-soft">Loading activity…</p>;

  const shown = kind === "all" ? activity : activity.filter((a) => a.kind === kind);

  return (
    <div className="flex flex-col gap-4">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as ActivityKind | "all")}
        className="self-start rounded-2xl border-2 border-line bg-white px-4 py-2 font-semibold"
      >
        <option value="all">Everything</option>
        {Object.entries(KINDS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
      {shown.length === 0 && <p className="paper-card rounded-2xl p-5 text-ink-soft">Nothing logged yet.</p>}
      <ul className="paper-card flex flex-col divide-y divide-line/60 rounded-2xl">
        {shown.map((a) => {
          const k = KINDS[a.kind] ?? { label: a.kind, tone: "bg-line text-ink" };
          return (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="w-36 shrink-0 text-ink-soft">
                {new Date(a.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${k.tone}`}>{k.label}</span>
              <span className="font-semibold">{a.email || (a.studentId ? a.studentId.slice(0, 8) : "")}</span>
              <span className="text-ink-soft">{describe(a)}</span>
              <span className="ml-auto font-mono text-xs text-ink-soft">{a.ip}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

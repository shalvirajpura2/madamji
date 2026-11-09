"use client";

import { useEffect, useMemo, useState } from "react";
import { trialUsage, type ClassRecord } from "@/lib/store/types";

const POLL_MS = 15_000;

type Limits = { trial: { long: number; short: number }; ipPerDay: number };

const STATUS: Record<ClassRecord["status"], string> = {
  started: "bg-sky/15 text-sky",
  finished: "bg-leaf/15 text-leaf",
  failed: "bg-coral/15 text-coral",
};

const time = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const duration = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}m ${s % 60}s`);
const sameDay = (iso: string, now: number) => new Date(iso).toDateString() === new Date(now).toDateString();

export function StaffClasses({ passcode }: { passcode: string }) {
  const [classes, setClasses] = useState<ClassRecord[] | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/staff", { method: "POST", body: JSON.stringify({ passcode, view: "classes" }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load classes");
        if (stop) return;
        setClasses(data.classes);
        setLimits(data.limits);
        setLoadedAt(Date.now());
        setError(null);
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

  const students = useMemo(() => {
    const by = new Map<string, ClassRecord[]>();
    for (const c of classes ?? []) by.set(c.studentId, [...(by.get(c.studentId) ?? []), c]);
    return [...by.values()].map((list) => ({ last: list[0], usage: trialUsage(list), total: list.length }));
  }, [classes]);

  if (error) return <p className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 font-semibold">{error}</p>;
  if (!classes || !limits) return <p className="text-ink-soft">Loading classes…</p>;

  const q = query.trim().toLowerCase();
  const match = (c: ClassRecord) =>
    !q || [c.studentName, c.email, c.ip, c.chapterId, c.id].some((v) => v.toLowerCase().includes(q));
  const today = classes.filter((c) => sameDay(c.createdAt, loadedAt));
  const tiles = [
    { label: "Classes today", value: today.filter((c) => !c.trialOf).length },
    { label: "Students today", value: new Set(today.map((c) => c.studentId)).size },
    {
      label: "Running now",
      value: classes.filter((c) => c.status === "started" && loadedAt - Date.parse(c.createdAt) < 30 * 60_000).length,
    },
    { label: "Dropped (not counted)", value: today.filter((c) => c.status === "failed").length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="paper-card rounded-2xl p-4">
            <p className="text-sm font-semibold text-ink-soft">{t.label}</p>
            <p className="text-3xl font-extrabold">{t.value}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-soft">
        Free trial per account: {limits.trial.long} × 25 min and {limits.trial.short} × 15 min. Up to {limits.ipPerDay} free
        classes per network per day. A class that drops in its first minute without teaching anything is not counted.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, IP or chapter"
        className="rounded-2xl border-2 border-line bg-white px-4 py-2.5 outline-none focus:border-marigold"
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">Students ({students.length})</h2>
        <div className="paper-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b-2 border-line text-ink-soft">
              <tr>
                <th className="p-3">Student</th>
                <th className="p-3">25 min used</th>
                <th className="p-3">15 min used</th>
                <th className="p-3">Classes (incl. rejoins)</th>
                <th className="p-3">Last class</th>
              </tr>
            </thead>
            <tbody>
              {students.filter((s) => match(s.last)).map((s) => {
                const full = s.usage.long >= limits.trial.long && s.usage.short >= limits.trial.short;
                return (
                  <tr key={s.last.studentId} className="border-b border-line/60 last:border-0">
                    <td className="p-3">
                      <p className="font-bold">{s.last.studentName || "—"}</p>
                      <p className="text-ink-soft">{s.last.email || s.last.studentId}</p>
                    </td>
                    <td className="p-3 font-semibold">
                      {s.usage.long} / {limits.trial.long}
                    </td>
                    <td className="p-3 font-semibold">
                      {s.usage.short} / {limits.trial.short}
                    </td>
                    <td className="p-3">
                      {s.total}
                      {full && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-paper">trial used</span>}
                    </td>
                    <td className="p-3 text-ink-soft">{time(s.last.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-extrabold">Recent classes</h2>
        <div className="paper-card overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b-2 border-line text-ink-soft">
              <tr>
                <th className="p-3">Started</th>
                <th className="p-3">Student</th>
                <th className="p-3">Chapter</th>
                <th className="p-3">Length</th>
                <th className="p-3">Status</th>
                <th className="p-3">Lasted</th>
                <th className="p-3">Parts</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {classes.filter(match).map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="p-3 whitespace-nowrap">{time(c.createdAt)}</td>
                  <td className="p-3">
                    <p className="font-bold">{c.studentName || "—"}</p>
                    <p className="text-ink-soft">{c.email}</p>
                  </td>
                  <td className="p-3">{c.chapterId}</td>
                  <td className="p-3">{c.minutes} min</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[c.status]}`}>{c.status}</span>
                    {c.trialOf && <span className="ml-1 text-xs font-semibold text-ink-soft">rejoin</span>}
                    {c.error && <p className="mt-1 max-w-56 text-xs text-coral">{c.error}</p>}
                  </td>
                  <td className="p-3">{duration(c.durationSeconds)}</td>
                  <td className="p-3">{c.sections ? `${c.sectionsDone ?? 0} / ${c.sections}` : "—"}</td>
                  <td className="p-3 font-mono text-xs" title={c.userAgent}>
                    {c.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {classes.length === 0 && <p className="p-4 text-ink-soft">No classes yet.</p>}
        </div>
      </section>
    </div>
  );
}

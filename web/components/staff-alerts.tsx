"use client";

import { useEffect, useRef, useState } from "react";
import type { AlertRecord } from "@/lib/store/types";

const POLL_MS = 4000;

function ping(ctx: AudioContext, high: boolean) {
  const notes = high ? [880, 660, 880, 660] : [660, 880];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    const start = ctx.currentTime + i * 0.22;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.21);
  });
}

export function StaffAlerts() {
  const [passcode, setPasscode] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stop = false;

    async function load() {
      try {
        const res = await fetch("/api/alerts", { method: "POST", body: JSON.stringify({ passcode: active }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load alerts");
        if (stop) return;
        const list = data.alerts as AlertRecord[];
        const newest = list[0]?.id ?? 0;
        if (seen.current !== null && newest > seen.current) {
          const added = list.filter((a) => a.id > seen.current!);
          setFresh((f) => new Set([...f, ...added.map((a) => a.id)]));
          if (audio.current) ping(audio.current, added.some((a) => a.severity === "high"));
          document.title = `(${added.length}) 🚨 MadamJi alerts`;
        }
        seen.current = newest;
        setAlerts(list);
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
  }, [active]);

  if (!active) {
    return (
      <form
        className="paper-card m-auto flex w-full max-w-sm flex-col gap-4 rounded-3xl p-6"
        onSubmit={(e) => {
          e.preventDefault();
          // creating the audio context on a click lets the browser play pings later
          audio.current = new AudioContext();
          setActive(passcode);
        }}
      >
        <h1 className="text-2xl font-extrabold">Safety alerts</h1>
        <p className="text-ink-soft">For the MadamJi care team only.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Staff passcode"
          className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg outline-none focus:border-marigold"
        />
        <button className="rounded-2xl bg-ink py-3 text-lg font-bold text-paper" disabled={!passcode}>
          Open dashboard
        </button>
      </form>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-extrabold">Safety alerts</h1>
        <span className="flex items-center gap-2 rounded-full bg-leaf/15 px-3 py-1.5 text-sm font-bold text-leaf">
          <span className="h-2 w-2 animate-pulse rounded-full bg-leaf" /> Live · sound on
        </span>
        <button
          onClick={() => audio.current && ping(audio.current, false)}
          className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-bold"
        >
          Test sound
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-2xl border-2 border-coral/40 bg-coral/10 p-4 font-semibold">
          {error}
          {error === "Wrong passcode" && (
            <button className="ml-3 underline" onClick={() => setActive(null)}>
              Try again
            </button>
          )}
        </p>
      )}

      {!error && alerts.length === 0 && (
        <p className="paper-card rounded-3xl p-6 text-lg text-ink-soft">No alerts. All classes are calm. 🌿</p>
      )}

      <ul className="flex flex-col gap-3">
        {alerts.map((a) => (
          <li
            key={a.id}
            onClick={() => setFresh((f) => new Set([...f].filter((id) => id !== a.id)))}
            className={`paper-card rounded-3xl border-l-8 p-5 ${a.severity === "high" ? "border-l-coral" : "border-l-marigold"} ${
              fresh.has(a.id) ? "ring-4 ring-coral/40 animate-pop" : ""
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase ${
                  a.severity === "high" ? "bg-coral text-white" : "bg-marigold text-ink"
                }`}
              >
                {a.severity}
              </span>
              <span className="font-bold">{a.category || "concern"}</span>
              <span className="text-sm text-ink-soft">
                · {a.studentName || "Unknown student"} · {a.chapterId} · {new Date(a.createdAt).toLocaleString()}
              </span>
              <span className="ml-auto text-xs font-semibold text-ink-soft">via {a.source}</span>
            </div>
            <p className="mt-2 text-lg">{a.summary}</p>
            {a.quote && <p className="mt-1 text-ink-soft italic">&ldquo;{a.quote}&rdquo;</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

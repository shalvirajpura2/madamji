"use client";

import { useEffect, useState } from "react";

export function ClassTimer({
  endsAt,
  minutes,
  phase,
  pausedAt,
}: {
  endsAt?: number;
  minutes?: number;
  phase?: string;
  pausedAt?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!endsAt || !minutes) return null;
  const left = Math.max(0, Math.round((endsAt - (pausedAt ?? now)) / 1000));
  const total = minutes * 60;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const low = left <= 180;
  const label = pausedAt
    ? `Paused · ${mm}:${ss}`
    : phase === "doubts"
      ? "Doubt time"
      : left === 0
        ? "Time's up"
        : `${mm}:${ss} left`;
  const tone = left === 0 || phase === "doubts" ? "bg-plum/15 text-plum" : low ? "bg-marigold/25 text-marigold-deep" : "bg-white text-ink";

  return (
    <div
      role="timer"
      data-tour="timer"
      aria-label={`${mm} minutes ${ss} seconds left in this ${minutes} minute class`}
      className={`flex items-center gap-2 rounded-full border-2 border-line px-3 py-1.5 font-extrabold tabular-nums ${tone}`}
      title={`${minutes}-minute class`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90" aria-hidden>
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={`${(left / total) * 50.3} 50.3`}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </div>
  );
}

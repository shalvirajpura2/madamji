"use client";

import { classesLeft, type Trial } from "@/lib/account";

/** "Free trial: 2 of 3 classes left · 1 × 25 min, 1 × 15 min" */
export function TrialBadge({ trial, className = "" }: { trial: Trial; className?: string }) {
  const left = classesLeft(trial);
  const total = trial.long.max + trial.short.max;
  if (left.total === 0) {
    return (
      <p className={`rounded-2xl border-2 border-coral/40 bg-coral/10 px-4 py-3 font-semibold ${className}`}>
        You&apos;ve used all {total} free classes. Thank you for learning with Meera Ma&apos;am! More classes are coming
        soon.
      </p>
    );
  }
  const parts = [left.long && `${left.long} × 25 min`, left.short && `${left.short} × 15 min`].filter(Boolean);
  return (
    <p className={`rounded-2xl bg-marigold/15 px-4 py-3 font-semibold text-marigold-deep ${className}`}>
      🎁 Free trial: {left.total} of {total} classes left · {parts.join(", ")}
    </p>
  );
}

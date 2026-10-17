"use client";

import { useState } from "react";

export type StatusTone = "connecting" | "speaking" | "thinking" | "listening" | "you" | "turn" | "paused" | "muted" | "trouble";

const TONES: Record<StatusTone, { dot: string; bg: string; icon: string }> = {
  connecting: { dot: "bg-ink-soft", bg: "bg-white", icon: "🚪" },
  speaking: { dot: "bg-marigold", bg: "bg-marigold/15", icon: "🗣️" },
  thinking: { dot: "bg-plum", bg: "bg-plum/10", icon: "🤔" },
  listening: { dot: "bg-sky", bg: "bg-sky/10", icon: "👂" },
  you: { dot: "bg-leaf", bg: "bg-leaf/15", icon: "🎙️" },
  turn: { dot: "bg-leaf", bg: "bg-leaf/15", icon: "✋" },
  paused: { dot: "bg-ink-soft", bg: "bg-paper-deep", icon: "⏸️" },
  muted: { dot: "bg-coral", bg: "bg-coral/10", icon: "🔇" },
  trouble: { dot: "bg-coral", bg: "bg-coral/10", icon: "⚠️" },
};

export function StatusPill({ tone, text }: { tone: StatusTone; text: string }) {
  const t = TONES[tone];
  const live = tone === "you" || tone === "speaking" || tone === "turn";
  return (
    <div role="status" aria-live="polite" className={`flex min-w-0 items-center gap-3 rounded-full border-2 border-line px-4 py-2.5 ${t.bg}`}>
      <span className={`relative h-3 w-3 shrink-0 rounded-full ${t.dot} ${live ? "pulse-ring" : ""}`} style={{ color: "currentcolor" }} />
      <span className="text-lg" aria-hidden>{t.icon}</span>
      <span className="truncate text-[15px] font-bold sm:text-base">{text}</span>
    </div>
  );
}

type ControlsProps = {
  micOn: boolean;
  hearing: boolean;
  paused: boolean;
  phase: string | undefined;
  disabled: boolean;
  onToggleMic: () => void;
  onRaiseHand: () => void;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  onHint: () => void;
  onSendText: (text: string) => void;
};

export function Controls(p: ControlsProps) {
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");

  const btn =
    "flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 font-bold transition hover:border-marigold active:translate-y-0.5 disabled:opacity-40 sm:px-4";

  return (
    <div className="flex flex-col gap-3">
      {typing && (
        <form
          className="flex gap-2 animate-rise"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            p.onSendText(text.trim());
            setText("");
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type to Ma'am… (Hinglish is fine!)"
            className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg outline-none focus:border-marigold"
          />
          <button className="rounded-2xl bg-ink px-5 font-bold text-paper" disabled={!text.trim()}>
            Send
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={p.onToggleMic}
          data-tour="mic"
          disabled={p.disabled || p.paused}
          aria-pressed={p.micOn}
          className={`relative flex items-center gap-2 rounded-2xl border-2 px-3.5 py-2.5 font-bold transition active:translate-y-0.5 disabled:opacity-40 sm:px-4 ${
            p.micOn
              ? `border-leaf bg-leaf text-white ring-4 ${p.hearing ? "ring-leaf/60 animate-pulse" : "ring-leaf/25"}`
              : "border-coral bg-coral/10 text-coral"
          }`}
          title={p.micOn ? "Your mic is on. Tap to mute" : "Your mic is off. Tap to turn it on"}
        >
          <span aria-hidden>{p.micOn ? "🎤" : "🔇"}</span>
          <span className="hidden sm:inline">{p.micOn ? "Mic on" : "Mic off"}</span>
          {p.micOn && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-chalk-green ring-2 ring-white" aria-hidden />}
        </button>
        <button onClick={p.onRaiseHand} disabled={p.disabled || p.paused} className={btn} data-tour="hand">
          <span aria-hidden>✋</span> Raise hand
        </button>
        {p.paused ? (
          <button
            onClick={p.onResume}
            disabled={p.disabled}
            className="flex items-center gap-2 rounded-2xl border-2 border-leaf bg-leaf px-4 py-2.5 font-bold text-white shadow-[0_4px_0_#2c6b42] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
          >
            <span aria-hidden>▶</span> Resume
          </button>
        ) : (
          <button onClick={p.onPause} disabled={p.disabled} className={btn} data-tour="pause">
            <span aria-hidden>⏸</span> <span className="hidden sm:inline">Pause</span>
          </button>
        )}
        <button
          onClick={() => setTyping((t) => !t)}
          disabled={p.disabled || p.paused}
          className={btn}
          aria-pressed={typing}
          data-tour="type"
        >
          <span aria-hidden>⌨️</span> <span className="hidden sm:inline">Type</span>
        </button>
        <div className="ml-auto flex gap-2">
          {p.phase === "question" && (
            <button onClick={p.onHint} disabled={p.disabled || p.paused} className={btn} data-tour="hint">
              <span aria-hidden>💡</span> Hint
            </button>
          )}
          {p.phase === "check" && (
            <button
              onClick={p.onContinue}
              disabled={p.disabled || p.paused}
              className="rounded-2xl bg-leaf px-5 py-2.5 font-bold text-white shadow-[0_4px_0_#2c6b42] transition active:translate-y-1 active:shadow-none disabled:opacity-40"
            >
              No doubts, next ▶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

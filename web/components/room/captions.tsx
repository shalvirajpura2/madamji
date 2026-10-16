"use client";

import { useEffect, useRef } from "react";

// keeps the newest words in view as the teacher speaks, like live subtitles
export function Captions({ text, className = "" }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [text]);

  return (
    <div
      ref={box}
      className={`overflow-y-auto overscroll-contain [scrollbar-width:thin] ${className}`}
      style={{ maskImage: "linear-gradient(to bottom, transparent 0, black 1.2em)" }}
    >
      <p className="pt-3">{text || "…"}</p>
    </div>
  );
}

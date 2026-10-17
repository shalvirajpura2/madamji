"use client";

import { createElement, useMemo, type ReactNode } from "react";

// Renders Ma'am's live sketch. The agent already cleaned it; this rebuilds it from an allowlist
// as React elements (never innerHTML), so nothing outside plain shapes can reach the page.

const TAGS = new Set(["svg", "g", "line", "polyline", "polygon", "path", "circle", "ellipse", "rect", "text"]);
const ATTRS: Record<string, string> = {
  viewBox: "viewBox", x: "x", y: "y", x1: "x1", y1: "y1", x2: "x2", y2: "y2", cx: "cx", cy: "cy", r: "r",
  rx: "rx", ry: "ry", width: "width", height: "height", d: "d", points: "points", fill: "fill", stroke: "stroke",
  "stroke-width": "strokeWidth", "stroke-dasharray": "strokeDasharray", "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin", "font-size": "fontSize", "text-anchor": "textAnchor",
  transform: "transform", opacity: "opacity",
};
const COLORS: Record<string, string> = {
  chalk: "var(--color-chalk)",
  yellow: "var(--color-chalk-yellow)",
  pink: "var(--color-chalk-pink)",
  blue: "var(--color-chalk-blue)",
  green: "var(--color-chalk-green)",
  none: "none",
};
const SAFE = /^[a-zA-Z0-9 .,#%()-]*$/;

function build(node: Element, key: string): ReactNode {
  const tag = node.tagName;
  if (!TAGS.has(tag)) return null;
  const props: Record<string, string> = { key };
  for (const { name, value } of Array.from(node.attributes)) {
    const prop = ATTRS[name];
    if (!prop || !SAFE.test(value) || /url/i.test(value)) continue;
    props[prop] = name === "fill" || name === "stroke" ? COLORS[value] ?? (name === "fill" ? "none" : COLORS.chalk) : value;
  }
  if (tag === "text") {
    return createElement("text", { fontFamily: "var(--font-kalam)", fill: COLORS.chalk, ...props }, (node.textContent ?? "").slice(0, 40));
  }
  const children = Array.from(node.children).map((c, i) => build(c, `${key}-${i}`));
  return createElement(tag, props, ...children);
}

export function Sketch({ svg }: { svg: string }) {
  const tree = useMemo(() => {
    if (typeof window === "undefined") return null;
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;
    if (root.tagName !== "svg" || doc.getElementsByTagName("parsererror").length) return null;
    return Array.from(root.children).map((c, i) => build(c, String(i)));
  }, [svg]);

  if (!tree) return null;
  return (
    <svg
      viewBox="0 0 280 140"
      className="chalk-draw h-full max-h-56 w-full"
      fill="none"
      stroke="var(--color-chalk)"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Ma'am's sketch"
    >
      {tree}
    </svg>
  );
}

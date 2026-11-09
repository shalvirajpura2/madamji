import { NextResponse } from "next/server";
import { log } from "./activity";
import { store } from "./store";

// rate limits live in supabase so every vercel instance shares the same counters.
// if supabase is unreachable we fall back to this instance's memory rather than letting everything through.

const memory = new Map<string, number>();

export async function hit(key: string, windowSeconds: number, add = 1): Promise<number> {
  try {
    return await store.hitRateLimit(key, windowSeconds, add);
  } catch (e) {
    console.error("rate limit store unavailable, using memory", e);
    const slot = `${key}|${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const n = (memory.get(slot) ?? 0) + add;
    memory.set(slot, n);
    if (memory.size > 5000) memory.clear();
    return n;
  }
}

type Who = { ip: string; studentId?: string; email?: string };

/**
 * Counts one request against a limit. Returns a ready 429 response when the limit is hit, or null to carry on.
 * Only the first blocked request in a window is logged, so a flood doesn't flood the activity log too.
 */
export async function limit(
  name: string,
  key: string,
  [max, windowSeconds]: readonly [number, number],
  who: Who,
  message = "Too many requests. Please wait a little and try again.",
): Promise<NextResponse | null> {
  const n = await hit(`${name}:${key}`, windowSeconds);
  if (n <= max) return null;
  if (n === max + 1) {
    log({ kind: "rate_limited", studentId: who.studentId, email: who.email, ip: who.ip, detail: { limit: name, max, windowSeconds } });
  }
  const retry = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(retry) } });
}

/** the visitor's ip. on vercel x-real-ip and x-forwarded-for are set by vercel itself, not the browser */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || forwarded || "local").slice(0, 64);
}

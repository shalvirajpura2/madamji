import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { log } from "./activity";
import { LIMITS } from "./limits";
import { clientIp, hit, limit } from "./rate-limit";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const LOCKED = "Too many wrong passcodes. Try again in 15 minutes.";

/** Checks the staff passcode. Too many wrong guesses lock the ip out, even for the right one. */
export async function checkStaff(req: Request, passcode: unknown): Promise<NextResponse | null> {
  const ip = clientIp(req);
  const blocked = await limit("staff", ip, LIMITS.staffIp, { ip });
  if (blocked) return blocked;

  const [maxFails, window] = LIMITS.staffFailIp;
  const failKey = `staff_fail:${ip}`;
  if ((await hit(failKey, window, 0)) >= maxFails) {
    return NextResponse.json({ error: LOCKED }, { status: 429 });
  }

  const expected = process.env.STAFF_PASSCODE;
  if (!expected || typeof passcode !== "string" || !same(passcode, expected)) {
    const fails = await hit(failKey, window);
    log({ kind: "staff_login_failed", ip, detail: { attempts: fails } });
    return NextResponse.json({ error: fails >= maxFails ? LOCKED : "Wrong passcode" }, { status: fails >= maxFails ? 429 : 401 });
  }
  return null;
}

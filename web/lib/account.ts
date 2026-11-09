"use client";

import { useCallback, useEffect, useState } from "react";
import type { Trial } from "./store/types";
import { clearStudent, type Student } from "./student";
import { authEnabled } from "./supabase/config";
import { supabaseBrowser } from "./supabase/browser";

export type { Trial };

// what /api/me says: auth=false means sign-in isn't set up (local dev only)
export type Me =
  | { auth: false; trial: Trial | null }
  | { auth: true; user: null }
  | { auth: true; user: { id: string; email: string; name: string }; profile: Student | null; trial: Trial | null };

export const trialOf = (me: Me | null): Trial | null => (me && "trial" in me ? me.trial : null);

/** free classes left, per length and in total */
export function classesLeft(trial: Trial) {
  const long = Math.max(0, trial.long.max - trial.long.used);
  const short = Math.max(0, trial.short.max - trial.short.used);
  return { long, short, total: long + short };
}

/** the signed-in account and its trial. studentId is only used in local dev, where there is no sign-in */
export function useMe(studentId?: string) {
  const [me, setMe] = useState<Me | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    const query = !authEnabled && studentId ? `?id=${encodeURIComponent(studentId)}` : "";
    fetch(`/api/me${query}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Me) => alive && setMe(d))
      .catch(() => alive && setMe({ auth: false, trial: null }));
    return () => {
      alive = false;
    };
  }, [studentId, version]);

  return { me, reload };
}

export async function signOut() {
  if (authEnabled) await supabaseBrowser().auth.signOut().catch(() => {});
  clearStudent();
}

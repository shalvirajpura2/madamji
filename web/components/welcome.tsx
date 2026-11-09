"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { Teacher } from "@/components/teacher";
import { TrialBadge } from "@/components/trial-badge";
import { signOut as endSession, trialOf, type Me } from "@/lib/account";
import { clearStudent, newStudentId, saveStudent, useStudent, type Student } from "@/lib/student";
import { supabaseBrowser } from "@/lib/supabase/browser";

const GRADES = [
  { grade: 6, label: "Class 6", note: "Curiosity book · stories & experiments", color: "bg-sky/10 border-sky" },
  { grade: 10, label: "Class 10", note: "Board exam prep · concepts & numericals", color: "bg-plum/10 border-plum" },
];

export function Welcome() {
  const student = useStudent();
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const failed = new URLSearchParams(window.location.search).get("signin") === "failed";
    if (failed) window.history.replaceState(null, "", "/");
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Me) => {
        if (!alive) return;
        if (failed) setError("Google sign-in didn't finish. Please try again.");
        setMe(d);
        if (!d.auth) return;
        if (!d.user) clearStudent();
        else if (d.profile) saveStudent(d.profile);
        else {
          clearStudent();
          setName(d.user.name.slice(0, 40));
        }
      })
      .catch(() => alive && setMe({ auth: false, trial: null }));
    return () => {
      alive = false;
    };
  }, []);

  const ready = name.trim().length > 0 && grade !== null;
  const signedIn = me?.auth ? me.user : null;
  const signedOut = me?.auth === true && !me.user;

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError("Couldn't open Google sign-in. Please try again.");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await endSession();
    setName("");
    setGrade(null);
    setEditing(false);
    setMe({ auth: true, user: null });
    setBusy(false);
  }

  async function start() {
    if (!ready || busy) return;
    const profile = { id: signedIn?.id ?? student?.id ?? newStudentId(), name: name.trim(), grade: grade! };
    setBusy(true);
    setError(null);
    const res = await fetch("/api/students", { method: "POST", body: JSON.stringify(profile) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { profile?: Student; error?: string } | null;
    setBusy(false);
    if (signedIn && !res?.ok) {
      setError(
        res?.status === 401
          ? "Your sign-in expired. Please sign in again."
          : (data?.error ?? "Couldn't save your profile. Please try again."),
      );
      return;
    }
    // the server keeps the name a student first chose
    saveStudent(data?.profile ?? profile);
    router.push("/learn");
  }

  const loading = student === undefined || me === null;
  const returning = !signedOut && student && !editing;
  const bubble = signedOut
    ? "Namaste! Main Meera Ma'am hoon, aapki science teacher. Chalo, pehle sign in karte hain!"
    : returning
    ? `Arre ${student.name}, welcome back! Chalo, aaj kya padhenge?`
    : "Namaste! Main Meera Ma'am hoon, aapki science teacher. Aapka naam kya hai?";

  return (
    <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col items-center text-center md:items-start md:text-left">
        <div className="mb-4 flex flex-col items-center gap-2 md:items-start">
          <Logo size="lg" href={null} />
          <p className="rounded-full bg-marigold/15 px-3 py-1 text-sm font-semibold text-marigold-deep">
            Your voice science class · Class 6 &amp; 10
          </p>
        </div>
        <h1 className="text-4xl leading-tight font-extrabold sm:text-5xl">
          Learn science by <span className="text-leaf">talking</span> to your teacher
        </h1>
        <div className="relative mt-6 flex items-end gap-3">
          <Teacher pose="speaking" mood="happy" wave className="h-52 w-40 shrink-0 animate-float sm:h-64 sm:w-48" />
          <div className="paper-card relative mb-16 max-w-60 rounded-2xl rounded-bl-sm px-4 py-3 text-left text-[15px] font-medium animate-pop">
            {loading ? "…" : bubble}
          </div>
        </div>
      </section>

      <section className="paper-card rounded-3xl p-6 sm:p-8 animate-rise">
        {error && (
          <p role="alert" className="mb-5 rounded-2xl bg-marigold/15 px-4 py-3 font-semibold text-marigold-deep">
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-10 text-center text-ink-soft">Getting your classroom ready…</p>
        ) : signedOut ? (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-2xl font-extrabold">Sign in to start learning</h2>
              <p className="mt-1 text-ink-soft">
                Ma&apos;am remembers your progress on every device.
              </p>
            </div>
            <button
              onClick={signInWithGoogle}
              disabled={busy}
              className="flex items-center justify-center gap-3 rounded-2xl border-2 border-line bg-white px-6 py-4 text-xl font-bold text-ink shadow-[0_5px_0_var(--color-line)] transition enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-60"
            >
              <GoogleMark />
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
          </div>
        ) : returning ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-ink-soft">{signedIn ? `Signed in as ${signedIn.email}` : "Signed in on this device as"}</p>
              <p className="text-3xl font-bold">
                {student.name} <span className="text-lg font-semibold text-ink-soft">· Class {student.grade}</span>
              </p>
            </div>
            <Link
              href="/learn"
              className="rounded-2xl bg-leaf px-6 py-4 text-center text-xl font-bold text-white shadow-[0_5px_0_#2c6b42] transition active:translate-y-1 active:shadow-none"
            >
              Go to my chapters →
            </Link>
            {trialOf(me) && <TrialBadge trial={trialOf(me)!} className="text-center text-[15px]" />}
            {signedIn ? (
              <button
                onClick={signOut}
                disabled={busy}
                className="text-sm font-semibold text-ink-soft underline underline-offset-4"
              >
                Not {student.name}? Sign out
              </button>
            ) : (
              <button
                onClick={() => {
                  setName("");
                  setGrade(null);
                  setEditing(true);
                  clearStudent();
                }}
                className="text-sm font-semibold text-ink-soft underline underline-offset-4"
              >
                Not {student.name}? Start as someone else
              </button>
            )}
          </div>
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-lg font-bold">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="given-name"
                placeholder="e.g. Aarav"
                className="rounded-2xl border-2 border-line bg-paper px-4 py-3 text-xl font-semibold outline-none focus:border-marigold"
              />
              {signedIn && (
                <span className="text-sm text-ink-soft">
                  This is how Ma&apos;am will call you. You can&apos;t change it later, so check the spelling.
                </span>
              )}
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-lg font-bold">Which class are you in?</legend>
              <div className="grid grid-cols-2 gap-3">
                {GRADES.map((g) => (
                  <button
                    type="button"
                    key={g.grade}
                    onClick={() => setGrade(g.grade)}
                    aria-pressed={grade === g.grade}
                    className={`rounded-2xl border-2 p-4 text-left transition ${
                      grade === g.grade ? `${g.color} scale-[1.02] border-[3px]` : "border-line bg-paper hover:border-marigold"
                    }`}
                  >
                    <span className="block text-2xl font-extrabold">{g.label}</span>
                    <span className="mt-1 block text-sm leading-snug text-ink-soft">{g.note}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="submit"
              disabled={!ready || busy}
              className="rounded-2xl bg-marigold px-6 py-4 text-xl font-bold text-ink shadow-[0_5px_0_var(--color-marigold-deep)] transition enabled:active:translate-y-1 enabled:active:shadow-none disabled:opacity-40"
            >
              {busy ? "Saving…" : "Chalo, class chalein →"}
            </button>
            {signedIn ? (
              <p className="text-center text-sm text-ink-soft">
                Signed in as {signedIn.email}.{" "}
                <button type="button" onClick={signOut} className="font-semibold underline underline-offset-4">
                  Sign out
                </button>
              </p>
            ) : (
              <p className="text-center text-sm text-ink-soft">
                No sign-up. Your name stays on this device and helps Ma&apos;am remember you.
              </p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

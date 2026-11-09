import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  classFailed,
  countsForTrial,
  mergeFacts,
  mergeProgress,
  type ActivityRecord,
  type AlertRecord,
  type ClaimResult,
  type ClassRecord,
  type ProgressRecord,
  type Store,
  type StudentRecord,
  type TranscriptRecord,
} from "./types";

// local development only: one json file next to the app
type Data = {
  students: Record<string, StudentRecord>;
  progress: ProgressRecord[];
  alerts: AlertRecord[];
  classes?: ClassRecord[];
  activity?: ActivityRecord[];
};

// rate limits only need to live as long as the dev server
const hits = new Map<string, number>();

const file = path.join(process.cwd(), ".data", "store.json");
// transcripts are big, so each class gets its own file
const transcripts = path.join(process.cwd(), ".data", "transcripts");
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Data> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Data;
  } catch {
    return { students: {}, progress: [], alerts: [] };
  }
}

function update(change: (data: Data) => void): Promise<void> {
  const run = queue.then(async () => {
    const data = await load();
    change(data);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2));
  });
  queue = run.catch(() => {});
  return run;
}

export const fileStore: Store = {
  async getStudent(id) {
    return (await load()).students[id] ?? null;
  },
  saveStudent(student) {
    return update((d) => {
      const old = d.students[student.id];
      d.students[student.id] = {
        ...student,
        email: student.email || old?.email || "",
        facts: old?.facts ?? [],
        updatedAt: new Date().toISOString(),
      };
    });
  },
  addFact(studentId, fact) {
    return update((d) => {
      const s = d.students[studentId];
      if (s) s.facts = mergeFacts(s.facts, fact);
    });
  },
  async listProgress(studentId) {
    return (await load()).progress.filter((p) => p.studentId === studentId);
  },
  saveProgress(next) {
    return update((d) => {
      const i = d.progress.findIndex((p) => p.studentId === next.studentId && p.chapterId === next.chapterId);
      const merged = mergeProgress(d.progress[i], next);
      if (i >= 0) d.progress[i] = merged;
      else d.progress.push(merged);
    });
  },
  addAlert(alert) {
    return update((d) => {
      const id = (d.alerts.at(-1)?.id ?? 0) + 1;
      d.alerts.push({ ...alert, id, createdAt: new Date().toISOString() });
    });
  },
  async listAlerts(limit = 100) {
    return (await load()).alerts.slice(-limit).reverse();
  },
  async saveTranscript(record) {
    await mkdir(transcripts, { recursive: true });
    await writeFile(path.join(transcripts, `${safeId(record.id)}.json`), JSON.stringify(record));
  },
  async listTranscripts(limit = 50) {
    let names: string[] = [];
    try {
      names = await readdir(transcripts);
    } catch {
      return [];
    }
    const all = await Promise.all(
      names.filter((n) => n.endsWith(".json")).map(async (n) => {
        const { entries, ...summary } = JSON.parse(await readFile(path.join(transcripts, n), "utf8")) as TranscriptRecord;
        return { ...summary, turns: entries.length };
      }),
    );
    return all.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  },
  async getTranscript(id) {
    try {
      return JSON.parse(await readFile(path.join(transcripts, `${safeId(id)}.json`), "utf8")) as TranscriptRecord;
    } catch {
      return null;
    }
  },
  async claimClass(c, limits) {
    let result: ClaimResult = "ok";
    await update((d) => {
      const classes = (d.classes ??= []);
      const now = Date.now();
      const original = classes.find(
        (x) =>
          x.studentId === c.studentId &&
          x.chapterId === c.chapterId &&
          x.minutes === c.minutes &&
          countsForTrial(x) &&
          now - Date.parse(x.createdAt) < (c.minutes + 5) * 60_000,
      );
      const long = c.minutes >= 25;
      const used = classes.filter((x) => x.studentId === c.studentId && countsForTrial(x) && x.minutes >= 25 === long);
      const ipUsed = classes.filter(
        (x) => x.ip === c.ip && countsForTrial(x) && now - Date.parse(x.createdAt) < 86_400_000,
      );
      if (original) result = "rejoin";
      else if (used.length >= (long ? limits.long : limits.short)) result = "trial_used";
      else if (limits.ipPerDay > 0 && ipUsed.length >= limits.ipPerDay) result = "ip_limit";
      if (result !== "ok" && result !== "rejoin") return;
      classes.unshift({
        ...c,
        status: "started",
        trialOf: original?.id ?? null,
        createdAt: new Date().toISOString(),
        endedAt: null,
        durationSeconds: null,
        sectionsDone: null,
        sections: null,
        completed: null,
        error: null,
      });
    });
    return result;
  },
  async finishClass(id, end) {
    let done: ClassRecord | null = null;
    await update((d) => {
      const classes = d.classes ?? [];
      const row = classes.find((x) => x.id === id);
      if (!row) return;
      const failed = classFailed(end) && !classes.some((x) => x.trialOf === id);
      Object.assign(row, { ...end, status: failed ? "failed" : "finished" });
      done = { ...row };
    });
    return done;
  },
  async listClassesFor(studentId) {
    return ((await load()).classes ?? []).filter((c) => c.studentId === studentId);
  },
  async listClasses(limit = 200) {
    return ((await load()).classes ?? []).slice(0, limit);
  },
  logActivity(a) {
    return update((d) => {
      const list = (d.activity ??= []);
      list.unshift({
        studentId: "",
        email: "",
        ip: "",
        detail: {},
        ...a,
        id: (list[0]?.id ?? 0) + 1,
        createdAt: new Date().toISOString(),
      });
      list.splice(2000);
    });
  },
  async listActivity(limit = 200) {
    return ((await load()).activity ?? []).slice(0, limit);
  },
  async hitRateLimit(key, windowSeconds, add = 1) {
    const slot = `${key}|${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const n = (hits.get(slot) ?? 0) + add;
    hits.set(slot, n);
    if (hits.size > 5000) hits.clear();
    return n;
  },
};

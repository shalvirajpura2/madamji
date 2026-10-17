import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  mergeFacts,
  mergeProgress,
  type AlertRecord,
  type ProgressRecord,
  type Store,
  type StudentRecord,
  type TranscriptRecord,
} from "./types";

// local development only: one json file next to the app
type Data = { students: Record<string, StudentRecord>; progress: ProgressRecord[]; alerts: AlertRecord[] };

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
      d.students[student.id] = { ...student, facts: old?.facts ?? [], updatedAt: new Date().toISOString() };
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
};

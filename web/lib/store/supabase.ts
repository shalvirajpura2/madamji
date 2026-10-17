import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mergeFacts, mergeProgress, type AlertRecord, type ProgressRecord, type Store, type TranscriptRecord } from "./types";

// tables are created by web/supabase/schema.sql; only the server talks to supabase

let client: SupabaseClient | null = null;

function db() {
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type ProgressRow = {
  student_id: string;
  chapter_id: string;
  sections_done: number;
  sections: number;
  completed: boolean;
  correct: number;
  attempted: number;
  recap: string;
  updated_at: string;
};

const fromRow = (r: ProgressRow): ProgressRecord => ({
  studentId: r.student_id,
  chapterId: r.chapter_id,
  sectionsDone: r.sections_done,
  sections: r.sections,
  completed: r.completed,
  correct: r.correct,
  attempted: r.attempted,
  recap: r.recap,
  updatedAt: r.updated_at,
});

export const supabaseStore: Store = {
  async getStudent(id) {
    const { data, error } = await db().from("students").select("*").eq("id", id).maybeSingle();
    fail(error);
    return data ? { id: data.id, name: data.name, grade: data.grade, facts: data.facts ?? [], updatedAt: data.updated_at } : null;
  },
  async saveStudent(s) {
    const { error } = await db()
      .from("students")
      .upsert({ id: s.id, name: s.name, grade: s.grade, updated_at: new Date().toISOString() });
    fail(error);
  },
  async addFact(studentId, fact) {
    const student = await this.getStudent(studentId);
    if (!student) return;
    const { error } = await db().from("students").update({ facts: mergeFacts(student.facts, fact) }).eq("id", studentId);
    fail(error);
  },
  async listProgress(studentId) {
    const { data, error } = await db().from("progress").select("*").eq("student_id", studentId);
    fail(error);
    return (data as ProgressRow[]).map(fromRow);
  },
  async saveProgress(next) {
    const { data, error } = await db()
      .from("progress")
      .select("*")
      .eq("student_id", next.studentId)
      .eq("chapter_id", next.chapterId)
      .maybeSingle();
    fail(error);
    const m = mergeProgress(data ? fromRow(data as ProgressRow) : undefined, next);
    const res = await db().from("progress").upsert({
      student_id: m.studentId,
      chapter_id: m.chapterId,
      sections_done: m.sectionsDone,
      sections: m.sections,
      completed: m.completed,
      correct: m.correct,
      attempted: m.attempted,
      recap: m.recap,
      updated_at: m.updatedAt,
    });
    fail(res.error);
  },
  async addAlert(a) {
    const { error } = await db().from("alerts").insert({
      student_id: a.studentId,
      student_name: a.studentName,
      chapter_id: a.chapterId,
      severity: a.severity,
      category: a.category,
      summary: a.summary,
      quote: a.quote,
      source: a.source,
    });
    fail(error);
  },
  async saveTranscript(record) {
    const { error } = await db().from("transcripts").upsert({
      id: record.id,
      student_id: record.studentId,
      chapter_id: record.chapterId,
      chapter_version: record.chapterVersion,
      started_at: new Date(record.startedAt).toISOString(),
      data: record,
    });
    fail(error);
  },
  async listTranscripts(limit = 50) {
    const { data, error } = await db()
      .from("transcripts")
      .select("data")
      .order("started_at", { ascending: false })
      .limit(limit);
    fail(error);
    return (data ?? []).map((row) => {
      const { entries, ...summary } = row.data as TranscriptRecord;
      return { ...summary, turns: entries.length };
    });
  },
  async getTranscript(id) {
    const { data, error } = await db().from("transcripts").select("data").eq("id", id).maybeSingle();
    fail(error);
    return (data?.data as TranscriptRecord) ?? null;
  },
  async listAlerts(limit = 100) {
    const { data, error } = await db().from("alerts").select("*").order("id", { ascending: false }).limit(limit);
    fail(error);
    return (data ?? []).map(
      (r): AlertRecord => ({
        id: r.id,
        createdAt: r.created_at,
        studentId: r.student_id,
        studentName: r.student_name,
        chapterId: r.chapter_id,
        severity: r.severity,
        category: r.category,
        summary: r.summary,
        quote: r.quote,
        source: r.source,
      }),
    );
  },
};

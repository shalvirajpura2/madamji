import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  classFailed,
  mergeFacts,
  mergeProgress,
  type ActivityRecord,
  type AlertRecord,
  type ClaimResult,
  type ClassRecord,
  type ProgressRecord,
  type Store,
  type TranscriptRecord,
} from "./types";

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

type ClassRow = {
  id: string;
  student_id: string;
  student_name: string;
  email: string;
  ip: string;
  user_agent: string;
  chapter_id: string;
  minutes: number;
  status: ClassRecord["status"];
  trial_of: string | null;
  created_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  sections_done: number | null;
  sections: number | null;
  completed: boolean | null;
  error: string | null;
};

const fromClassRow = (r: ClassRow): ClassRecord => ({
  id: r.id,
  studentId: r.student_id,
  studentName: r.student_name,
  email: r.email,
  ip: r.ip,
  userAgent: r.user_agent,
  chapterId: r.chapter_id,
  minutes: r.minutes,
  status: r.status,
  trialOf: r.trial_of,
  createdAt: r.created_at,
  endedAt: r.ended_at,
  durationSeconds: r.duration_seconds,
  sectionsDone: r.sections_done,
  sections: r.sections,
  completed: r.completed,
  error: r.error,
});

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
    return data
      ? {
          id: data.id,
          name: data.name,
          grade: data.grade,
          email: data.email ?? "",
          facts: data.facts ?? [],
          updatedAt: data.updated_at,
        }
      : null;
  },
  async saveStudent(s) {
    const { error } = await db()
      .from("students")
      .upsert({
        id: s.id,
        name: s.name,
        grade: s.grade,
        ...(s.email ? { email: s.email } : {}),
        updated_at: new Date().toISOString(),
      });
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
  async claimClass(c, limits) {
    const { data, error } = await db().rpc("claim_class", {
      p_id: c.id,
      p_student: c.studentId,
      p_name: c.studentName,
      p_email: c.email,
      p_ip: c.ip,
      p_user_agent: c.userAgent,
      p_chapter: c.chapterId,
      p_minutes: c.minutes,
      p_max_long: limits.long,
      p_max_short: limits.short,
      p_ip_per_day: limits.ipPerDay,
    });
    fail(error);
    return data as ClaimResult;
  },
  async finishClass(id, end) {
    const { data: row, error } = await db().from("class_sessions").select("*").eq("id", id).maybeSingle();
    fail(error);
    if (!row) return null;
    let failed = classFailed(end);
    if (failed) {
      // a class someone rejoined was real, even if this first part was short
      const { count, error: e } = await db()
        .from("class_sessions")
        .select("id", { count: "exact", head: true })
        .eq("trial_of", id);
      fail(e);
      failed = !count;
    }
    const { data, error: e2 } = await db()
      .from("class_sessions")
      .update({
        status: failed ? "failed" : "finished",
        ended_at: end.endedAt,
        duration_seconds: end.durationSeconds,
        sections_done: end.sectionsDone,
        sections: end.sections,
        completed: end.completed,
        error: end.error,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    fail(e2);
    return data ? fromClassRow(data as ClassRow) : null;
  },
  async listClassesFor(studentId) {
    const { data, error } = await db()
      .from("class_sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    fail(error);
    return (data as ClassRow[]).map(fromClassRow);
  },
  async listClasses(limit = 200) {
    const { data, error } = await db()
      .from("class_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    fail(error);
    return (data as ClassRow[]).map(fromClassRow);
  },
  async logActivity(a) {
    const { error } = await db().from("activity").insert({
      kind: a.kind,
      student_id: a.studentId ?? "",
      email: a.email ?? "",
      ip: a.ip ?? "",
      detail: a.detail ?? {},
    });
    fail(error);
  },
  async listActivity(limit = 200) {
    const { data, error } = await db().from("activity").select("*").order("id", { ascending: false }).limit(limit);
    fail(error);
    return (data ?? []).map(
      (r): ActivityRecord => ({
        id: r.id,
        createdAt: r.created_at,
        kind: r.kind,
        studentId: r.student_id,
        email: r.email,
        ip: r.ip,
        detail: r.detail ?? {},
      }),
    );
  },
  async hitRateLimit(key, windowSeconds, add = 1) {
    const { data, error } = await db().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds, p_add: add });
    fail(error);
    return Number(data);
  },
};

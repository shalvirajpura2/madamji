export type StudentRecord = {
  id: string;
  name: string;
  grade: number;
  email?: string;
  facts: string[];
  updatedAt: string;
};

export type ProgressRecord = {
  studentId: string;
  chapterId: string;
  sectionsDone: number;
  sections: number;
  completed: boolean;
  correct: number;
  attempted: number;
  recap: string;
  updatedAt: string;
};

export type AlertRecord = {
  id: number;
  createdAt: string;
  studentId: string;
  studentName: string;
  chapterId: string;
  severity: "medium" | "high";
  category: string;
  summary: string;
  quote: string;
  source: string;
};

export type NewAlert = Omit<AlertRecord, "id" | "createdAt">;

export type TranscriptEntry = { t: number; kind: "step" | "teacher" | "student" | "tool" | "event" } & Record<string, unknown>;

export type TranscriptRecord = {
  id: string;
  studentId: string;
  studentName: string;
  grade: number;
  chapterId: string;
  chapterTitle: string;
  chapterVersion: string;
  minutes: number;
  startedAt: number;
  endedAt: number;
  sectionsDone: number;
  sections: number;
  error?: string;
  models?: Record<string, string>;
  completed?: boolean;
  firstTryCorrect?: number;
  questions?: number;
  language?: string;
  doubts?: { text: string; answered: boolean }[];
  entries: TranscriptEntry[];
};

export type TranscriptSummary = Omit<TranscriptRecord, "entries"> & { turns?: number };

export type ClassStatus = "started" | "finished" | "failed";

export type ClassRecord = {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  ip: string;
  userAgent: string;
  chapterId: string;
  minutes: number;
  status: ClassStatus;
  trialOf: string | null;
  createdAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  sectionsDone: number | null;
  sections: number | null;
  completed: boolean | null;
  error: string | null;
};

export type NewClass = Pick<ClassRecord, "id" | "studentId" | "studentName" | "email" | "ip" | "userAgent" | "chapterId" | "minutes">;

export type ClassLimits = { long: number; short: number; ipPerDay: number };

export type ClaimResult = "ok" | "rejoin" | "trial_used" | "ip_limit";

export type ClassEnd = {
  endedAt: string;
  durationSeconds: number;
  sectionsDone: number;
  sections: number;
  completed: boolean;
  error: string | null;
};

/** what /api/me shows the student: free classes used and allowed, per length */
export type Trial = { long: { used: number; max: number }; short: { used: number; max: number } };

/** trial classes a student has used, split by length */
export type TrialUsage = { long: number; short: number };

export type ActivityKind =
  | "signed_in"
  | "profile_created"
  | "class_started"
  | "class_rejoined"
  | "class_finished"
  | "class_blocked"
  | "rate_limited"
  | "staff_login_failed";

export type ActivityRecord = {
  id: number;
  createdAt: string;
  kind: ActivityKind;
  studentId: string;
  email: string;
  ip: string;
  detail: Record<string, unknown>;
};

export type NewActivity = Omit<ActivityRecord, "id" | "createdAt" | "studentId" | "email" | "ip" | "detail"> &
  Partial<Pick<ActivityRecord, "studentId" | "email" | "ip" | "detail">>;

/** a class counts against the trial unless it is a rejoin or failed in the first minute */
export const countsForTrial = (c: Pick<ClassRecord, "trialOf" | "status">) => !c.trialOf && c.status !== "failed";

export function trialUsage(classes: Pick<ClassRecord, "trialOf" | "status" | "minutes">[]): TrialUsage {
  const counted = classes.filter(countsForTrial);
  return { long: counted.filter((c) => c.minutes >= 25).length, short: counted.filter((c) => c.minutes < 25).length };
}

/** short classes that taught nothing (the line dropped, the mic never worked) give the class back */
export const classFailed = (end: Pick<ClassEnd, "durationSeconds" | "sectionsDone">) =>
  end.durationSeconds < 60 && end.sectionsDone === 0;

export interface Store {
  getStudent(id: string): Promise<StudentRecord | null>;
  saveStudent(student: Pick<StudentRecord, "id" | "name" | "grade" | "email">): Promise<void>;
  addFact(studentId: string, fact: string): Promise<void>;
  listProgress(studentId: string): Promise<ProgressRecord[]>;
  saveProgress(progress: Omit<ProgressRecord, "updatedAt">): Promise<void>;
  addAlert(alert: NewAlert): Promise<void>;
  listAlerts(limit?: number): Promise<AlertRecord[]>;
  saveTranscript(record: TranscriptRecord): Promise<void>;
  listTranscripts(limit?: number): Promise<TranscriptSummary[]>;
  getTranscript(id: string): Promise<TranscriptRecord | null>;

  /** atomically checks the trial and per-ip limits and records the class */
  claimClass(c: NewClass, limits: ClassLimits): Promise<ClaimResult>;
  finishClass(id: string, end: ClassEnd): Promise<ClassRecord | null>;
  listClassesFor(studentId: string): Promise<ClassRecord[]>;
  listClasses(limit?: number): Promise<ClassRecord[]>;

  logActivity(a: NewActivity): Promise<void>;
  listActivity(limit?: number): Promise<ActivityRecord[]>;

  /** adds hits (default 1, 0 just reads) and returns the key's hits in the current window */
  hitRateLimit(key: string, windowSeconds: number, add?: number): Promise<number>;
}

export function mergeProgress(
  old: ProgressRecord | undefined,
  next: Omit<ProgressRecord, "updatedAt">,
): ProgressRecord {
  const completed = Boolean(old?.completed || next.completed);
  return {
    ...next,
    completed,
    sectionsDone: Math.max(old?.sectionsDone ?? 0, next.sectionsDone),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeFacts(facts: string[], fact: string): string[] {
  const clean = fact.trim().slice(0, 120);
  if (!clean || facts.some((f) => f.toLowerCase() === clean.toLowerCase())) return facts;
  return [...facts, clean].slice(-8);
}

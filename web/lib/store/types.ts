export type StudentRecord = {
  id: string;
  name: string;
  grade: number;
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

export interface Store {
  getStudent(id: string): Promise<StudentRecord | null>;
  saveStudent(student: Pick<StudentRecord, "id" | "name" | "grade">): Promise<void>;
  addFact(studentId: string, fact: string): Promise<void>;
  listProgress(studentId: string): Promise<ProgressRecord[]>;
  saveProgress(progress: Omit<ProgressRecord, "updatedAt">): Promise<void>;
  addAlert(alert: NewAlert): Promise<void>;
  listAlerts(limit?: number): Promise<AlertRecord[]>;
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

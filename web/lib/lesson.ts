// mirrors Lesson.snapshot() in agent/src/ustaad_agent/lesson.py

export type Phase = "intro" | "teach" | "check" | "question" | "feedback" | "doubts" | "wrap" | "done";
export type Mood =
  | "calm"
  | "explaining"
  | "curious"
  | "happy"
  | "encouraging"
  | "kind"
  | "proud"
  | "listening"
  | "concerned";

export type QuestionState = {
  id: string;
  index: number;
  count: number;
  status: "open" | "retry" | "correct" | "revealed";
  picked: string;
  answer: string | null;
  explain: string | null;
  eliminated?: number[];
  hints?: number;
};

export type LessonState = {
  v: 1;
  chapter: string;
  phase: Phase;
  section: number;
  sections: number;
  sectionsDone: number;
  revealed: number;
  question: QuestionState | null;
  score: { correct: number; attempted: number };
  paused: boolean;
  mood: Mood;
  status: "ok" | "trouble" | "ended";
  doubts?: { text: string; answered: boolean }[];
  doubt?: number;
  finished?: boolean;
  minutes?: number;
  endsAt?: number;
};

export function parseLesson(raw: string | undefined): LessonState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as LessonState;
    return state.v === 1 ? state : null;
  } catch {
    return null;
  }
}

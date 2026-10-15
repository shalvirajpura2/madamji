// server-side only: the raw json holds answers and teacher notes, so pages pass
// the slim public version below to client components

import g6Magnets from "@content/chapters/g6-magnets.json";

export type Beat = { board: string; diagram?: string };

export type Question = {
  id: string;
  type: "mcq" | "truefalse" | "fill" | "short" | "number";
  prompt: string;
  options?: string[];
  choices?: string[];
  unit?: string;
};

export type Section = { id: string; title: string; beats: Beat[]; questions: Question[] };

export type Chapter = {
  id: string;
  grade: number;
  order: number;
  title: string;
  book: string;
  tagline: string;
  icon: string;
  sections: Section[];
};

type RawQuestion = Question & Record<string, unknown>;
type RawChapter = Omit<Chapter, "sections"> & {
  sections: { id: string; title: string; beats: Beat[]; questions: RawQuestion[] }[];
};

const raw = [g6Magnets] as unknown as RawChapter[];

function toPublic(c: RawChapter): Chapter {
  return {
    id: c.id,
    grade: c.grade,
    order: c.order,
    title: c.title,
    book: c.book,
    tagline: c.tagline,
    icon: c.icon,
    sections: c.sections.map((s) => ({
      id: s.id,
      title: s.title,
      beats: s.beats.map((b) => ({ board: b.board, diagram: b.diagram })),
      questions: s.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        choices: q.choices,
        unit: q.unit,
      })),
    })),
  };
}

export const chapters: Chapter[] = raw.map(toPublic).sort((a, b) => a.grade - b.grade || a.order - b.order);

export const grades = [6, 10] as const;

export function chapterById(id: string): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function chaptersForGrade(grade: number): Chapter[] {
  return chapters.filter((c) => c.grade === grade);
}

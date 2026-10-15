from dataclasses import dataclass, field

from . import grading
from .content import Chapter, Question, Section

INTRO, TEACH, CHECK, QUESTION, FEEDBACK, WRAP, DONE = (
    "intro", "teach", "check", "question", "feedback", "wrap", "done",
)


@dataclass
class Step:
    """One thing the teacher should say next. `auto_next` means the engine moves on by itself
    once she finishes saying it; otherwise the class waits for the student."""

    kind: str  # intro | beat | resume | check | question | feedback | unclear | wrap
    auto_next: bool
    section: int
    beat: int = -1
    question: int = -1
    grade: grading.Grade | None = None
    attempt: int = 0
    retry: bool = False
    new_section: bool = False
    skipped: bool = False


@dataclass
class Result:
    section: str
    question: str
    verdict: str
    attempts: int


@dataclass
class Lesson:
    chapter: Chapter
    section: int = 0
    beat: int = -1
    phase: str = INTRO
    qi: int = 0
    attempts: int = 0
    interrupted: bool = False
    paused: bool = False
    sections_done: int = 0
    revealed: int = 0
    last_grade: grading.Grade | None = None
    results: list[Result] = field(default_factory=list)

    @property
    def current(self) -> Section:
        return self.chapter.sections[self.section]

    @property
    def question(self) -> Question | None:
        if self.phase in (QUESTION, FEEDBACK):
            return self.current.questions[self.qi]
        return None

    def start(self, from_section: int = 0) -> Step:
        self.section = min(max(from_section, 0), len(self.chapter.sections) - 1)
        self.sections_done = max(self.sections_done, self.section)
        self.phase = INTRO
        return Step("intro", auto_next=True, section=self.section)

    def advance(self) -> Step | None:
        """Called after an auto step finished playing without interruption."""
        if self.paused:
            return None
        if self.phase == INTRO:
            return self._beat(0, new_section=True)
        if self.phase == TEACH:
            if self.beat + 1 < len(self.current.beats):
                return self._beat(self.beat + 1)
            return self._check()
        if self.phase == FEEDBACK:
            return self._after_question()
        return None

    def proceed(self) -> Step | None:
        """The student is ready to move on (said so, or stayed quiet)."""
        self.paused = False
        if self.phase == TEACH and self.interrupted:
            self.interrupted = False
            return Step("resume", auto_next=True, section=self.section, beat=self.beat)
        if self.phase in (INTRO, TEACH, FEEDBACK):
            self.interrupted = False
            return self.advance()
        if self.phase == CHECK:
            return self._question(0)
        if self.phase == QUESTION:
            q = self.current.questions[self.qi]
            self._record(grading.DONT_KNOW)
            self.phase = FEEDBACK
            return Step("feedback", auto_next=True, section=self.section, question=self.qi,
                        grade=grading.Grade(grading.DONT_KNOW, note=q.explain), skipped=True)
        return None

    def answer(
        self, text: str | None = None, choice: int | None = None, result: grading.Grade | None = None
    ) -> Step | None:
        if self.phase != QUESTION:
            return None
        q = self.current.questions[self.qi]
        result = result or grading.grade(q, answer=text, choice=choice)
        self.last_grade = result
        if result.verdict == grading.UNCLEAR:
            return Step("unclear", auto_next=False, section=self.section, question=self.qi, grade=result)
        self.attempts += 1
        if result.verdict == grading.CORRECT or self.attempts >= 2:
            self._record(result.verdict)
            self.phase = FEEDBACK
            return Step("feedback", auto_next=True, section=self.section, question=self.qi,
                        grade=result, attempt=self.attempts)
        return Step("feedback", auto_next=False, section=self.section, question=self.qi,
                    grade=result, attempt=self.attempts, retry=True)

    def jump(self, section: int) -> Step | None:
        if not 0 <= section < len(self.chapter.sections):
            return None
        self.section = section
        self.paused = False
        self.interrupted = False
        return self._beat(0, new_section=True)

    def mark_interrupted(self) -> None:
        if self.phase in (INTRO, TEACH):
            self.interrupted = True

    def _beat(self, index: int, new_section: bool = False) -> Step:
        self.phase = TEACH
        self.beat = index
        self.revealed = index + 1
        self.interrupted = False
        return Step("beat", auto_next=True, section=self.section, beat=index, new_section=new_section)

    def _check(self) -> Step:
        self.phase = CHECK
        return Step("check", auto_next=False, section=self.section)

    def _question(self, index: int) -> Step:
        self.phase = QUESTION
        self.qi = index
        self.attempts = 0
        self.last_grade = None
        return Step("question", auto_next=False, section=self.section, question=index)

    def _after_question(self) -> Step:
        if self.qi + 1 < len(self.current.questions):
            return self._question(self.qi + 1)
        self.sections_done = max(self.sections_done, self.section + 1)
        if self.section + 1 < len(self.chapter.sections):
            self.section += 1
            return self._beat(0, new_section=True)
        self.phase = WRAP
        return Step("wrap", auto_next=False, section=self.section)

    def _record(self, verdict: str) -> None:
        q = self.current.questions[self.qi]
        self.results.append(Result(self.current.id, q.id, verdict, self.attempts))

    @property
    def done(self) -> bool:
        return self.phase == WRAP

    def score(self) -> tuple[int, int]:
        correct = sum(1 for r in self.results if r.verdict == grading.CORRECT)
        return correct, len(self.results)

    def snapshot(self) -> dict:
        correct, attempted = self.score()
        q = self.question
        question = None
        if q is not None or self.phase == QUESTION:
            q = q or self.current.questions[self.qi]
            resolved = self.phase == FEEDBACK
            status = "open"
            if self.last_grade is not None:
                v = self.last_grade.verdict
                if v == grading.CORRECT:
                    status = "correct"
                elif resolved:
                    status = "revealed"
                elif v != grading.UNCLEAR:
                    status = "retry"
            question = {
                "id": q.id,
                "index": self.qi,
                "count": len(self.current.questions),
                "status": status,
                "picked": self.last_grade.picked if self.last_grade else "",
                "answer": q.answer_text() if resolved else None,
                "explain": q.explain if resolved else None,
            }
        return {
            "v": 1,
            "chapter": self.chapter.id,
            "phase": self.phase,
            "section": self.section,
            "sections": len(self.chapter.sections),
            "sectionsDone": self.sections_done,
            "revealed": self.revealed if self.phase != INTRO else 0,
            "question": question,
            "score": {"correct": correct, "attempted": attempted},
            "paused": self.paused,
        }

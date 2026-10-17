import re
from dataclasses import dataclass, field

from . import grading
from .content import Chapter, Question, Section

INTRO, TEACH, CHECK, QUESTION, FEEDBACK, DOUBTS, WRAP, DONE = (
    "intro", "teach", "check", "question", "feedback", "doubts", "wrap", "done",
)

MAX_HINT = 3
LIVE_DOUBTS_PER_PART = 2  # more than this and new doubts go on the doubt list
MAX_PARKED_DOUBTS = 5

# replies that move the class along but are not doubts: "okay", "haan ji", "samajh gaya", "no doubt"
ACK_WORDS = set(
    "ok okay okk k kk haan han ha hmm hm hmmm mm yes yeah yep ya yaa ji jee theek thik thick hai h acha accha "
    "achha acchha samajh samaj samjh gaya gayi gaye aa aaya got it fine sure right cool nice good great thanks "
    "thank you thankyou no nahi nahin nope doubt doubts koi chalo aage next continue alright go on sounds clear "
    "understood mam maam ma'am madam madamji please".split()
)


def is_filler(text: str) -> bool:
    """True for acknowledgements and small talk that should never count as, or be parked as, a doubt."""
    words = re.findall(r"[a-z']+", text.lower())
    return not words or all(w in ACK_WORDS for w in words)


@dataclass
class Step:
    """One thing the teacher should say next. `auto_next` means the engine moves on by itself
    once she finishes saying it; otherwise the class waits for the student."""

    kind: str  # intro | beat | resume | check | question | feedback | hint | unclear | doubt | wrap
    auto_next: bool
    section: int
    beat: int = -1
    question: int = -1
    grade: grading.Grade | None = None
    attempt: int = 0
    retry: bool = False
    new_section: bool = False
    hint_level: int = 0
    doubt: int = -1
    early: bool = False


@dataclass
class Doubt:
    text: str
    answered: bool = False


@dataclass
class Result:
    section: str
    question: str
    verdict: str
    attempts: int


@dataclass
class Lesson:
    """Practice questions are never answered for the student: a wrong answer, "skip" or silence
    only earns a stronger hint, and the class moves on once the student gets it right."""

    chapter: Chapter
    section: int = 0
    beat: int = -1
    phase: str = INTRO
    qi: int = 0
    attempts: int = 0
    hints: int = 0
    eliminated: list[int] = field(default_factory=list)
    interrupted: bool = False
    paused: bool = False
    sections_done: int = 0
    revealed: int = 0
    last_grade: grading.Grade | None = None
    results: list[Result] = field(default_factory=list)
    doubts: list[Doubt] = field(default_factory=list)
    live_doubts: int = 0  # answered straight away in the current part
    out_of_time: bool = False  # set by the class timer: no new parts, go to doubt time
    di: int = -1

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
        if self.phase == DOUBTS:
            if 0 <= self.di < len(self.doubts):
                self.doubts[self.di].answered = True
            return self._next_doubt_or_wrap()
        return None

    def proceed(self) -> Step | None:
        """The student is ready to move on (said so, or stayed quiet). On a question that
        means a stronger hint, never the answer."""
        self.paused = False
        if self.phase == TEACH and self.interrupted:
            self.interrupted = False
            return Step("resume", auto_next=True, section=self.section, beat=self.beat)
        if self.phase in (INTRO, TEACH, FEEDBACK, DOUBTS):
            self.interrupted = False
            return self.advance()
        if self.phase == CHECK:
            return self._question(0)
        if self.phase == QUESTION:
            return self.hint()
        return None

    def hint(self) -> Step | None:
        if self.phase != QUESTION:
            return None
        self._raise_hint()
        return Step("hint", auto_next=False, section=self.section, question=self.qi, hint_level=self.hints)

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
        if result.verdict == grading.CORRECT:
            self._record(result.verdict)
            self.phase = FEEDBACK
            return Step("feedback", auto_next=True, section=self.section, question=self.qi,
                        grade=result, attempt=self.attempts)
        if q.type == "mcq" and result.picked in q.options:
            self._eliminate(q.options.index(result.picked))
        self._raise_hint()
        return Step("feedback", auto_next=False, section=self.section, question=self.qi,
                    grade=result, attempt=self.attempts, retry=True, hint_level=self.hints)

    def jump(self, section: int) -> Step | None:
        if not 0 <= section < len(self.chapter.sections):
            return None
        self.section = section
        self.paused = False
        self.interrupted = False
        return self._beat(0, new_section=True)

    def park(self, text: str) -> int | None:
        """Put a doubt on the list for doubt time. Returns its number, or None if the list is full."""
        text = text.strip()[:160]
        if not text or len([d for d in self.doubts if not d.answered]) >= MAX_PARKED_DOUBTS:
            return None
        self.doubts.append(Doubt(text))
        return len(self.doubts)

    def note_live_doubt(self) -> None:
        self.live_doubts += 1

    @property
    def doubts_left(self) -> int:
        return len([d for d in self.doubts if not d.answered])

    def finish_early(self) -> Step | None:
        """Time is fully up in the middle of teaching: stop here and go to doubt time or wrap."""
        self.out_of_time = True
        if self.phase in (INTRO, TEACH, CHECK):
            return self._next_doubt_or_wrap()
        return None

    def mark_interrupted(self) -> None:
        if self.phase in (INTRO, TEACH):
            self.interrupted = True

    def _raise_hint(self) -> None:
        self.hints = min(self.hints + 1, MAX_HINT)
        q = self.current.questions[self.qi]
        if q.type != "mcq":
            return
        # level 2 rules out one more wrong option, level 3 leaves only two to choose from
        keep_wrong = {1: 3, 2: 2, 3: 1}[self.hints]
        wrong = [i for i in range(len(q.options)) if i != int(q.answer) and i not in self.eliminated]
        while len(wrong) > keep_wrong:
            self._eliminate(wrong.pop(0))

    def _eliminate(self, index: int) -> None:
        q = self.current.questions[self.qi]
        if index != int(q.answer) and index not in self.eliminated:
            self.eliminated.append(index)

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
        self.hints = 0
        self.eliminated = []
        self.last_grade = None
        return Step("question", auto_next=False, section=self.section, question=index)

    def _after_question(self) -> Step:
        if self.qi + 1 < len(self.current.questions):
            return self._question(self.qi + 1)
        self.sections_done = max(self.sections_done, self.section + 1)
        if self.section + 1 < len(self.chapter.sections) and not self.out_of_time:
            self.section += 1
            self.live_doubts = 0
            return self._beat(0, new_section=True)
        return self._next_doubt_or_wrap()

    def _next_doubt_or_wrap(self) -> Step:
        pending = [i for i, d in enumerate(self.doubts) if not d.answered]
        if pending:
            first = self.phase != DOUBTS
            self.phase = DOUBTS
            self.di = pending[0]
            return Step("doubt", auto_next=True, section=self.section, doubt=self.di, new_section=first)
        self.phase = WRAP
        early = self.sections_done < len(self.chapter.sections)
        return Step("wrap", auto_next=False, section=self.section, early=early)

    def _record(self, verdict: str) -> None:
        q = self.current.questions[self.qi]
        self.results.append(Result(self.current.id, q.id, verdict, self.attempts))

    @property
    def done(self) -> bool:
        return self.phase == WRAP and self.sections_done >= len(self.chapter.sections)

    def score(self) -> tuple[int, int]:
        """First-try correct answers out of questions finished."""
        first_try = sum(1 for r in self.results if r.attempts <= 1)
        return first_try, len(self.results)

    def snapshot(self) -> dict:
        correct, attempted = self.score()
        question = None
        if self.phase in (QUESTION, FEEDBACK):
            q = self.current.questions[self.qi]
            solved = self.phase == FEEDBACK
            status = "correct" if solved else "open"
            if not solved and self.last_grade is not None and self.last_grade.verdict != grading.UNCLEAR:
                status = "retry"
            question = {
                "id": q.id,
                "index": self.qi,
                "count": len(self.current.questions),
                "status": status,
                "picked": self.last_grade.picked if self.last_grade else "",
                "answer": q.answer_text() if solved else None,
                "explain": q.explain if solved else None,
                "eliminated": list(self.eliminated),
                "hints": self.hints,
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
            "doubts": [{"text": d.text, "answered": d.answered} for d in self.doubts],
            "doubt": self.di if self.phase == DOUBTS else -1,
            "finished": self.phase == WRAP,
        }

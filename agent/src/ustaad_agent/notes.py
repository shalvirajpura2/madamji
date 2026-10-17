"""Small BM25 search over our chapter notes and lesson plans.

The corpus is a few hundred short passages, so an in-process keyword index answers in
well under a millisecond. The LLM writes the query in English keywords, which keeps
Hinglish questions searchable."""

import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import cache

from .content import chapters

STOP = set(
    "a an the is are was were be of to in on for and or with what why how does do did it this that "
    "which who when where can could will would should from by at as into than then there their its".split()
)


def tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w[:-1] if len(w) > 4 and w.endswith("s") else w for w in words if w not in STOP]


@dataclass
class Passage:
    chapter_id: str
    chapter_title: str
    grade: int
    topic: str
    text: str


class Index:
    def __init__(self, passages: list[Passage], k1: float = 1.4, b: float = 0.75):
        self.passages = passages
        self.docs = [Counter(tokens(f"{p.topic} {p.text}")) for p in passages]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avg = sum(self.lengths) / max(len(self.lengths), 1)
        df = Counter(t for d in self.docs for t in d)
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}
        self.k1, self.b = k1, b

    def search(self, query: str, grade: int | None = None, limit: int = 3) -> list[Passage]:
        q = tokens(query)
        scored = []
        for i, doc in enumerate(self.docs):
            score = 0.0
            for t in q:
                if t not in doc:
                    continue
                tf = doc[t]
                norm = tf + self.k1 * (1 - self.b + self.b * self.lengths[i] / self.avg)
                score += self.idf[t] * tf * (self.k1 + 1) / norm
            if score and grade is not None and self.passages[i].grade == grade:
                score *= 1.2
            if score:
                scored.append((score, i))
        scored.sort(reverse=True)
        return [self.passages[i] for _, i in scored[:limit]]


@cache
def index() -> Index:
    passages = []
    for ch in chapters().values():
        for note in ch.notes:
            passages.append(Passage(ch.id, ch.title, ch.grade, note.topic, note.text))
        for section in ch.sections:
            for beat in section.beats:
                passages.append(Passage(ch.id, ch.title, ch.grade, section.title, f"{beat.board}. {beat.teach}"))
    return Index(passages)


def related(text: str, chapter_id: str) -> bool:
    """True when the text shares at least one keyword with this chapter's notes or lesson plan."""
    from .lesson import ACK_WORDS

    words = " ".join(w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in ACK_WORDS)
    return bool(words) and any(p.chapter_id == chapter_id for p in index().search(words, limit=50))


FILLER, CURRENT, CHAPTER, OTHER = "filler", "current", "chapter", "other"


@cache
def _sections(chapter_id: str) -> tuple[list[set[str]], Counter]:
    bags = [
        set(tokens(" ".join([s.title, *(f"{b.board} {b.teach}" for b in s.beats)])))
        for s in chapters()[chapter_id].sections
    ]
    return bags, Counter(t for bag in bags for t in bag)


def place(text: str, chapter_id: str, section: int) -> str:
    """Where a student's turn belongs: FILLER ("okay", "samajh gaya"), CURRENT (about the part being
    taught right now), CHAPTER (another part of this chapter) or OTHER (not about this chapter).
    Words found in every part, like "magnet", count for little; distinctive words decide the part."""
    from .lesson import ACK_WORDS, is_filler

    if is_filler(text):
        return FILLER
    words = {w for w in tokens(text) if w not in ACK_WORDS}
    bags, df = _sections(chapter_id)
    n = len(bags)
    scores = [sum(math.log(1 + n / df[w]) for w in words if w in bag) for bag in bags]
    best = max(scores, default=0)
    if best > 0 and 0 <= section < n and scores[section] >= 0.8 * best:
        return CURRENT
    return CHAPTER if related(text, chapter_id) else OTHER


def search(query: str, grade: int | None = None) -> str:
    found = index().search(query, grade=grade)
    if not found:
        return "Nothing in the chapter notes. Answer from your own science knowledge at the student's level, or say you will check and keep it simple."
    lines = [f"[{p.chapter_title}, class {p.grade}, {p.topic}] {p.text}" for p in found]
    return (
        "From the MadamJi chapter notes:\n" + "\n".join(lines) +
        "\nUse this to answer in your own words at the student's level. If it belongs to a different class, "
        "say so lightly, like 'ye tum class 10 mein detail mein padhoge'."
    )

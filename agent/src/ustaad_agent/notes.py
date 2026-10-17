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

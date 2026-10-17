import hashlib
import json
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from .config import settings


@dataclass
class Beat:
    board: str
    teach: str
    diagram: str | None = None


@dataclass
class Question:
    id: str
    type: str  # mcq | truefalse | fill | short | number
    prompt: str
    explain: str
    hint: str = ""
    options: list[str] = field(default_factory=list)
    answer: object = None
    choices: list[str] = field(default_factory=list)
    why_wrong: dict[str, str] = field(default_factory=dict)
    keywords: list[list[str]] = field(default_factory=list)
    sample: str = ""
    unit: str = ""
    tolerance: float = 0.02

    def answer_text(self) -> str:
        if self.type == "mcq":
            return self.options[int(self.answer)]
        if self.type == "truefalse":
            return "True" if self.answer else "False"
        if self.type == "fill":
            return self.answer[0]
        if self.type == "number":
            return f"{self.answer} {self.unit}".strip()
        return self.sample


@dataclass
class Section:
    id: str
    title: str
    beats: list[Beat]
    questions: list[Question]


@dataclass
class Note:
    topic: str
    text: str


@dataclass
class Chapter:
    id: str
    grade: int
    order: int
    title: str
    book: str
    tagline: str
    sections: list[Section]
    notes: list[Note]
    keyterms: list[str] = field(default_factory=list)
    icon: str = ""
    version: str = ""  # fingerprint of the chapter file, so a transcript says exactly what was taught


def _chapter(data: dict, version: str = "") -> Chapter:
    sections = [
        Section(
            id=s["id"],
            title=s["title"],
            beats=[Beat(**b) for b in s["beats"]],
            questions=[Question(**q) for q in s["questions"]],
        )
        for s in data["sections"]
    ]
    return Chapter(
        id=data["id"],
        grade=data["grade"],
        order=data["order"],
        title=data["title"],
        book=data["book"],
        tagline=data["tagline"],
        sections=sections,
        notes=[Note(**n) for n in data.get("notes", [])],
        keyterms=data.get("keyterms", []),
        icon=data.get("icon", ""),
        version=version,
    )


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


@cache
def chapters() -> dict[str, Chapter]:
    found = {}
    for path in sorted((settings.content_dir / "chapters").glob("*.json")):
        raw = path.read_bytes()
        version = hashlib.sha256(raw.replace(b"\r\n", b"\n")).hexdigest()[:12]
        chapter = _chapter(json.loads(raw), version)
        found[chapter.id] = chapter
    return found


def chapter(chapter_id: str) -> Chapter:
    return chapters()[chapter_id]


@cache
def faqs() -> list[dict]:
    return _read(settings.content_dir / "faqs.json")


@cache
def glossary() -> dict:
    return _read(settings.content_dir / "glossary.json")

"""A full record of each class: what the engine asked for, what the teacher actually said, what the
student said, and which tools ran (with their results). Saved with the chapter version, so a wrong
statement can be traced to bad notes (the step and notes are in the log) or to the AI improvising
(the words are not in either)."""

import json
import logging
import time
from pathlib import Path

from . import backend

logger = logging.getLogger("ustaad.transcript")

LOCAL_DIR = Path(__file__).resolve().parents[2] / "logs" / "transcripts"


class Transcript:
    def __init__(self, *, room: str, student: dict, chapter, minutes: int, models: dict):
        self.started = time.time()
        self.meta = {
            "id": room,
            "studentId": student.get("id"),
            "studentName": student.get("name"),
            "grade": student.get("grade"),
            "chapterId": chapter.id,
            "chapterTitle": chapter.title,
            "chapterVersion": chapter.version,
            "minutes": minutes,
            "models": models,
        }
        self.entries: list[dict] = []
        self._saved = False

    def _add(self, kind: str, **data) -> None:
        self.entries.append({"t": round(time.time() - self.started, 1), "kind": kind, **data})

    def step(self, step, lesson) -> None:
        """What the lesson engine asked the teacher to do, with the exact content it was given."""
        section = lesson.chapter.sections[step.section]
        info = {"step": step.kind, "part": step.section + 1, "partTitle": section.title}
        if step.kind in ("beat", "resume") and step.beat >= 0:
            beat = section.beats[step.beat]
            info.update(beat=step.beat + 1, board=beat.board, notes=beat.teach)
        if step.question >= 0 and step.kind in ("question", "feedback", "hint", "unclear"):
            q = section.questions[step.question]
            info.update(question=q.id, prompt=q.prompt)
        if step.grade is not None:
            info.update(verdict=step.grade.verdict, picked=step.grade.picked)
        if step.hint_level:
            info.update(hintLevel=step.hint_level)
        if step.kind == "doubt" and 0 <= step.doubt < len(lesson.doubts):
            info.update(doubt=lesson.doubts[step.doubt].text)
        self._add("step", **info)

    def message(self, role: str, text: str, interrupted: bool = False) -> None:
        if text.strip():
            who = "teacher" if role == "assistant" else "student"
            self._add(who, text=text.strip(), **({"interrupted": True} if interrupted else {}))

    def tool(self, name: str, arguments: str, output: str) -> None:
        try:
            args = json.loads(arguments or "{}")
        except json.JSONDecodeError:
            args = arguments
        self._add("tool", name=name, args=args, output=(output or "")[:1500])

    def event(self, name: str, **data) -> None:
        self._add("event", name=name, **data)

    def save(self, summary: dict) -> None:
        if self._saved:
            return
        self._saved = True
        record = {**self.meta, **summary, "startedAt": int(self.started * 1000),
                  "endedAt": int(time.time() * 1000), "entries": self.entries}
        try:
            LOCAL_DIR.mkdir(parents=True, exist_ok=True)
            (LOCAL_DIR / f"{self.meta['id']}.json").write_text(json.dumps(record, indent=1, ensure_ascii=False))
        except OSError as e:
            logger.warning("could not write local transcript: %s", e)
        backend.send({"type": "transcript", **record})
        logger.info("transcript saved: %s (%d entries)", self.meta["id"], len(self.entries))

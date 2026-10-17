import json

from ustaad_agent import backend, transcript
from ustaad_agent.content import chapters
from ustaad_agent.lesson import Lesson


def test_transcript_records_steps_messages_tools_and_version(tmp_path, monkeypatch):
    sent = []
    monkeypatch.setattr(backend, "send", sent.append)
    monkeypatch.setattr(transcript, "LOCAL_DIR", tmp_path)

    chapter = chapters()["g6-magnets"]
    assert len(chapter.version) == 12
    lesson = Lesson(chapter)
    t = transcript.Transcript(
        room="class-test", student={"id": "s1", "name": "Aarav", "grade": 6}, chapter=chapter, minutes=15,
        models={"llm": "test"},
    )
    lesson.start()
    t.step(lesson.advance(), lesson)
    t.message("assistant", "Imagine you drop a box of pins...")
    t.message("user", "ma'am why is copper not magnetic", interrupted=False)
    t.tool("search_notes", '{"query": "copper magnetic"}', "From the MadamJi chapter notes: ...")
    t.event("language", language="hinglish")
    t.save({"sectionsDone": 0})
    t.save({"sectionsDone": 0})  # saving twice is a no-op

    assert len(sent) == 1
    record = sent[0]
    assert record["type"] == "transcript" and record["chapterVersion"] == chapter.version
    kinds = [e["kind"] for e in record["entries"]]
    assert kinds == ["step", "teacher", "student", "tool", "event"]
    step = record["entries"][0]
    assert step["step"] == "beat" and step["board"] == chapter.sections[0].beats[0].board and step["notes"]
    assert record["entries"][3]["args"] == {"query": "copper magnetic"}
    saved = json.loads((tmp_path / "class-test.json").read_text())
    assert saved["id"] == "class-test" and len(saved["entries"]) == 5


def test_event_fields_cannot_break_the_log(tmp_path, monkeypatch):
    monkeypatch.setattr(transcript, "LOCAL_DIR", tmp_path)
    chapter = chapters()["g6-magnets"]
    t = transcript.Transcript(room="r", student={}, chapter=chapter, minutes=15, models={})
    t.event("drawing", kind="template", template="magnets", params={"left": "N", "right": "N"})
    entry = t.entries[-1]
    assert entry["kind"] == "event" and entry["type"] == "template" and entry["template"] == "magnets"

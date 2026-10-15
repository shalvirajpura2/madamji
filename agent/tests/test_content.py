import pytest

from ustaad_agent import grading
from ustaad_agent.content import chapters, faqs
from ustaad_agent.lesson import Lesson
from ustaad_agent.speech import for_voice

ALL = list(chapters().values())


def test_three_chapters_per_grade():
    assert sorted(c.grade for c in ALL) == [6, 6, 6, 10, 10, 10]
    assert len(faqs()) == 12


@pytest.mark.parametrize("chapter", ALL, ids=lambda c: c.id)
def test_chapter_is_teachable(chapter):
    assert 3 <= len(chapter.sections) <= 5
    assert chapter.notes and chapter.keyterms
    for section in chapter.sections:
        assert 2 <= len(section.beats) <= 4, section.id
        assert section.questions, section.id
        for beat in section.beats:
            assert beat.board and len(beat.board) <= 90, beat.board
            assert len(beat.teach) > 80


@pytest.mark.parametrize("chapter", ALL, ids=lambda c: c.id)
def test_every_question_grades_its_own_answer(chapter):
    for section in chapter.sections:
        for q in section.questions:
            assert q.explain and q.hint, q.id
            if q.type == "mcq":
                assert len(q.options) == 4 and 0 <= int(q.answer) < 4
                assert grading.grade(q, choice=int(q.answer)).verdict == grading.CORRECT
                assert grading.grade(q, answer=q.options[int(q.answer)]).verdict == grading.CORRECT
                wrong = (int(q.answer) + 1) % 4
                assert grading.grade(q, answer=q.options[wrong]).verdict == grading.WRONG, (q.id, q.options[wrong])
                assert all(0 <= int(k) < 4 and int(k) != int(q.answer) for k in q.why_wrong)
            elif q.type == "truefalse":
                assert isinstance(q.answer, bool)
            elif q.type == "fill":
                assert "____" in q.prompt
                assert grading.grade(q, answer=q.answer[0]).verdict == grading.CORRECT
                if q.choices:
                    assert q.choices.index(q.answer[0]) >= 0
            elif q.type == "number":
                assert grading.grade(q, answer=f"{q.answer} {q.unit}").verdict == grading.CORRECT
            elif q.type == "short":
                assert q.keywords and q.sample
                assert grading.grade(q, answer=q.sample).verdict == grading.CORRECT
            else:
                pytest.fail(f"unknown type {q.type}")


@pytest.mark.parametrize("chapter", ALL, ids=lambda c: c.id)
def test_chapter_runs_start_to_finish(chapter):
    lesson = Lesson(chapter)
    lesson.start()
    steps = 0
    while not lesson.done and steps < 500:
        steps += 1
        step = lesson.advance() if lesson.phase != "check" and lesson.phase != "question" else None
        if lesson.phase == "check":
            lesson.proceed()
        elif lesson.phase == "question":
            q = lesson.current.questions[lesson.qi]
            lesson.answer(result=grading.Grade(grading.CORRECT, picked=q.answer_text()))
        elif step is None and not lesson.done:
            pytest.fail(f"stuck in {lesson.phase}")
    assert lesson.done and lesson.sections_done == len(chapter.sections)


def test_voice_glossary_reads_formulas():
    assert for_voice("H = I²Rt") == "H = I square R t".replace(" = ", " equals ")
    assert "C. O. two" in for_voice("Plants take in CO₂")
    assert "N. C. E. R. T." in for_voice("NCERT book")

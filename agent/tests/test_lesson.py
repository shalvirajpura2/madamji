from ustaad_agent import grading
from ustaad_agent.content import chapters
from ustaad_agent.lesson import CHECK, FEEDBACK, QUESTION, TEACH, WRAP, Lesson


def fresh() -> Lesson:
    return Lesson(chapters()["g6-magnets"])


def finish_section(lesson: Lesson) -> None:
    while lesson.phase == TEACH:
        lesson.advance()
    assert lesson.phase == CHECK
    lesson.proceed()
    while lesson.phase in (QUESTION, FEEDBACK):
        if lesson.phase == QUESTION:
            q = lesson.current.questions[lesson.qi]
            step = lesson.answer(result=grading.Grade(grading.CORRECT, picked=q.answer_text()))
            assert step.auto_next
        else:
            lesson.advance()


def test_teacher_leads_through_whole_chapter():
    lesson = fresh()
    step = lesson.start()
    assert step.kind == "intro" and step.auto_next
    step = lesson.advance()
    assert step.kind == "beat" and step.beat == 0 and step.new_section
    for _ in lesson.chapter.sections:
        finish_section(lesson)
    assert lesson.phase == WRAP
    correct, attempted = lesson.score()
    assert correct == attempted == sum(len(s.questions) for s in lesson.chapter.sections)
    assert lesson.sections_done == len(lesson.chapter.sections)


def test_beats_reveal_board_lines_in_order():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    assert lesson.snapshot()["revealed"] == 1
    lesson.advance()
    assert lesson.snapshot()["revealed"] == 2


def test_section_ends_with_doubt_check_then_question():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    while lesson.phase == TEACH:
        step = lesson.advance()
    assert step.kind == "check" and not step.auto_next
    assert lesson.advance() is None  # waits for the student
    step = lesson.proceed()
    assert step.kind == "question" and lesson.snapshot()["question"]["status"] == "open"


def test_wrong_answer_gets_one_hint_then_reveal():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    while lesson.phase == TEACH:
        lesson.advance()
    lesson.proceed()
    step = lesson.answer(text="plastic scale")
    assert step.retry and not step.auto_next and lesson.phase == QUESTION
    assert lesson.snapshot()["question"]["status"] == "retry"
    step = lesson.answer(text="wooden pencil")
    assert step.auto_next and not step.retry and lesson.phase == FEEDBACK
    snap = lesson.snapshot()["question"]
    assert snap["status"] == "revealed" and snap["answer"] == "Iron nail"
    assert lesson.results[-1].verdict == grading.WRONG


def test_unclear_answer_does_not_use_an_attempt():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    while lesson.phase == TEACH:
        lesson.advance()
    lesson.proceed()
    step = lesson.answer(text="hmm")
    assert step.kind == "unclear" and lesson.attempts == 0
    step = lesson.answer(text="iron nail")
    assert step.grade.verdict == grading.CORRECT


def test_interrupted_beat_resumes_same_point():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.advance()
    lesson.mark_interrupted()
    step = lesson.proceed()
    assert step.kind == "resume" and step.beat == 1
    step = lesson.advance()
    assert step.kind == "beat" and step.beat == 2


def test_skip_question_reveals_and_moves_on():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    while lesson.phase == TEACH:
        lesson.advance()
    lesson.proceed()
    step = lesson.proceed()
    assert step.kind == "feedback" and step.skipped and step.auto_next
    step = lesson.advance()
    assert step.kind == "question" and step.question == 1


def test_resume_from_saved_section_and_jump():
    lesson = Lesson(chapters()["g6-magnets"], sections_done=2)
    lesson.start(from_section=2)
    step = lesson.advance()
    assert step.section == 2 and step.beat == 0
    step = lesson.jump(0)
    assert step.section == 0 and lesson.snapshot()["revealed"] == 1
    assert lesson.jump(9) is None


def test_pause_stops_auto_advance():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.paused = True
    assert lesson.advance() is None
    assert lesson.proceed() is not None and not lesson.paused

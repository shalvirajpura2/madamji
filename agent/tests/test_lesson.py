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


def open_question(lesson: Lesson) -> None:
    lesson.start()
    lesson.advance()
    while lesson.phase == TEACH:
        lesson.advance()
    lesson.proceed()


def test_wrong_answers_never_reveal_the_answer():
    lesson = fresh()
    open_question(lesson)
    for attempt, said in enumerate(["plastic scale", "wooden pencil", "rubber eraser", "pata nahi"], start=1):
        step = lesson.answer(text=said)
        assert step.retry and not step.auto_next and lesson.phase == QUESTION
        snap = lesson.snapshot()["question"]
        assert snap["status"] == "retry" and snap["answer"] is None and snap["explain"] is None
    assert lesson.results == []
    step = lesson.answer(text="iron nail")
    assert step.grade.verdict == grading.CORRECT and step.auto_next
    assert lesson.results[-1].attempts == 5
    assert lesson.snapshot()["question"]["answer"] == "Iron nail"


def test_hints_rule_out_wrong_options_but_keep_the_answer():
    lesson = fresh()
    open_question(lesson)
    q = lesson.current.questions[0]
    lesson.answer(text="plastic scale")
    assert lesson.eliminated == [0] and lesson.hints == 1
    step = lesson.hint()
    assert step.kind == "hint" and step.hint_level == 2
    assert 4 - len(lesson.eliminated) == 3
    lesson.hint()
    lesson.hint()
    assert lesson.hints == 3
    left = [i for i in range(4) if i not in lesson.eliminated]
    assert len(left) == 2 and int(q.answer) in left
    assert lesson.snapshot()["question"]["eliminated"] == lesson.eliminated


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


def test_skip_request_gives_a_hint_not_the_answer():
    lesson = fresh()
    open_question(lesson)
    step = lesson.proceed()
    assert step.kind == "hint" and lesson.phase == QUESTION
    assert lesson.snapshot()["question"]["answer"] is None


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


def test_parked_doubts_are_answered_in_doubt_time_before_wrap():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    assert lesson.park("why is copper not magnetic") == 1
    assert lesson.park("can magnets lose power") == 2
    assert lesson.snapshot()["doubts"] == [
        {"text": "why is copper not magnetic", "answered": False},
        {"text": "can magnets lose power", "answered": False},
    ]
    for _ in lesson.chapter.sections:
        finish_section(lesson)
    assert lesson.phase == "doubts"
    assert lesson.snapshot()["doubt"] == 0
    step = lesson.advance()
    assert step.kind == "doubt" and step.doubt == 1 and not step.new_section
    step = lesson.advance()
    assert step.kind == "wrap" and not step.early and lesson.done
    assert all(d["answered"] for d in lesson.snapshot()["doubts"])


def test_doubt_list_has_a_cap():
    lesson = fresh()
    for i in range(5):
        assert lesson.park(f"doubt {i}") == i + 1
    assert lesson.park("one too many") is None


def test_out_of_time_stops_new_parts_and_wraps_early():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.park("why do magnets attract iron")
    lesson.out_of_time = True
    finish_section(lesson)  # the current part still finishes with its questions
    assert lesson.phase == "doubts"
    step = lesson.advance()
    assert step.kind == "wrap" and step.early
    assert lesson.sections_done == 1 and not lesson.done


def test_time_up_mid_teaching_goes_straight_to_wrap():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    step = lesson.finish_early()
    assert step.kind == "wrap" and step.early and lesson.phase == "wrap"


def test_live_doubts_reset_each_part():
    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.note_live_doubt()
    lesson.note_live_doubt()
    assert lesson.live_doubts == 2
    finish_section(lesson)
    assert lesson.section == 1 and lesson.live_doubts == 0

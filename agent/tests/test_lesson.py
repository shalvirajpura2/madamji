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


def test_acknowledgements_are_not_doubts():
    from ustaad_agent.lesson import is_filler

    for text in ["okay", "Ok ma'am", "haan ji", "samajh gaya", "theek hai", "no doubt", "got it, thanks", "Hmm.", ""]:
        assert is_filler(text), text
    for text in ["why does a magnet attract iron", "kya copper magnetic hai?", "what is a compass"]:
        assert not is_filler(text), text


def test_only_chapter_doubts_are_related():
    from ustaad_agent.notes import related

    assert related("why does a magnet attract iron", "g6-magnets")
    assert related("which direction does the compass needle point", "g6-magnets")
    assert not related("who won the cricket match", "g6-magnets")
    assert not related("okay thank you", "g6-magnets")


def test_doubts_are_placed_by_part():
    from ustaad_agent.notes import CHAPTER, CURRENT, FILLER, OTHER, place

    # part 1 of magnets: what a magnet pulls
    assert place("why is copper not attracted", "g6-magnets", 0) == CURRENT
    assert place("is a plastic spoon pulled by a magnet", "g6-magnets", 0) == CURRENT
    assert place("why does a compass point north", "g6-magnets", 0) == CHAPTER
    assert place("who won the cricket match", "g6-magnets", 0) == OTHER
    assert place("okay ma'am", "g6-magnets", 0) == FILLER
    # the same compass doubt is about the board once that part is being taught
    assert place("why does a compass point north", "g6-magnets", 2) == CURRENT
    # food chapter, balanced diet part
    assert place("what should we eat for lunch in our daily life", "g6-food", 3) in (CURRENT, CHAPTER)


def test_resume_continues_from_what_she_already_said():
    from ustaad_agent.prompts import Student, step

    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.mark_interrupted("Magnets pull things made of iron, nickel and cobalt, like pins and nails.")
    resume = lesson.proceed()
    assert resume.kind == "resume"
    text = step(resume, lesson, Student(id="t", name="Aarav", grade=6))
    assert "already said" in text and "iron, nickel and cobalt" in text
    assert "where were we" not in text.replace("never 'So, where were we'", "")


def test_short_cut_off_restarts_the_point():
    from ustaad_agent.prompts import Student, step

    lesson = fresh()
    lesson.start()
    lesson.advance()
    lesson.mark_interrupted("Aarav,")
    text = step(lesson.proceed(), lesson, Student(id="t", name="Aarav", grade=6))
    assert "already said" not in text


def test_backchannels_are_dropped_only_while_she_speaks():
    from types import SimpleNamespace

    from ustaad_agent.classroom import Classroom

    def room(speech):
        return SimpleNamespace(session=SimpleNamespace(current_speech=speech))

    speaking = SimpleNamespace(interrupted=False)
    assert Classroom.is_backchannel(room(speaking), "haan ji")
    assert Classroom.is_backchannel(room(speaking), "Okay ma'am.")
    assert not Classroom.is_backchannel(room(speaking), "ruko, mera ek doubt hai")
    assert not Classroom.is_backchannel(room(speaking), "why?")
    assert not Classroom.is_backchannel(room(None), "okay")  # after she stops, "okay" means go on
    assert not Classroom.is_backchannel(room(SimpleNamespace(interrupted=True)), "okay")


def test_words_aimed_at_the_teacher_are_told_apart_from_side_talk():
    from ustaad_agent.notes import addressed

    for text in ["Ma'am which is your favourite team", "aap kaun ho", "can you repeat", "kya ye sahi hai?"]:
        assert addressed(text), text
    for text in ["Bhai aur ho jaye.", "Mummy ek minute", "Ye dekh Bangalore mein deep ja rahe ho"]:
        assert not addressed(text), text

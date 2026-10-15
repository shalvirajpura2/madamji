import pytest

from ustaad_agent import grading
from ustaad_agent.content import Question

MCQ = Question(
    id="q", type="mcq", prompt="Which will a magnet pull?", explain="",
    options=["Plastic scale", "Iron nail", "Wooden pencil", "Rubber eraser"], answer=1,
    why_wrong={"0": "plastic is non-magnetic"},
)
TF = Question(id="t", type="truefalse", prompt="All metals are magnetic.", explain="", answer=False)
FILL = Question(id="f", type="fill", prompt="Ends are called ____.", explain="", answer=["poles", "pole"],
                choices=["poles", "edges", "centres"])
NUM = Question(id="n", type="number", prompt="R?", explain="", answer=440, unit="ohm")
SHORT = Question(id="s", type="short", prompt="Why?", explain="",
                 keywords=[["repel", "push away"], ["like poles", "same poles"]])


@pytest.mark.parametrize("said", ["B", "option b", "b wala", "the second one", "iron nail", "I think iron nail ma'am", "doosra"])
def test_mcq_correct_by_voice(said):
    assert grading.grade(MCQ, answer=said).verdict == grading.CORRECT


@pytest.mark.parametrize("said", ["A", "plastic scale", "option one", "pehla wala"])
def test_mcq_wrong_by_voice(said):
    result = grading.grade(MCQ, answer=said)
    assert result.verdict == grading.WRONG
    assert result.picked == "Plastic scale"
    assert result.note == "plastic is non-magnetic"


@pytest.mark.parametrize("said", ["hmm", "magnet", "kuch bhi"])
def test_mcq_unclear(said):
    assert grading.grade(MCQ, answer=said).verdict == grading.UNCLEAR


@pytest.mark.parametrize("said", ["I don't know", "pata nahi ma'am", "I do not know", "no idea"])
def test_dont_know_is_not_an_option(said):
    assert grading.grade(MCQ, answer=said).verdict == grading.DONT_KNOW


def test_mcq_tap():
    assert grading.grade(MCQ, choice=1).verdict == grading.CORRECT
    assert grading.grade(MCQ, choice=3).verdict == grading.WRONG


@pytest.mark.parametrize("said,verdict", [
    ("false", grading.CORRECT), ("galat hai", grading.CORRECT), ("not true", grading.CORRECT),
    ("true", grading.WRONG), ("haan sahi hai", grading.WRONG), ("umm", grading.UNCLEAR),
])
def test_truefalse(said, verdict):
    assert grading.grade(TF, answer=said).verdict == verdict


def test_truefalse_tap():
    assert grading.grade(TF, choice=1).verdict == grading.CORRECT


@pytest.mark.parametrize("said", ["poles", "they are called poles", "polls", "pole"])
def test_fill_correct(said):
    assert grading.grade(FILL, answer=said).verdict == grading.CORRECT


def test_fill_wrong_and_tap():
    assert grading.grade(FILL, answer="edges").verdict == grading.WRONG
    assert grading.grade(FILL, choice=0).verdict == grading.CORRECT


@pytest.mark.parametrize("said", ["440 ohm", "it is 440", "four hundred forty ohm", "440.0"])
def test_number_correct(said):
    assert grading.grade(NUM, answer=said).verdict == grading.CORRECT


def test_number_wrong_and_missing():
    assert grading.grade(NUM, answer="220 ohm").verdict == grading.WRONG
    assert grading.grade(NUM, answer="I got it").verdict == grading.UNCLEAR


def test_short_keywords():
    assert grading.grade(SHORT, answer="like poles repel each other").verdict == grading.CORRECT
    assert grading.grade(SHORT, answer="they repel").verdict == grading.PARTIAL
    assert grading.grade(SHORT, answer="they become hot").verdict == grading.WRONG

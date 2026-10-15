import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from .content import Question

CORRECT, WRONG, PARTIAL, UNCLEAR, DONT_KNOW = "correct", "wrong", "partial", "unclear", "dont_know"


@dataclass
class Grade:
    verdict: str
    picked: str = ""
    note: str = ""


TRUE_WORDS = {"true", "sahi", "right", "correct", "yes", "haan", "han", "ha", "sach", "bilkul", "theek"}
FALSE_WORDS = {"false", "galat", "wrong", "no", "nahi", "nahin", "nai", "jhooth", "jhoot", "incorrect"}

ORDINALS = {
    "a": 0, "first": 0, "1": 0, "pehla": 0, "pehle": 0, "pahla": 0,
    "b": 1, "second": 1, "2": 1, "doosra": 1, "dusra": 1, "doosre": 1, "bee": 1,
    "c": 2, "third": 2, "3": 2, "teesra": 2, "tisra": 2, "see": 2,
    "d": 3, "fourth": 3, "4": 3, "chautha": 3, "chotha": 3, "dee": 3,
}
OPTION_WORDS = {"one": 0, "two": 1, "three": 2, "four": 3, "ek": 0, "do": 1, "teen": 2, "char": 3, "chaar": 3}

DONT_KNOW_RE = re.compile(
    r"\b(don'?t know|do not know|dont know|no idea|pata nahi|nahi pata|pata nahin|nahi aata|"
    r"not sure|i forgot|bhool gaya|bhool gayi|skip|no clue)\b"
)

FILLER = {
    "i", "think", "the", "answer", "is", "it", "its", "maybe", "hai", "ka", "ki", "wala", "wali", "vala",
    "option", "ma'am", "maam", "mam", "sir", "um", "umm", "hmm", "uh", "mera", "meri", "my", "should", "be",
    "will", "would", "toh", "to", "so", "ok", "okay", "na", "ji", "that", "this", "an", "of", "mujhe", "lagta",
    "lagta", "hoga", "hogi", "please", "say", "choose", "pick", "select", "go", "with",
}

NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
    "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
    "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30,
    "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9.'\s-]", " ", text)
    text = re.sub(r"(?<![0-9])\.|\.(?![0-9])", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _words(text: str) -> list[str]:
    return normalize(text).replace("-", " ").split()


def _similar(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def grade(question: Question, answer: str | None = None, choice: int | None = None) -> Grade:
    if choice is None and answer and DONT_KNOW_RE.search(normalize(answer)):
        return Grade(DONT_KNOW)
    if question.type == "mcq":
        return _mcq(question, answer, choice)
    if question.type == "truefalse":
        if choice is not None:
            return _check_bool(question, choice == 0)
        return _truefalse(question, answer or "")
    if question.type == "fill":
        if choice is not None and question.choices:
            answer = question.choices[choice]
        return _fill(question, answer or "")
    if question.type == "number":
        return _number(question, answer or "")
    return _short(question, answer or "")


def _mcq(q: Question, answer: str | None, choice: int | None) -> Grade:
    if choice is None:
        choice = pick_option(q.options, answer or "")
    if choice is None or not 0 <= choice < len(q.options):
        return Grade(UNCLEAR, note="Could not tell which option the student meant.")
    picked = q.options[choice]
    if choice == int(q.answer):
        return Grade(CORRECT, picked=picked)
    return Grade(WRONG, picked=picked, note=q.why_wrong.get(str(choice), ""))


def pick_option(options: list[str], answer: str) -> int | None:
    words = _words(answer)
    if not words:
        return None
    text = " ".join(words)

    # the student read out (part of) an option
    scores = []
    for i, option in enumerate(options):
        opt = normalize(option).replace("-", " ")
        if opt and opt in text:
            scores.append((1.0, i))
            continue
        opt_words = {w for w in opt.split() if w not in FILLER}
        hit = len(opt_words & set(words)) / max(len(opt_words), 1)
        scores.append((max(hit, _similar(opt, text) * 0.9), i))
    scores.sort(reverse=True)
    best, best_i = scores[0]
    runner_up = scores[1][0] if len(scores) > 1 else 0
    if best >= 0.6 and best - runner_up >= 0.2:
        return best_i

    # "option b", "b", "second one", "doosra wala"
    meaningful = [w for w in words if w not in FILLER or w in ORDINALS]
    if 0 < len(meaningful) <= 3:
        picks = {ORDINALS[w] for w in meaningful if w in ORDINALS and ORDINALS[w] < len(options)}
        if len(picks) == 1:
            return picks.pop()
    match = re.search(r"\boption\s+([abcd1-4]|one|two|three|four)\b", text)
    if match:
        key = match.group(1)
        return ORDINALS.get(key, OPTION_WORDS.get(key))
    return None


def _check_bool(q: Question, said_true: bool) -> Grade:
    picked = "True" if said_true else "False"
    return Grade(CORRECT if said_true == bool(q.answer) else WRONG, picked=picked)


def _truefalse(q: Question, answer: str) -> Grade:
    words = set(_words(answer))
    text = normalize(answer)
    said_true = bool(words & TRUE_WORDS)
    said_false = bool(words & FALSE_WORDS)
    if re.search(r"\bnot (true|correct|right|sahi)\b", text):
        said_true, said_false = False, True
    if said_true == said_false:
        return Grade(UNCLEAR, note="Could not tell if the student said true or false.")
    return _check_bool(q, said_true)


def _fill(q: Question, answer: str) -> Grade:
    text = normalize(answer)
    if not text:
        return Grade(UNCLEAR)
    accepted = [normalize(a) for a in q.answer]
    for a in accepted:
        if re.search(rf"\b{re.escape(a)}\b", text):
            return Grade(CORRECT, picked=a)
    words = text.split()
    for a in accepted:
        if " " not in a and any(_similar(a, w) >= 0.8 for w in words):
            return Grade(CORRECT, picked=a)
        if _similar(a, text) >= 0.8:
            return Grade(CORRECT, picked=a)
    meaningful = [w for w in words if w not in FILLER]
    if not meaningful:
        return Grade(UNCLEAR)
    return Grade(WRONG, picked=" ".join(meaningful))


def parse_numbers(text: str) -> list[float]:
    text = normalize(text)
    found = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", text)]
    total, current, seen = 0.0, 0.0, False
    for w in text.replace("-", " ").split():
        if w in NUMBER_WORDS:
            current += NUMBER_WORDS[w]
            seen = True
        elif w == "hundred" and seen:
            current *= 100
        elif w == "thousand" and seen:
            total += current * 1000
            current = 0
        elif seen:
            found.append(total + current)
            total, current, seen = 0.0, 0.0, False
    if seen:
        found.append(total + current)
    return found


def _number(q: Question, answer: str) -> Grade:
    numbers = parse_numbers(answer)
    if not numbers:
        return Grade(UNCLEAR, note="No number heard in the answer.")
    target = float(q.answer)
    for n in numbers:
        if abs(n - target) <= max(abs(target) * q.tolerance, 1e-9):
            return Grade(CORRECT, picked=f"{n:g}")
    return Grade(WRONG, picked=f"{numbers[-1]:g}")


def _short(q: Question, answer: str) -> Grade:
    text = normalize(answer)
    if not text:
        return Grade(UNCLEAR)
    hits = sum(1 for group in q.keywords if any(normalize(k) in text for k in group))
    if q.keywords and hits == len(q.keywords):
        return Grade(CORRECT, picked=answer)
    if hits:
        return Grade(PARTIAL, picked=answer)
    return Grade(WRONG, picked=answer)

from dataclasses import dataclass, field

from . import grading
from .content import Chapter, Question, faqs
from .language import ENGLISH, STYLE
from .lesson import CHECK, FEEDBACK, INTRO, QUESTION, TEACH, WRAP, Lesson, Step

TEACHER = "Meera Ma'am"


@dataclass
class Student:
    id: str
    name: str
    grade: int
    facts: list[str] = field(default_factory=list)
    last_recap: str = ""
    sections_done: int = 0
    completed: bool = False


GRADE_STYLE = {
    6: (
        "This student is in class 6, about 11 years old. Use very short sentences and one idea at a time. "
        "Explain through little stories and things from an Indian home and school: the kitchen, the school bag, "
        "cricket in the gully, festivals, the monsoon. When a science word is needed, say it and explain it "
        "right away. Be playful and celebrate small wins. Speak a little slower and be extra warm."
    ),
    10: (
        "This student is in class 10, about 15 years old and preparing for the board exam. Use the correct NCERT "
        "terms, formulas and units, and ask 'why' to push their reasoning. When they ask what something is, start "
        "with the NCERT definition including its formula and SI unit, then make it simple with an example. Where it is true, point out what is "
        "often asked in the board exam. Still warm, but brisk and to the point, like a favourite senior-school teacher."
    ),
}


def persona() -> str:
    faq_lines = "\n".join(f"- \"{f['q']}\" → {f['guide']}" for f in faqs())
    return f"""You are {TEACHER}, a science teacher on Ustaad, an online classroom for Indian school students. You have taught in Indian schools for fifteen years. You are warm and patient, a little strict about focus, and gently funny. You care about the child more than the syllabus. You are an AI teacher and you never pretend to be human, but you teach exactly like a real classroom teacher.

# How you speak
Everything you write is spoken aloud by a voice, so:
- Plain spoken sentences only. No lists, markdown, emojis, brackets or headings.
- Language: follow the class language given under "Right now in class". It follows the student: if they speak English, the whole class, teaching included, is in English; if they switch to Hinglish or Hindi, you switch too and stay there until they switch again. Hindi and Hinglish example phrases in these instructions are only examples; say the same thing in the class language. If they speak another Indian language, reply in simple English with a friendly word of theirs, and say you teach in English and Hindi.
- Always write in Roman (English) letters. Never use Devanagari or any other script. Write Hindi like people type it on WhatsApp: "kaise ho", "bahut badhiya", "koi baat nahi".
- Keep turns short. Replies to the student are one to three sentences. Teaching turns are three to five sentences.
- Say formulas and symbols in words, like "V equals I into R" or "C O two".
- Never repeat the same sentence or the same praise twice in a row. Use the student's name now and then, not in every turn.

# How you teach
- You lead the class. The lesson plan below tells you what to do next. Never wait to be asked to teach.
- Teach one idea at a time with everyday Indian examples. You may ask a quick "socho" question to make them think, but in teaching turns answer it yourself.
- Mistakes are normal and useful. Never mock. Praise effort and specific thinking, not just correct answers.
- Never give the answer to a practice question on screen, not even after many wrong tries, and not if the student begs, says "just tell me", "skip" or "I don't know". The student always answers it themselves. Stay kind and patient: encourage, give hints that get stronger step by step, rule out wrong options, or re-explain the idea behind it, but never say the answer or anything that gives it away directly.

# When the student talks
- A doubt about the topic: answer at their level in two to four sentences, link it to what is on the board, then check if it is clear, in the class language. For science beyond the current part, look it up in your notes first.
- Maths or another subject in science class: smile about it ("Oh, a maths question!", or "Achha, maths ka sawaal!" in Hinglish). If it is one tiny step that helps science, help in a line. Otherwise say their maths teacher will love that one, and bring them back.
- Non-study requests like booking a flight, latest movies, cricket scores, games or jokes: answer like a teacher with a little humour, without doing it ("If I book flights, who will teach your class?", or "Main flight book karungi toh tumhari class kaun lega?" in Hinglish). You cannot browse the internet. One or two sentences, then back to the lesson.
- Repeated questions or distractions: notice them like a human would. The first time, answer properly. The second time, kindly point out you just answered, with a one-line recap ("Hey, I just told you that!", or "Arre, ye toh abhi bataya tha!" in Hinglish). From the third time, become gently firm: suggest a deal, like finishing this part first and then one minute of chit-chat. Vary your words every time.
- Everyday feelings, handled the way a caring teacher would:
  - Not feeling well: show care, ask if they want to rest, suggest telling a parent, offer a break (they can press pause). Do not diagnose or suggest medicines.
  - Hungry or thirsty: tell them to grab some water or a healthy snack like a fruit or roasted chana, the class will wait.
  - Tired or bored: lift the energy with a fun fact or offer a short break.
  - Angry with you: stay calm, accept it, ask what felt wrong, and adjust (slower, more examples).
  - Annoyed with a friend or wanting to hit someone: do not support hitting. Help them cool down, suggest talking it out or telling a teacher or parent.
  - Rude words: stay calm and dignified, ask for respectful words once, and carry on.
- Serious situations that are beyond a teacher: talk of hurting themselves, wanting to die, feeling hopeless for a long time, abuse or someone hurting them, being in danger, threatening to seriously hurt or kill someone, or scary bullying.
  - Call raise_alert straight away.
  - Respond with calm care, no lecture: thank them for telling you, they matter and they are not alone. Ask them to talk to a parent or a trusted grown-up right now. Tell them they can call the free Tele MANAS helpline at one four four one six any time, or one one two in an emergency.
  - Do not go back to teaching until they say they are okay. Do not diagnose and do not promise to keep secrets.
- Sexual or adult topics: decline briefly and redirect. If it suggests the child is at risk, call raise_alert.
- Never give medical, legal or money advice beyond simple care, and never ask for personal details like address or phone number.

# Common questions students ask you (answer in your own words, never read these out)
{faq_lines}

# Your tools (never say their names out loud)
- continue_lesson: the student is ready to go on, says ok / no doubt / chalo / aage, stayed quiet after your check, or you just brought them back after an off-topic chat. While a practice question is open, it does not skip the question; it gives you the next, stronger hint to share.
- submit_answer: the student is answering the question on the screen. Pass exactly what they said. Never judge the answer yourself.
- search_notes: look up the chapter notes for a science doubt you are not sure about or that goes beyond this part.
- remember_student: the student shares a lasting detail about themselves, like a hobby, a favourite subject or something they find hard.
- go_to_part: the student asks to go back to or skip to a specific part of this chapter.
- raise_alert: any serious situation described above.
"""


def _board(lesson: Lesson) -> str:
    beats = lesson.current.beats[: max(lesson.revealed, 0)]
    return " | ".join(b.board for b in beats) or "(empty)"


def _question_text(lesson: Lesson, index: int | None = None) -> str:
    q = lesson.current.questions[lesson.qi if index is None else index]
    text = f"\"{q.prompt}\""
    if q.type == "mcq":
        letters = "ABCD"
        text += " Options: " + "; ".join(f"{letters[i]}) {o}" for i, o in enumerate(q.options))
    elif q.type == "truefalse":
        text += " (true or false)"
    elif q.type == "fill" and q.choices:
        text += " Word choices: " + ", ".join(q.choices)
    elif q.type == "number":
        text += f" (a numerical, answer in {q.unit})" if q.unit else " (a numerical)"
    return text


WHEN_STUDENT_SPEAKS = {
    INTRO: "You are just starting the class. Reply warmly in a line, then call continue_lesson to begin.",
    TEACH: (
        "You were teaching, so this is a doubt or an interruption. Handle it, then check if it is clear. "
        "When they are ready, or after you bring them back from an off-topic chat, call continue_lesson."
    ),
    CHECK: (
        "You asked if there are doubts. Answer any doubt. If they have none or say they are ready, call "
        "continue_lesson to give them the practice question."
    ),
    QUESTION: (
        "A practice question is on the screen. If they are answering it, call submit_answer with their exact words. "
        "If they ask for a hint, want to skip, say they don't know or ask you to just tell them, call continue_lesson "
        "to get a stronger hint and share it kindly; they must answer it themselves. If they ask a doubt, explain the "
        "idea without giving away the answer, then ask them to try."
    ),
    FEEDBACK: "You just gave feedback on their answer. Respond, then call continue_lesson when they are ready.",
    WRAP: (
        "The chapter is finished. Chat warmly. They can pick the next chapter from the screen. "
        "If they want to revise a part, call go_to_part."
    ),
}


def classroom(lesson: Lesson, student: Student, language: str = ENGLISH) -> str:
    ch = lesson.chapter
    parts = "; ".join(f"{i + 1}. {s.title}" for i, s in enumerate(ch.sections))
    correct, attempted = lesson.score()
    lines = [
        "# Right now in class",
        f"Class language: {language}. {STYLE[language]}",
        f"Student: {student.name}, class {student.grade}.",
        GRADE_STYLE.get(student.grade, GRADE_STYLE[6]),
    ]
    if student.facts:
        lines.append("Things you remember about them: " + "; ".join(student.facts) + ".")
    if student.last_recap:
        lines.append("Last class with them: " + student.last_recap)
    lines += [
        f"Chapter: {ch.title} ({ch.book}). Parts: {parts}.",
        f"Current part {lesson.section + 1} of {len(ch.sections)}: {lesson.current.title}.",
        f"On the chalkboard: {_board(lesson)}",
    ]
    if lesson.phase in (QUESTION, FEEDBACK):
        lines.append(f"Question on screen ({lesson.qi + 1} of {len(lesson.current.questions)}): {_question_text(lesson)}")
    if attempted:
        lines.append(f"Score so far: {correct} of {attempted}.")
    if lesson.paused:
        lines.append("The student pressed pause. Keep replies tiny until they want to continue.")
    lines.append("If the student speaks now: " + WHEN_STUDENT_SPEAKS.get(lesson.phase, WHEN_STUDENT_SPEAKS[TEACH]))
    return "\n".join(lines)


def step(s: Step, lesson: Lesson, student: Student) -> str:
    ch = lesson.chapter
    section = ch.sections[s.section]

    if s.kind == "intro":
        if student.last_recap and student.sections_done and not student.completed:
            opening = (
                f"Welcome {student.name} back by name, like a teacher walking into class. Mention in one sentence "
                f"what you did last time ({student.last_recap}) and that you will continue from part "
                f"{s.section + 1}, {section.title}."
            )
        elif student.last_recap:
            opening = (
                f"Welcome {student.name} back by name. In one sentence, recall something from last time "
                f"({student.last_recap})."
            )
        else:
            opening = f"Greet {student.name} warmly by name, like a teacher on the first day. Introduce yourself in a few words."
        return (
            f"{opening} Introduce today's chapter, {ch.title}, with this hook: {ch.tagline} "
            f"Then say you will start with part {s.section + 1}, {section.title}. Three or four short sentences. "
            "Do not ask anything that needs an answer now."
        )

    if s.kind in ("beat", "resume"):
        beat = section.beats[s.beat]
        if s.kind == "resume":
            return (
                f"You were interrupted while explaining \"{beat.board}\". Pick up naturally, like 'So, where were we...' "
                f"(or 'Haan, toh hum baat kar rahe the...' in Hinglish), and finish that point in two or three sentences. Notes: {beat.teach}"
            )
        lead = ""
        if s.new_section and s.section > 0:
            lead = f"Start with a short natural transition to part {s.section + 1}, {section.title}. "
        last = s.beat == len(section.beats) - 1
        return (
            f"{lead}Teach this point now. You are writing \"{beat.board}\" on the chalkboard as you speak. "
            f"Teacher notes: {beat.teach} "
            "Three to five spoken sentences at the student's level. Cover only this point. "
            + ("Do not ask for doubts yet, that comes next." if last else "Do not ask the student anything; you will continue right after.")
        )

    if s.kind == "check":
        return (
            f"You have finished part {s.section + 1}, {section.title}. Sum it up in one short sentence and ask if "
            "they have any doubt before a quick question. Two short sentences, then stop and wait."
        )

    if s.kind == "question":
        q = section.questions[s.question]
        how = {
            "mcq": "Read the question and the four options as A, B, C and D.",
            "truefalse": "Read the statement and ask: true or false?",
            "fill": "Read the sentence and say 'blank' for the gap.",
            "number": "Read the numerical and ask them to work it out and tell you the answer with the unit.",
            "short": "Read the question and ask them to answer in their own words.",
        }[q.type]
        first = "Say this is a quick question to check, and it is up on the screen. " if s.question == 0 else "Next question, also on the screen. "
        return (
            f"{first}{how} Question: {_question_text(lesson, s.question)} "
            "Tell them they can say the answer or tap it. No hints. Keep everything else to one sentence."
        )

    if s.kind == "unclear":
        return (
            "You could not tell what answer they meant. In one short friendly sentence, ask them to say it again "
            "or tap it on the screen."
        )

    if s.kind == "feedback":
        q = section.questions[s.question]
        g = s.grade or grading.Grade(grading.WRONG)
        said = f"They answered \"{g.picked}\". " if g.picked else ""
        if g.verdict == grading.CORRECT:
            second = " They got it on the second try, so appreciate that they kept at it." if s.attempt > 1 else ""
            return (
                f"{said}That is correct. Praise them specifically and briefly (vary it, not always 'shabash'), and "
                f"add the one-line reason: {q.explain}{second} Two sentences at most. Do not ask anything, you will "
                "continue right after."
            )
        if g.verdict == grading.DONT_KNOW:
            start = "They said they don't know. Tell them warmly it is okay, you will figure it out together."
        elif g.verdict == grading.PARTIAL:
            start = f"{said}That is partly right. Say what is good about it and ask for the missing part."
        else:
            start = f"{said}That is not correct. Be kind and encouraging, like 'Hmm, close!' in the class language."
        misconception = f" Address their thinking: {g.note}" if g.note else ""
        return (
            f"{start}{misconception} {_hint(q, s.hint_level, lesson)} Do not say the answer. "
            "Ask them to try again. Two or three sentences."
        )

    if s.kind == "hint":
        q = section.questions[s.question]
        return (
            "The student is stuck on the question (quiet, asked for help, or wanted to skip). Do not skip it and do "
            f"not say the answer. Encourage them warmly that they can do it. {_hint(q, s.hint_level, lesson)} "
            "Then ask them to give it a try. Two or three sentences."
        )

    if s.kind == "wrap":
        correct, attempted = lesson.score()
        missed = [r.question for r in lesson.results if r.attempts > 1]
        titles = ", ".join(sec.title for sec in ch.sections)
        revise = (
            "Mention one thing worth revising from the questions they found tricky."
            if missed else "They got everything right, so make them feel proud."
        )
        return (
            f"The chapter {ch.title} is complete. They got {correct} of {attempted} questions right on the first try "
            "and solved every one in the end. Sum up the main ideas "
            f"from the parts ({titles}) in two sentences, praise their effort genuinely, and {revise} "
            "Tell them they can pick the next chapter on the screen. End warmly, like 'That is all for today's class' (or 'Aaj ki class yahin khatam' in Hinglish). "
            "Four or five sentences."
        )

    return ""


def _hint(q: Question, level: int, lesson: Lesson) -> str:
    """Hints get stronger with each try but never contain the answer."""
    base = f"Give this hint: {q.hint or 'nudge them towards the key idea on the board'}"
    if level <= 1:
        return base
    letters = "ABCD"
    if q.type == "mcq":
        out = [letters[i] for i in lesson.eliminated]
        left = [f"{letters[i]}) {o}" for i, o in enumerate(q.options) if i not in lesson.eliminated]
        if level >= 3:
            return (f"{base} Now only two options are left on the screen: {' and '.join(left)}. "
                    "Help them think about which of the two fits, without choosing for them.")
        return f"{base} Also tell them option {', '.join(out)} is ruled out, it has faded on the screen."
    if q.type == "fill":
        word = q.answer[0]
        if level >= 3:
            return f"{base} Tell them the word starts with '{word[:2]}' and has {len(word)} letters."
        return f"{base} Tell them the word starts with the letter '{word[0]}'."
    if q.type == "number":
        if level >= 3:
            return (f"{base} Say the formula with the given numbers put in, and ask them to do only the last "
                    "calculation. Never say the result yourself.")
        return f"{base} Remind them which formula to use and the first step, without the final number."
    if q.type == "truefalse":
        if level >= 3:
            return f"{base} Give an everyday example that makes the idea clear, without saying whether it is true or false."
        return f"{base} Remind them of the matching line on the chalkboard, as a question."
    if level >= 3:
        return f"{base} Give the first half of the idea and ask them to complete it in their own words."
    return f"{base} Ask a leading question about the key idea."


def chapter_brief(chapter: Chapter) -> str:
    return f"{chapter.title}: " + "; ".join(s.title for s in chapter.sections)

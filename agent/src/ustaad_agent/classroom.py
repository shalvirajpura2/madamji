"""Connects the lesson engine to the live voice session.

The engine decides what happens next; this class makes the teacher say it, notices when she
finished or got interrupted, keeps the student's screen in sync, and handles taps from the UI."""

import asyncio
import json
import logging
import time

from livekit.agents import AgentSession, JobContext, RunContext
from livekit.agents.voice import SpeechHandle

from . import backend, drawing, grading, language, notes, prompts
from .content import Question
from .language import ENGLISH
from .lesson import CHECK, DOUBTS, FEEDBACK, INTRO, QUESTION, TEACH, Lesson, Step, is_filler
from .config import settings
from .models import ask_json
from .transcript import Transcript
from .prompts import Student
from .safety import Monitor
from .teacher import Teacher

logger = logging.getLogger("ustaad.classroom")

NORMAL_TURN = {"min_delay": 0.5, "max_delay": 2.5}
THINKING_TURN = {"min_delay": 1.2, "max_delay": 4.5}  # kids pause mid-answer, give them time


class Classroom:
    def __init__(
        self, ctx: JobContext, session: AgentSession, lesson: Lesson, student: Student, tts, minutes: int = 15
    ):
        self.ctx = ctx
        self.minutes = minutes
        self.ends_at = time.time() + minutes * 60
        self.session = session
        self.lesson = lesson
        self.student = student
        self.tts = tts
        self.monitor = Monitor({"id": student.id, "name": student.name}, lesson.chapter.id)
        self.language = ENGLISH  # until the student shows otherwise
        self.transcript = Transcript(
            room=getattr(ctx.room, "name", "local") or "local",
            student={"id": student.id, "name": student.name, "grade": student.grade},
            chapter=lesson.chapter,
            minutes=minutes,
            models={
                "llm": settings.llm_model,
                "llmFallback": settings.llm_fallback,
                "tts": settings.tts_provider,
                "voice": settings.eleven_voice if settings.tts_provider == "elevenlabs" else settings.tts_speaker,
                "stt": settings.stt_model,
            },
        )
        self.teacher = Teacher(self, self._instructions())
        self.mood = "calm"
        self._steps: dict[str, Step] = {}
        self._quiet_count = 0
        self._doubts: list[str] = []
        self._last_said = ""
        self._saved_sections = lesson.sections_done
        self._advance: asyncio.Task | None = None
        self._closing = False
        self._clock: asyncio.Task | None = None
        self._paused_at = 0.0
        self.drawing: dict | None = None  # what Ma'am drew on the board for a doubt
        self._drawings = 0
        self._drawn_for = ""  # the student turn that already got a drawing
        self._last_user_seen = ""
        self.turn_place: str | None = None  # where the latest student turn belongs, see notes.place
        self._quiet_turn = False  # she decided the last words were not meant for her
        self._parked_for: tuple[str, str] | None = None  # (student turn, doubt) just put on the doubt list
        self.turn_addressed = True

    # ---- setup ----

    async def start(self) -> None:
        lp = self.ctx.room.local_participant
        for name, handler in {
            "answer": self._rpc_answer,
            "raise_hand": self._rpc_raise_hand,
            "pause": self._rpc_pause,
            "resume": self._rpc_resume,
            "continue": self._rpc_continue,
        }.items():
            lp.register_rpc_method(name, self._guarded(handler))

        self.session.on("user_state_changed", self._on_user_state)
        self.session.on("user_input_transcribed", self._on_transcript)
        self.session.on("error", self._on_error)
        self.session.on("close", self._on_close)
        self.session.on("conversation_item_added", self._on_item)
        self.session.on("function_tools_executed", self._on_tools)
        self.ctx.add_shutdown_callback(self._shutdown)

        self.ends_at = time.time() + self.minutes * 60
        self._clock = asyncio.create_task(self._watch_clock())
        from_section = self.student.sections_done if not self.student.completed else 0
        await self.run(self.lesson.start(from_section))

    def _instructions(self) -> str:
        clock = prompts.timing(self.minutes, self.ends_at - time.time(), self.lesson)
        return prompts.persona(self.lesson.chapter.id) + "\n\n" + prompts.classroom(self.lesson, self.student, self.language, clock)

    def note_language(self, text: str) -> bool:
        """Switch the class language when the student switches. Returns True if it changed.
        The next instructions refresh carries it into the system prompt too."""
        found = language.detect(text)
        if found is None or found == self.language:
            return False
        logger.info("class language: %s -> %s", self.language, found)
        self.transcript.event("language", language=found)
        self.language = found
        return True

    async def _refresh(self) -> None:
        await self.teacher.update_instructions(self._instructions())
        await self.publish()

    async def publish(self, status: str = "ok") -> None:
        snap = self.lesson.snapshot()
        snap["mood"] = self.mood
        snap["status"] = status
        snap["minutes"] = self.minutes
        snap["endsAt"] = int(self.ends_at * 1000)
        snap["drawing"] = self.drawing
        snap["pausedAt"] = int(self._paused_at * 1000) if self._paused_at else None
        try:
            await self.ctx.room.local_participant.set_attributes({"lesson": json.dumps(snap)})
        except Exception as e:
            logger.warning("could not publish lesson state: %s", e)

    # ---- running steps ----

    async def run(self, step: Step | None, lead: str = "") -> None:
        if step is None:
            await self.publish()
            return
        self._voice_for(step)
        await self._trim_history()
        await self._refresh()
        self.transcript.step(step, self.lesson)
        if step.kind in ("beat", "question", "wrap"):
            self.drawing = None
        handle = self.session.generate_reply(
            instructions=lead + prompts.step(step, self.lesson, self.student),
            tool_choice="none",
        )
        self._track(handle, step)
        self._save_if_progressed()

    async def _tool_step(self, ctx: RunContext, step: Step) -> str:
        self.transcript.step(step, self.lesson)
        if step.kind in ("beat", "question", "wrap"):
            self.drawing = None
        self._voice_for(step)
        await self._refresh()
        self._track(ctx.speech_handle, step)
        self._save_if_progressed()
        lead = ""
        if self._parked_for and self._parked_for[0] == self._last_user_seen:
            lead = (f"First, in one warm line, tell them their doubt about \"{self._parked_for[1]}\" is on the doubt "
                    "list and you will answer it before the class ends, unless you already said so. Then: ")
            self._parked_for = None
        return "Do this now, in this same reply: " + lead + prompts.step(step, self.lesson, self.student)

    def _track(self, handle: SpeechHandle, step: Step) -> None:
        if handle.id not in self._steps:
            handle.add_done_callback(self._on_done)
        self._steps[handle.id] = step

    def _on_done(self, handle: SpeechHandle) -> None:
        step = self._steps.pop(handle.id, None)
        if step is None or self._closing:
            return
        if handle.interrupted:
            if step.kind in ("intro", "beat", "resume"):
                said = " ".join(
                    i.text_content or "" for i in handle.chat_items if getattr(i, "role", None) == "assistant"
                )
                if step.kind == "resume":
                    said = f"{self.lesson.cut_off} {said}"
                self.lesson.mark_interrupted(said)
            return
        if step.kind == "wrap":
            self.mood = "proud"
            self._save()
            asyncio.create_task(self.publish())
            return
        if step.auto_next:
            self._advance = asyncio.create_task(self._auto_advance())

    async def _auto_advance(self) -> None:
        await asyncio.sleep(0.35)
        if self.session.user_state == "speaking" or self.lesson.paused:
            return  # the student took the floor; their turn decides what happens next
        await self.run(self.lesson.advance())

    def _voice_for(self, step: Step) -> None:
        verdict = step.grade.verdict if step.grade else None
        pace = 1.0
        if step.kind in ("intro", "beat", "resume"):
            pace = 0.92 if self.student.grade <= 6 else 0.98
            self.mood = "explaining"
        elif step.kind == "question":
            self.mood = "curious"
        elif step.kind == "feedback" and verdict == grading.CORRECT:
            pace, self.mood = 1.04, "happy"
        elif step.kind in ("hint", "unclear") or (step.kind == "feedback" and step.retry):
            self.mood = "encouraging"
        elif step.kind == "feedback":
            self.mood = "kind"
        elif step.kind == "wrap":
            self.mood = "proud"
        else:
            self.mood = "calm"
        try:
            self.tts.update_options(pace=pace)
        except Exception as e:
            logger.debug("pace not updated: %s", e)
        turn = THINKING_TURN if self.lesson.phase == QUESTION else NORMAL_TURN
        self.session.update_options(endpointing_opts=turn)

    async def _trim_history(self) -> None:
        chat = self.teacher.chat_ctx
        if len(chat.items) > 60:
            chat = chat.copy()
            chat.truncate(max_items=40)
            await self.teacher.update_chat_ctx(chat)

    async def _interrupt(self) -> None:
        try:
            await self.session.interrupt()
        except RuntimeError:
            pass

    def _say(self, instructions: str, mood: str | None = None) -> None:
        if mood:
            self.mood = mood
        self.session.generate_reply(instructions=instructions, tool_choice="none")

    # ---- grading ----

    async def _grade(self, q: Question, text: str | None, choice: int | None) -> grading.Grade:
        result = grading.grade(q, answer=text, choice=choice)
        if q.type == "short" and text and result.verdict in (grading.WRONG, grading.PARTIAL):
            judged = await self._llm_judge(q, text)
            if judged:
                result = grading.Grade(judged, picked=text)
        return result

    async def _llm_judge(self, q: Question, text: str) -> str | None:
        prompt = (
            f"A class {self.student.grade} student answered a science question out loud.\n"
            f"Question: {q.prompt}\nModel answer: {q.sample}\nStudent said: {json.dumps(text)}\n"
            "Judge the science, not the grammar or language (Hinglish is fine). "
            'Reply as JSON: {"verdict": "correct" | "partial" | "wrong"}'
        )
        verdict = ((await ask_json(prompt, timeout=3)) or {}).get("verdict")
        return verdict if verdict in (grading.CORRECT, grading.PARTIAL, grading.WRONG) else None

    # ---- class clock ----

    async def _watch_clock(self) -> None:
        """Keeps the class inside its time: no new parts once time runs low, doubt time at the end."""
        while not self._closing:
            await asyncio.sleep(10)
            if self._paused_at:
                continue  # the clock stands still during a pause
            left = self.ends_at - time.time()
            reserve = 90 + 60 * min(self.lesson.doubts_left, 3)  # wrap-up plus about a minute per parked doubt
            if not self.lesson.out_of_time and left <= reserve + 120:
                logger.info("class clock: %.0fs left, no new parts from here", left)
                self.transcript.event("time_running_low", secondsLeft=int(left))
                self.lesson.out_of_time = True
                await self._refresh()
            busy = self.session.agent_state in ("speaking", "thinking") or self.session.user_state == "speaking"
            if left <= 0 and not busy and not self.lesson.paused:
                step = self.lesson.finish_early()
                if step is not None:
                    logger.info("class clock: time is up during %s", self.lesson.phase)
                    await self.run(step, lead="The class time is up, so stop teaching here. ")

    def note_student_turn(self, message_id: str, text: str) -> None:
        """Counts a new student turn during teaching as a live doubt, so the teacher knows when to park.
        Acknowledgements like "okay" or "samajh gaya" are not doubts."""
        if message_id == self._last_user_seen:
            return
        self._last_user_seen = message_id
        self.turn_place = None
        self.turn_addressed = notes.addressed(text)
        if self.lesson.phase in (TEACH, CHECK):
            self.turn_place = notes.place(text, self.lesson.chapter.id, self.lesson.section)
            # doubts about the board right now are always answered, so only other parts use up the limit
            if self.turn_place == notes.CHAPTER:
                self.lesson.note_live_doubt()

    def is_backchannel(self, text: str) -> bool:
        """True for "yeah", "haan", "okay ma'am" said while she is speaking: a sign of listening, not
        a turn. Dropping it lets the paused speech resume from the same word."""
        speech = self.session.current_speech
        return speech is not None and not speech.interrupted and is_filler(text)

    def note_backchannel(self, text: str) -> None:
        self.transcript.event("backchannel", text=text)

    def tool_ignore(self) -> str:
        self._quiet_turn = True
        self.transcript.event("ignored_side_talk")
        if self.lesson.phase in (INTRO, TEACH) and self.lesson.interrupted:
            self._advance = asyncio.create_task(self._resume_after_side_talk())
        return "Stay silent now. Say nothing at all."

    def take_quiet_turn(self) -> bool:
        quiet, self._quiet_turn = self._quiet_turn, False
        return quiet

    async def _resume_after_side_talk(self) -> None:
        await asyncio.sleep(1.2)
        if self.session.user_state == "speaking" or self.lesson.paused or self._closing:
            return
        await self.run(self.lesson.proceed())

    @property
    def is_paused(self) -> bool:
        return bool(self._paused_at)

    def should_park(self) -> bool:
        from .lesson import LIVE_DOUBTS_PER_PART

        if self.lesson.phase not in (TEACH, CHECK) or self.turn_place != notes.CHAPTER:
            return False
        return self.lesson.live_doubts > LIVE_DOUBTS_PER_PART or self.lesson.out_of_time

    # ---- tools (called by the teacher LLM) ----

    async def tool_continue(self, ctx: RunContext) -> str:
        self._quiet_count = 0
        step = self.lesson.proceed()
        if step is None:
            await self._refresh()
            return "Nothing to move on to right now. Just reply naturally."
        return await self._tool_step(ctx, step)

    async def tool_answer(self, ctx: RunContext, answer: str) -> str:
        if self.lesson.phase != QUESTION:
            return "No question is waiting for an answer right now. Reply normally."
        self._quiet_count = 0
        q = self.lesson.current.questions[self.lesson.qi]
        result = await self._grade(q, answer, None)
        step = self.lesson.answer(result=result)
        return await self._tool_step(ctx, step)

    async def tool_park(self, doubt: str) -> str:
        where = notes.place(doubt, self.lesson.chapter.id, self.lesson.section)
        if where == notes.FILLER:
            return "That is not a doubt, so it was not added. Do not mention the doubt list; just carry on with continue_lesson."
        if where == notes.OTHER:
            return ("That is not about this chapter, so it was not added to the doubt list. Acknowledge what they "
                    "asked kindly in one line, bring them back to the board, and carry on with continue_lesson.")
        if where == notes.CURRENT and not self.lesson.out_of_time:
            return ("This doubt is about what you are teaching right now, so it was not parked. Answer it now, "
                    "briefly: first acknowledge exactly what they asked, explain, then tie it back to the board.")
        number = self.lesson.park(doubt)
        if number is not None:
            self._parked_for = (self._last_user_seen, doubt)
        if self.lesson.live_doubts > 0:
            self.lesson.live_doubts -= 1  # parked, not answered live
        await self._refresh()
        if number is None:
            return ("The doubt list is full. Kindly say you will take this one in the next class, or answer it in "
                    "one line if it is tiny, then carry on.")
        return (f"Added as doubt number {number} on the list on the screen. In one warm line, acknowledge exactly what "
                "they asked (name the topic, like 'copper and magnets, good one'), say it is on the doubt list and "
                "you will answer it before the class ends, then call continue_lesson.")

    async def tool_draw(self, what: str, diagram_id: str = "", template: str = "", options: str = "") -> str:
        turn = self._last_user_seen
        if turn and turn == self._drawn_for:
            return ("One drawing at a time. Explain the drawing already on the board first, and offer to draw "
                    "something else after that. Do not mention any limit.")
        if notes.place(what, self.lesson.chapter.id, self.lesson.section) in (notes.OTHER, notes.FILLER):
            self.transcript.event("drawing_refused", what=what)
            return ("That is not part of today's chapter, so it was not drawn. Kindly say you will draw pictures "
                    "for today's chapter, without listing what you can draw, and bring them back to the board.")
        self._drawn_for = turn
        diagrams, templates = drawing.for_chapter(self.lesson.chapter.id)
        diagram_id = diagram_id if diagram_id in diagrams else ""
        template = template if template in templates else ""
        self._drawings += 1
        params = drawing.template_params(template, options) if template else None
        if params is not None:  # a template drawn for exactly what was asked beats a general diagram
            self.drawing = {"n": self._drawings, "kind": "template", "template": template, "params": params,
                            "title": what[:60]}
            self.transcript.event("drawing", kind="template", template=template, params=params, what=what)
            await self.publish()
            return (f"The drawing is on the board ({drawing.TEMPLATES[template].split(';')[0]}, {options}). Explain the "
                    "doubt using it, pointing to its parts, in three or four sentences.")
        if template and params is None:
            logger.info("draw template %s with bad options %r, falling back", template, options)
        if diagram_id:
            self.drawing = {"n": self._drawings, "kind": "diagram", "id": diagram_id, "title": what[:60]}
            self.transcript.event("drawing", kind="diagram", id=diagram_id, what=what)
            await self.publish()
            return (f"The diagram is now on the board ({drawing.DIAGRAMS[diagram_id]}). Explain the doubt "
                    "using it, pointing to its parts, in three or four sentences.")
        made = await drawing.sketch(what, self.student.grade)
        if made is None:
            self.transcript.event("drawing_failed", what=what)
            return ("The sketch did not come out. Say sorry lightly and explain it in words instead, describing the "
                    "picture simply.")
        self.drawing = {"n": self._drawings, "kind": "sketch", "title": made["title"], "svg": made["svg"]}
        self.transcript.event("drawing", kind="sketch", what=what, title=made["title"], facts=made["facts"], svg=made["svg"])
        await self.publish()
        return (f"Your sketch '{made['title']}' is now on the board. Explain the doubt using it, pointing to its parts, "
                "in three or four sentences. It is a quick sketch, so keep the explanation correct even if the "
                "drawing is rough.")

    def tool_search(self, query: str) -> str:
        return notes.search(query, grade=self.student.grade)

    def tool_remember(self, fact: str) -> str:
        fact = fact.strip()[:120]
        if fact and fact.lower() not in (f.lower() for f in self.student.facts):
            self.student.facts = (self.student.facts + [fact])[-8:]
            backend.send({"type": "fact", "studentId": self.student.id, "fact": fact})
        return "Saved. Do not mention saving it; just carry on naturally."

    async def tool_jump(self, ctx: RunContext, part_number: int) -> str:
        step = self.lesson.jump(part_number - 1)
        if step is None:
            return f"This chapter only has parts 1 to {len(self.lesson.chapter.sections)}. Tell them kindly."
        return await self._tool_step(ctx, step)

    def tool_alert(self, severity: str, category: str, summary: str) -> str:
        self.monitor.raise_alert(severity, category, summary, quote=self._last_said)
        self.transcript.event("safety_alert", severity=severity, category=category)
        self.lesson.paused = True
        self.mood = "concerned"
        asyncio.create_task(self._refresh())
        return (
            "The MadamJi safety team has been alerted quietly. Now respond with calm care as your instructions say. "
            "You may gently say a grown-up from the MadamJi team will also know, so someone can help. "
            "Stay with them and do not teach until they say they are okay. Do not mention the lesson at all in this reply."
        )

    # ---- events from the voice session ----

    def _on_user_state(self, ev) -> None:
        if ev.new_state == "speaking":
            self._quiet_count = 0
            if self._advance and not self._advance.done():
                self._advance.cancel()
        elif ev.new_state == "away":
            asyncio.create_task(self._on_quiet())

    async def _on_quiet(self) -> None:
        if self.lesson.paused or self._closing or self.session.agent_state in ("speaking", "thinking"):
            return
        self._quiet_count += 1
        phase = self.lesson.phase
        if phase == CHECK:
            await self.run(self.lesson.proceed(), lead="The student stayed quiet, so take it as no doubts. ")
        elif phase == QUESTION:
            # never answer for them: encourage first, then a stronger hint each silence, then just wait
            if self._quiet_count == 1:
                self._say(
                    "The student has been quiet on the question. Gently encourage them in one sentence: take your "
                    "time, think aloud, or ask for a hint. Do not give the answer.",
                    mood="encouraging",
                )
            elif self._quiet_count <= 4:
                await self.run(self.lesson.hint())
        elif phase in (INTRO, TEACH, FEEDBACK, DOUBTS):
            await self.run(self.lesson.proceed(), lead="The student is quiet after your reply, so carry on with the class. ")

    def _on_transcript(self, ev) -> None:
        if not ev.is_final or not ev.transcript.strip():
            return
        text = ev.transcript.strip()
        self._last_said = text
        asyncio.create_task(self.monitor.check(text))
        if self.lesson.phase in (TEACH, CHECK) and len(self._doubts) < 5 and len(text.split()) > 3:
            self._doubts.append(text[:100])

    def _on_item(self, ev) -> None:
        item = ev.item
        role = getattr(item, "role", None)
        if role in ("user", "assistant"):
            self.transcript.message(role, item.text_content or "", interrupted=getattr(item, "interrupted", False))

    def _on_tools(self, ev) -> None:
        for call, out in zip(ev.function_calls, ev.function_call_outputs):
            self.transcript.tool(call.name, call.arguments, getattr(out, "output", "") if out else "")

    def _on_error(self, ev) -> None:
        recoverable = getattr(ev.error, "recoverable", True)
        logger.error("session error (recoverable=%s): %s", recoverable, ev.error)
        if not recoverable:
            asyncio.create_task(self.publish(status="trouble"))

    def _on_close(self, ev) -> None:
        if ev.error is None or self._closing:
            return
        # the voice pipeline gave up; tell the screen, save progress, and leave the room
        logger.error("class ended by an error: %s", ev.error)
        self._closing = True
        self._save()
        self._save_transcript(error=str(ev.error)[:300])

        async def end() -> None:
            await self.publish(status="ended")
            await asyncio.sleep(1.5)
            self.ctx.shutdown(reason="voice pipeline error")

        asyncio.create_task(end())

    # ---- taps from the student's screen ----

    def _guarded(self, handler):
        async def run(data) -> str:
            if self._closing:
                return json.dumps({"ok": False, "reason": "class ended"})
            try:
                return await handler(data)
            except RuntimeError as e:  # session already closing
                logger.warning("rpc %s ignored: %s", data.method, e)
                return json.dumps({"ok": False})

        return run

    async def _rpc_answer(self, data) -> str:
        payload = json.loads(data.payload or "{}")
        q = self.lesson.question
        if self.lesson.phase != QUESTION or q is None or payload.get("questionId") != q.id:
            return json.dumps({"ok": False})
        await self._interrupt()
        self._quiet_count = 0
        result = await self._grade(q, payload.get("text"), payload.get("choice"))
        step = self.lesson.answer(result=result)
        await self.run(step)
        return json.dumps({"ok": True, "verdict": result.verdict})

    async def _rpc_raise_hand(self, data) -> str:
        await self._interrupt()
        self.lesson.mark_interrupted()
        self._say(
            "The student raised their hand. Stop and invite them in a few words, like 'Yes, tell me?' (or 'Haan, bolo beta?' in Hinglish)",
            mood="listening",
        )
        await self.publish()
        return "ok"

    async def _rpc_pause(self, data) -> str:
        """A real pause: she stops mid-sentence, stops listening, and the class clock stops."""
        if self._paused_at:
            return "ok"
        self._paused_at = time.time()
        if self._advance and not self._advance.done():
            self._advance.cancel()
        try:
            await self.session.interrupt(force=True)
        except RuntimeError:
            pass
        self.lesson.mark_interrupted()
        self.lesson.paused = True
        self.session.input.set_audio_enabled(False)
        self.transcript.event("pause")
        self.mood = "calm"
        await self._refresh()
        return "ok"

    async def _rpc_resume(self, data) -> str:
        if not self._paused_at:
            return "ok"
        self.ends_at += time.time() - self._paused_at
        self._paused_at = 0.0
        self.transcript.event("resume")
        self.session.input.set_audio_enabled(True)
        self.lesson.paused = False
        if self.lesson.phase == QUESTION:
            await self._refresh()
            self._say("The student is back from a break. Welcome them back in a few words and remind them of the "
                      "question on the screen in one line.", mood="curious")
        else:
            await self.run(self.lesson.proceed(), lead="The student is back from a short break. Welcome them back in a few words, then: ")
        return "ok"

    async def _rpc_continue(self, data) -> str:
        if self._paused_at:
            return await self._rpc_resume(data)
        await self._interrupt()
        self._quiet_count = 0
        await self.run(self.lesson.proceed())
        return "ok"

    # ---- memory ----

    def _recap(self) -> str:
        ch = self.lesson.chapter
        done = self.lesson.sections_done
        parts = ", ".join(s.title for s in ch.sections[:done]) or "the start of the chapter"
        correct, attempted = self.lesson.score()
        bits = [f"{ch.title}: covered {parts}"]
        if attempted:
            bits.append(f"got {correct} of {attempted} questions right")
        missed = []
        for r in self.lesson.results:
            if r.attempts <= 1:
                continue
            section = next(s for s in ch.sections if s.id == r.section)
            q = next(q for q in section.questions if q.id == r.question)
            missed.append(q.prompt.rstrip("?.:"))
        if missed:
            bits.append("found tricky: " + "; ".join(missed[:2]))
        if self._doubts:
            bits.append("asked about: " + "; ".join(self._doubts[:2]))
        return ", ".join(bits) + "."

    def _save(self) -> None:
        correct, attempted = self.lesson.score()
        self._saved_sections = self.lesson.sections_done
        backend.send({
            "type": "progress",
            "studentId": self.student.id,
            "chapterId": self.lesson.chapter.id,
            "sectionsDone": self.lesson.sections_done,
            "sections": len(self.lesson.chapter.sections),
            "completed": self.lesson.done,
            "correct": correct,
            "attempted": attempted,
            "recap": self._recap(),
        })

    def _save_if_progressed(self) -> None:
        if self.lesson.sections_done > self._saved_sections:
            self._save()

    async def _shutdown(self, *_) -> None:
        self._closing = True
        if self._clock:
            self._clock.cancel()
        if self.lesson.phase != INTRO or self.lesson.results:
            self._save()
        self._save_transcript()
        await backend.flush()

    def _save_transcript(self, error: str = "") -> None:
        correct, attempted = self.lesson.score()
        self.transcript.save({
            "sectionsDone": self.lesson.sections_done,
            "sections": len(self.lesson.chapter.sections),
            "completed": self.lesson.done,
            "firstTryCorrect": correct,
            "questions": attempted,
            "doubts": [{"text": d.text, "answered": d.answered} for d in self.lesson.doubts],
            "language": self.language,
            "error": error,
        })

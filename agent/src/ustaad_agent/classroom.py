"""Connects the lesson engine to the live voice session.

The engine decides what happens next; this class makes the teacher say it, notices when she
finished or got interrupted, keeps the student's screen in sync, and handles taps from the UI."""

import asyncio
import json
import logging

from livekit.agents import AgentSession, JobContext, RunContext
from livekit.agents.voice import SpeechHandle

from . import backend, grading, notes, prompts
from .content import Question
from .lesson import CHECK, FEEDBACK, INTRO, QUESTION, TEACH, Lesson, Step
from .models import ask_json
from .prompts import Student
from .safety import Monitor
from .teacher import Teacher

logger = logging.getLogger("ustaad.classroom")

NORMAL_TURN = {"min_delay": 0.5, "max_delay": 2.5}
THINKING_TURN = {"min_delay": 1.2, "max_delay": 4.5}  # kids pause mid-answer, give them time


class Classroom:
    def __init__(self, ctx: JobContext, session: AgentSession, lesson: Lesson, student: Student, tts):
        self.ctx = ctx
        self.session = session
        self.lesson = lesson
        self.student = student
        self.tts = tts
        self.monitor = Monitor({"id": student.id, "name": student.name}, lesson.chapter.id)
        self.teacher = Teacher(self, self._instructions())
        self.mood = "calm"
        self._steps: dict[str, Step] = {}
        self._quiet_count = 0
        self._doubts: list[str] = []
        self._last_said = ""
        self._saved_sections = lesson.sections_done
        self._advance: asyncio.Task | None = None
        self._closing = False

    # ---- setup ----

    async def start(self) -> None:
        lp = self.ctx.room.local_participant
        lp.register_rpc_method("answer", self._rpc_answer)
        lp.register_rpc_method("raise_hand", self._rpc_raise_hand)
        lp.register_rpc_method("pause", self._rpc_pause)
        lp.register_rpc_method("resume", self._rpc_resume)
        lp.register_rpc_method("continue", self._rpc_continue)

        self.session.on("user_state_changed", self._on_user_state)
        self.session.on("user_input_transcribed", self._on_transcript)
        self.session.on("error", self._on_error)
        self.ctx.add_shutdown_callback(self._shutdown)

        from_section = self.student.sections_done if not self.student.completed else 0
        await self.run(self.lesson.start(from_section))

    def _instructions(self) -> str:
        return prompts.persona() + "\n\n" + prompts.classroom(self.lesson, self.student)

    async def _refresh(self) -> None:
        await self.teacher.update_instructions(self._instructions())
        await self.publish()

    async def publish(self, status: str = "ok") -> None:
        snap = self.lesson.snapshot()
        snap["mood"] = self.mood
        snap["status"] = status
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
        handle = self.session.generate_reply(
            instructions=lead + prompts.step(step, self.lesson, self.student),
            tool_choice="none",
        )
        self._track(handle, step)
        self._save_if_progressed()

    async def _tool_step(self, ctx: RunContext, step: Step) -> str:
        self._voice_for(step)
        await self._refresh()
        self._track(ctx.speech_handle, step)
        self._save_if_progressed()
        return "Do this now, in this same reply: " + prompts.step(step, self.lesson, self.student)

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
                self.lesson.mark_interrupted()
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
        elif step.kind == "feedback" and step.retry:
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
        self.lesson.paused = True
        self.mood = "concerned"
        asyncio.create_task(self._refresh())
        return (
            "The Ustaad safety team has been alerted quietly. Now respond with calm care as your instructions say. "
            "You may gently say a grown-up from the Ustaad team will also know, so someone can help. "
            "Stay with them and do not teach until they say they are okay."
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
            if self._quiet_count == 1:
                self._say(
                    "The student has been quiet on the question. Gently encourage them in one sentence: take your "
                    "time, think aloud, or ask for a hint. Do not give the answer.",
                    mood="encouraging",
                )
            elif self._quiet_count == 2:
                q = self.lesson.current.questions[self.lesson.qi]
                self._say(f"Still quiet. Give this small hint in one or two sentences: {q.hint}", mood="encouraging")
            else:
                await self.run(self.lesson.proceed(), lead="The student did not answer for a long time. ")
        elif phase in (INTRO, TEACH, FEEDBACK):
            await self.run(self.lesson.proceed(), lead="The student is quiet after your reply, so carry on with the class. ")

    def _on_transcript(self, ev) -> None:
        if not ev.is_final or not ev.transcript.strip():
            return
        text = ev.transcript.strip()
        self._last_said = text
        asyncio.create_task(self.monitor.check(text))
        if self.lesson.phase in (TEACH, CHECK) and len(self._doubts) < 5 and len(text.split()) > 3:
            self._doubts.append(text[:100])

    def _on_error(self, ev) -> None:
        recoverable = getattr(ev.error, "recoverable", True)
        logger.error("session error (recoverable=%s): %s", recoverable, ev.error)
        if not recoverable:
            asyncio.create_task(self.publish(status="trouble"))

    # ---- taps from the student's screen ----

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
            "The student raised their hand. Stop and invite them in a few words, like 'Haan, bolo beta?'",
            mood="listening",
        )
        await self.publish()
        return "ok"

    async def _rpc_pause(self, data) -> str:
        await self._interrupt()
        self.lesson.mark_interrupted()
        self.lesson.paused = True
        self._say("The student pressed pause. Say okay in one short line, like 'Theek hai, chhota sa break. "
                  "Jab ready ho, resume dabana.'", mood="calm")
        await self._refresh()
        return "ok"

    async def _rpc_resume(self, data) -> str:
        self.lesson.paused = False
        if self.lesson.phase == QUESTION:
            await self._refresh()
            self._say("The student is back from a break. Welcome them back in a few words and remind them of the "
                      "question on the screen in one line.", mood="curious")
        else:
            await self.run(self.lesson.proceed(), lead="The student is back from a short break. Welcome them back in a few words, then: ")
        return "ok"

    async def _rpc_continue(self, data) -> str:
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
            if r.verdict == grading.CORRECT:
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
        if self.lesson.phase != INTRO or self.lesson.results:
            self._save()
        await backend.flush()

from collections.abc import AsyncIterable
from typing import TYPE_CHECKING, Literal

from livekit import rtc
from livekit.agents import Agent, ModelSettings, RunContext, function_tool, llm, stt

from . import notes, speech
from .language import STYLE

if TYPE_CHECKING:
    from .classroom import Classroom


async def _silence():
    return
    yield


class Teacher(Agent):
    def __init__(self, classroom: "Classroom", instructions: str) -> None:
        super().__init__(instructions=instructions)
        self.classroom = classroom

    async def stt_node(self, audio: AsyncIterable[rtc.AudioFrame], model_settings: ModelSettings):
        async for ev in Agent.default.stt_node(self, audio, model_settings):
            if (
                isinstance(ev, stt.SpeechEvent)
                and ev.type == stt.SpeechEventType.FINAL_TRANSCRIPT
                and ev.alternatives
                and self.classroom.is_backchannel(ev.alternatives[0].text)
            ):
                self.classroom.note_backchannel(ev.alternatives[0].text)
                continue  # she keeps talking; the session resumes her paused sentence
            yield ev

    def llm_node(self, chat_ctx: llm.ChatContext, tools, model_settings: ModelSettings):
        if self.classroom.is_paused or self.classroom.take_quiet_turn():
            return _silence()  # paused, or the last words were not meant for her
        # runs for spoken and typed turns alike: follow the student's latest language from this reply on
        last_user = next((m for m in reversed(chat_ctx.items) if getattr(m, "role", None) == "user"), None)
        if last_user is not None:
            self.classroom.note_language(last_user.text_content or "")
            self.classroom.note_student_turn(last_user.id, last_user.text_content or "")
        chat_ctx = chat_ctx.copy()
        note = f"Class language right now: {self.classroom.language}. {STYLE[self.classroom.language]}"
        note += self._doubt_note()
        chat_ctx.add_message(role="system", content=note)
        return Agent.default.llm_node(self, chat_ctx, tools, model_settings)

    def _doubt_note(self) -> str:
        where = self.classroom.turn_place
        if where == notes.CURRENT:
            return (" If the student just asked a doubt, it is about what you are teaching right now: answer it now, "
                    "whatever the doubt count. Acknowledge exactly what they asked, explain simply, then tie it back "
                    "to the board and carry on.")
        if where == notes.CHAPTER and self.classroom.should_park():
            return (" If the student just asked a doubt, it is about another part of this chapter and the live doubt "
                    "limit for this part is used up (or time is short): acknowledge exactly what they asked in one "
                    "line and call park_doubt with it instead of answering now.")
        if where == notes.CHAPTER:
            return (" If the student just asked a doubt, it is about this chapter: acknowledge exactly what they asked "
                    "and answer it now, briefly, then come back to the board.")
        if where == notes.OTHER and not self.classroom.turn_addressed:
            return (" These words are not about the lesson and do not seem to be said to you. If they are the "
                    "student talking to someone else or background voices, call ignore_side_talk and say nothing. "
                    "If they are clearly talking to you, reply briefly. Never put this on the doubt list.")
        if where == notes.OTHER:
            return " This is not about this chapter, so never put it on the doubt list."
        return ""

    def tts_node(self, text: AsyncIterable[str], model_settings: ModelSettings):
        return Agent.default.tts_node(self, speech.voice_stream(text), model_settings)

    def transcription_node(self, text: AsyncIterable[str], model_settings: ModelSettings):
        return speech.caption_stream(text)

    @function_tool()
    async def ignore_side_talk(self, context: RunContext) -> str:
        """The words you just heard were clearly not meant for you: the student talking to someone else
        at home, a TV or other voices, or broken words that make no sense in class. Call it on its own
        and say nothing. If unsure, do not call it; reply briefly instead."""
        return self.classroom.tool_ignore()

    @function_tool()
    async def continue_lesson(self, context: RunContext) -> str:
        """Move the class forward. Call when the student is ready to go on (says ok, no doubt,
        samajh gaya, chalo, aage), or right after you bring them back from an off-topic chat.
        While a practice question is open it never skips it: it returns a stronger hint to share
        when the student is stuck, asks for help, or asks you to skip or tell the answer."""
        return await self.classroom.tool_continue(context)

    @function_tool()
    async def submit_answer(self, context: RunContext, answer: str) -> str:
        """Submit the student's spoken attempt at the practice question on the screen.

        Args:
            answer: exactly what the student said as their answer, e.g. "option B", "repel", "440 ohm"
        """
        return await self.classroom.tool_answer(context, answer)

    @function_tool()
    async def park_doubt(self, context: RunContext, doubt: str) -> str:
        """Put the student's doubt on the class doubt list (shown on screen) to answer in doubt time at
        the end of class. Only for a real question about another part of this chapter, when the live
        doubt limit for this part is used up or time is almost up. Never park a doubt about what is on
        the board right now (answer it), replies like "okay" or "samajh gaya", or off-topic chat.

        Args:
            doubt: the doubt in a few words, e.g. "why is copper not magnetic"
        """
        return await self.classroom.tool_park(doubt)

    @function_tool()
    async def draw_on_board(
        self, context: RunContext, what: str, diagram_id: str = "", template: str = "", options: str = ""
    ) -> str:
        """Draw on the chalkboard to explain a doubt about today's chapter: when the student asks you to
        draw, show or explain with a picture, or a picture clearly helps. One drawing per reply, and never
        for anything outside today's chapter. First say a short line like "Let me draw that for you".
        Order of preference: a reviewed diagram if one fits exactly, else a drawing template, else leave both
        empty for a quick freehand sketch (only simple labelled pictures, never field lines or directions).

        Args:
            what: what to draw, e.g. "field lines between two north poles facing each other"
            diagram_id: one of the reviewed diagrams, if it fits exactly
            template: magnets, circuit, wire_field, ray or flow
            options: settings for the template, e.g. "N-N", "parallel 3 bulb", "up", "refraction air-glass",
                "Mouth > Stomach > Small intestine"
        """
        return await self.classroom.tool_draw(what, diagram_id, template, options)

    @function_tool()
    async def search_notes(self, context: RunContext, query: str) -> str:
        """Look up the MadamJi chapter notes for a science doubt.

        Args:
            query: the doubt as a few English keywords, e.g. "why compass points north earth magnet"
        """
        return self.classroom.tool_search(query)

    @function_tool()
    async def remember_student(self, context: RunContext, fact: str) -> str:
        """Remember a lasting detail the student shared about themselves, for future classes.

        Args:
            fact: short note, e.g. "loves cricket", "finds formulas hard", "has a younger sister"
        """
        return self.classroom.tool_remember(fact)

    @function_tool()
    async def go_to_part(self, context: RunContext, part_number: int) -> str:
        """Jump to a part of this chapter when the student asks to revise or skip to it.

        Args:
            part_number: the part number, starting from 1
        """
        return await self.classroom.tool_jump(context, part_number)

    @function_tool()
    async def raise_alert(
        self,
        context: RunContext,
        severity: Literal["medium", "high"],
        category: str,
        summary: str,
    ) -> str:
        """Quietly alert the MadamJi safety team about a serious situation: self-harm or suicidal
        talk, wanting to seriously hurt someone, abuse, danger, or severe distress.

        Args:
            severity: "high" for any risk to life or safety, otherwise "medium"
            category: a few words, e.g. "self-harm", "abuse at home", "threat to others"
            summary: one sentence about what the student said
        """
        return self.classroom.tool_alert(severity, category, summary)

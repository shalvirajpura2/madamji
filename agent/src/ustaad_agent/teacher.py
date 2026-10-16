from collections.abc import AsyncIterable
from typing import TYPE_CHECKING, Literal

from livekit.agents import Agent, ModelSettings, RunContext, function_tool, llm

from . import speech
from .language import STYLE

if TYPE_CHECKING:
    from .classroom import Classroom


class Teacher(Agent):
    def __init__(self, classroom: "Classroom", instructions: str) -> None:
        super().__init__(instructions=instructions)
        self.classroom = classroom

    def llm_node(self, chat_ctx: llm.ChatContext, tools, model_settings: ModelSettings):
        # runs for spoken and typed turns alike: follow the student's latest language from this reply on
        last_user = next((m for m in reversed(chat_ctx.items) if getattr(m, "role", None) == "user"), None)
        if last_user is not None:
            self.classroom.note_language(last_user.text_content or "")
        chat_ctx = chat_ctx.copy()
        chat_ctx.add_message(
            role="system",
            content=f"Class language right now: {self.classroom.language}. {STYLE[self.classroom.language]}",
        )
        return Agent.default.llm_node(self, chat_ctx, tools, model_settings)

    def tts_node(self, text: AsyncIterable[str], model_settings: ModelSettings):
        return Agent.default.tts_node(self, speech.voice_stream(text), model_settings)

    def transcription_node(self, text: AsyncIterable[str], model_settings: ModelSettings):
        return speech.caption_stream(text)

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
    async def search_notes(self, context: RunContext, query: str) -> str:
        """Look up the Ustaad chapter notes for a science doubt.

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
        """Quietly alert the Ustaad safety team about a serious situation: self-harm or suicidal
        talk, wanting to seriously hurt someone, abuse, danger, or severe distress.

        Args:
            severity: "high" for any risk to life or safety, otherwise "medium"
            category: a few words, e.g. "self-harm", "abuse at home", "threat to others"
            summary: one sentence about what the student said
        """
        return self.classroom.tool_alert(severity, category, summary)

import json
import logging

from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    STTContextOptions,
    TurnHandlingOptions,
    cli,
    room_io,
)
from livekit.plugins import google, noise_cancellation, sarvam, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from . import content
from .classroom import NORMAL_TURN, Classroom
from .config import settings
from .lesson import Lesson
from .prompts import Student

logger = logging.getLogger("ustaad")

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()
    content.chapters()


server.setup_fnc = prewarm


def read_metadata(raw: str) -> tuple[Student, str]:
    try:
        meta = json.loads(raw or "{}")
    except json.JSONDecodeError:
        meta = {}
    s = meta.get("student") or {}
    progress = meta.get("progress") or {}
    grade = int(s.get("grade") or 6)
    student = Student(
        id=s.get("id") or "guest",
        name=(s.get("name") or "beta").strip()[:40],
        grade=grade,
        facts=list(s.get("facts") or [])[:8],
        last_recap=progress.get("recap") or "",
        sections_done=int(progress.get("sectionsDone") or 0),
        completed=bool(progress.get("completed")),
    )
    chapter_id = meta.get("chapterId")
    if chapter_id not in content.chapters():
        same_grade = [c.id for c in content.chapters().values() if c.grade == grade]
        chapter_id = (same_grade or list(content.chapters()))[0]
    return student, chapter_id


@server.rtc_session(agent_name=settings.agent_name)
async def classroom_session(ctx: JobContext) -> None:
    student, chapter_id = read_metadata(ctx.job.metadata)
    chapter = content.chapter(chapter_id)
    ctx.log_context_fields = {"room": ctx.room.name, "chapter": chapter_id, "student": student.id}
    logger.info("class starting: %s, grade %s, %s", student.name, student.grade, chapter.title)

    tts = sarvam.TTS(
        model=settings.tts_model,
        speaker=settings.tts_speaker,
        target_language_code=settings.tts_language,
    )
    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=sarvam.STT(model=settings.stt_model, mode=settings.stt_mode, language="unknown"),
        llm=google.LLM(
            model=settings.llm_model,
            temperature=0.8,
            thinking_config={"thinking_level": "minimal"},
        ),
        tts=tts,
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
            endpointing=NORMAL_TURN,
            interruption={
                "mode": "adaptive",
                "min_duration": 0.4,
                "resume_false_interruption": True,
                "false_interruption_timeout": 1.5,
            },
            preemptive_generation={"enabled": True},
        ),
        stt_context_options=STTContextOptions(keyterms=chapter.keyterms + ["Ustaad", "Meera Ma'am"]),
        user_away_timeout=8.0,
        max_tool_steps=3,
    )

    lesson = Lesson(chapter, sections_done=0 if student.completed else student.sections_done)
    classroom = Classroom(ctx, session, lesson, student, tts)

    await session.start(
        agent=classroom.teacher,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(noise_cancellation=noise_cancellation.BVC()),
        ),
    )
    await ctx.connect()
    await classroom.start()


def main() -> None:
    cli.run_app(server)


if __name__ == "__main__":
    main()

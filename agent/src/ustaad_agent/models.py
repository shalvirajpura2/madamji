"""Model wiring. A model name with a provider prefix ("openai/gpt-4.1-mini", "google/gemini-3.5-flash")
goes through LiveKit Inference on the LiveKit key; a bare Gemini name uses the Gemini API directly."""

import asyncio
import json
import logging

from livekit.agents import inference, llm, tts
from livekit.plugins import elevenlabs, google, sarvam

from .config import settings

logger = logging.getLogger("ustaad.models")


def make_llm(model: str) -> llm.LLM:
    if "/" in model:
        return inference.LLM(model=model)
    return google.LLM(model=model, temperature=0.8, thinking_config={"thinking_level": "minimal"})


def teacher_llm() -> llm.LLM:
    """Primary model with an automatic switch to a backup if it errors or stalls."""
    models = [m for m in (settings.llm_model, settings.llm_fallback) if m]
    if len(models) == 1:
        return make_llm(models[0])
    return llm.FallbackAdapter([make_llm(m) for m in models], attempt_timeout=6.0)


def teacher_tts(provider: str | None = None, voice: str | None = None, **kw) -> tts.TTS:
    """The teacher's voice. TTS_PROVIDER picks Sarvam (built in India for Indic speech)
    or ElevenLabs v4 Turbo (expressive, multilingual)."""
    provider = provider or settings.tts_provider
    if provider == "elevenlabs":
        return elevenlabs.TTS(
            voice_id=voice or settings.eleven_voice,
            model=settings.eleven_model,
            voice_settings=elevenlabs.VoiceSettings(stability=0.5, similarity_boost=0.75),
            **kw,
        )
    return sarvam.TTS(
        model=settings.tts_model,
        speaker=voice or settings.tts_speaker,
        target_language_code=settings.tts_language,
        **kw,
    )


_side: llm.LLM | None = None


async def ask_json(prompt: str, timeout: float = 4.0) -> dict | None:
    """One short background question to the side model, answered as JSON."""
    global _side
    _side = _side or make_llm(settings.side_model)
    ctx = llm.ChatContext()
    ctx.add_message(role="system", content="Reply with a single JSON object and nothing else.")
    ctx.add_message(role="user", content=prompt)

    async def run() -> str:
        text = ""
        async with _side.chat(chat_ctx=ctx) as stream:
            async for chunk in stream:
                if chunk.delta and chunk.delta.content:
                    text += chunk.delta.content
        return text

    try:
        text = await asyncio.wait_for(run(), timeout=timeout)
        start, end = text.find("{"), text.rfind("}")
        return json.loads(text[start : end + 1]) if start >= 0 else None
    except Exception as e:
        logger.warning("side model failed: %s", e)
        return None

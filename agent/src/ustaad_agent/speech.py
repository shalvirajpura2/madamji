"""Text clean-up between the LLM and the voice: pronunciation glossary for the TTS,
and a Roman-script safety net for the captions."""

import re
from collections.abc import AsyncIterable
from functools import cache

from .content import glossary

DEVANAGARI = re.compile(r"[ऀ-ॿ]")


@cache
def _rules() -> list[tuple[re.Pattern, str]]:
    data = glossary()
    rules = []
    for term, say in sorted(data["words"], key=lambda w: -len(w[0])):
        flags = re.IGNORECASE if term.islower() else 0
        rules.append((re.compile(rf"(?<![A-Za-z0-9]){re.escape(term)}(?![A-Za-z0-9])", flags), say))
    for symbol, say in data["symbols"]:
        rules.append((re.compile(re.escape(symbol)), say))
    return rules


def for_voice(text: str) -> str:
    for pattern, say in _rules():
        text = pattern.sub(say, text)
    text = re.sub(r"(?<=\w)\s*=\s*(?=\w)", " equals ", text)
    return text


async def voice_stream(chunks: AsyncIterable[str]) -> AsyncIterable[str]:
    """Apply the glossary to streamed LLM text without splitting a word across chunks."""
    buffer = ""
    async for chunk in chunks:
        buffer += chunk
        cut = max(buffer.rfind(" "), buffer.rfind("\n"))
        if cut <= 0:
            continue
        ready, buffer = buffer[: cut + 1], buffer[cut + 1 :]
        yield for_voice(ready)
    if buffer:
        yield for_voice(buffer)


def to_roman(text: str) -> str:
    if not DEVANAGARI.search(text):
        return text
    try:
        from indic_transliteration import sanscript
        from indic_transliteration.sanscript import transliterate
    except ImportError:
        return DEVANAGARI.sub("", text)
    roman = transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)
    return re.sub(r"[~^.]", "", roman).replace("A", "aa").replace("I", "ee").replace("U", "oo").lower()


async def caption_stream(chunks: AsyncIterable[str]) -> AsyncIterable[str]:
    async for chunk in chunks:
        yield to_roman(chunk)

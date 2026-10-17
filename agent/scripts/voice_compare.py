"""Blind voice comparison: the same teacher lines from each candidate voice.

Writes WAV files plus voice_samples/index.html, where the voices hide behind letters
until you open "Reveal". Time to first audio is measured from this machine.
Run: ./dev.sh compare-voices  (needs SARVAM_API_KEY and ELEVEN_API_KEY)"""

import asyncio
import html
import random
import statistics
import time
from pathlib import Path

import aiohttp
from livekit import rtc

from ustaad_agent.models import teacher_tts
from ustaad_agent.speech import for_voice

LINES = [
    ("hinglish-explain", "Dekho, jab hum magnet ko iron filings mein rakhte hain, toh zyada filings dono ends pe chipak "
                         "jaati hain. Inhi ends ko hum poles kehte hain."),
    ("english-explain", "A magnet always has two poles, a north pole and a south pole. Even if you break it into two, "
                        "each piece still has both poles. Isn't that interesting?"),
    ("praise", "Shabash Aarav! Bilkul sahi jawab. Iron nail magnetic material se bana hota hai, isliye magnet use "
               "kheench leta hai."),
    ("hint", "Hmm, close tha! Ek baar aur socho. Kya magnet plastic ki scale ko kheenchta hai?"),
    ("hard-words", "NCERT ki book mein Oersted ka experiment aur solenoid, dono board exam ke liye bahut important hain."),
    ("hindi-care", "Koi baat nahi beta, galti se hi hum seekhte hain. Chalo, ek baar phir saath mein try karte hain."),
]

VOICES = [
    ("sarvam", "simran_enhi_companion", "Sarvam Bulbul v4 · Simran (Hinglish)"),
    ("sarvam", "ishita_enhi_companion", "Sarvam Bulbul v4 · Ishita (Hinglish)"),
    ("elevenlabs", "a6XidOEnTywSiWFoBUhm", "ElevenLabs v4 Turbo · Anjura (professor style)"),
    ("elevenlabs", "MwUMLXurEzSN7bIfIdXF", "ElevenLabs v4 Turbo · Tripti (calm, experienced)"),
    ("elevenlabs", "EaBs7G1VibMrNAuz2Na7", "ElevenLabs v4 Turbo · Monika Sogam (conversational)"),
    ("elevenlabs", "kL06KYMvPY56NluIQ72m", "ElevenLabs v4 Turbo · Varsha (warm, clear)"),
]

OUT = Path(__file__).resolve().parents[1] / "voice_samples"


async def speak(engine, text: str) -> tuple[bytes, float]:
    # streaming, the same way a live class sends text to the voice
    start = time.perf_counter()
    first = None
    frames = []
    stream = engine.stream()
    stream.push_text(for_voice(text))
    stream.end_input()
    async with stream:
        async for ev in stream:
            first = first or time.perf_counter() - start
            frames.append(ev.frame)
    return rtc.combine_audio_frames(frames).to_wav_bytes(), first or 0.0


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.wav"):
        old.unlink()
    codes = random.sample("ABCDEFGHJK", len(VOICES))
    results: dict[str, dict] = {}
    async with aiohttp.ClientSession() as http:
        for (provider, voice, label), code in zip(VOICES, codes):
            engine = teacher_tts(provider, voice, http_session=http)
            timings = []
            try:
                await speak(engine, "Namaste.")  # warm the connection, like a live class would be
                for name, text in LINES:
                    audio, ttfa = await speak(engine, text)
                    (OUT / f"{name}_{code}.wav").write_bytes(audio)
                    timings.append(ttfa)
                results[code] = {"label": label, "ttfa": statistics.median(timings), "ok": True}
                print(f"{code}: {label}  median time to first audio {statistics.median(timings) * 1000:.0f} ms")
            except Exception as e:
                results[code] = {"label": label, "ttfa": 0, "ok": False, "error": str(e)[:200]}
                print(f"{code}: {label}  FAILED: {e}")
            finally:
                await engine.aclose()
    write_page(results)
    print(f"\nOpen {OUT / 'index.html'}")


def write_page(results: dict[str, dict]) -> None:
    ok = sorted(c for c, r in results.items() if r["ok"])
    rows = []
    for name, text in LINES:
        players = "".join(
            f'<div class="p"><b>{c}</b><audio controls preload="none" src="{name}_{c}.wav"></audio></div>' for c in ok
        )
        rows.append(f"<section><h2>{html.escape(name)}</h2><p>{html.escape(text)}</p>{players}</section>")
    reveal = "".join(
        f"<li><b>{c}</b>: {html.escape(r['label'])} · "
        + (f"{r['ttfa'] * 1000:.0f} ms to first audio" if r["ok"] else f"failed: {html.escape(r['error'])}")
        + "</li>"
        for c, r in sorted(results.items())
    )
    (OUT / "index.html").write_text(
        f"""<!doctype html><meta charset="utf-8"><title>Ustaad voice test</title>
<style>body{{font:16px system-ui;max-width:900px;margin:24px auto;padding:0 16px;background:#fff6e8;color:#2b2118}}
section{{background:#fff;border-radius:16px;padding:12px 16px;margin:12px 0}}.p{{display:flex;gap:8px;align-items:center;margin:4px 0}}
audio{{height:32px;flex:1}}</style>
<h1>Which voice sounds most like a warm Indian teacher?</h1>
<p>Listen line by line and note your favourite letter for Hindi pronunciation, Hinglish flow and warmth. Then reveal.</p>
{''.join(rows)}
<details><summary>Reveal voices and latency</summary><ul>{reveal}</ul></details>""",
        encoding="utf-8",
    )


if __name__ == "__main__":
    asyncio.run(main())

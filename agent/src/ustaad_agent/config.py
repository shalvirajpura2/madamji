import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / "agent" / ".env.local")
load_dotenv(ROOT / "agent" / ".env")


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    agent_name: str = _env("AGENT_NAME", "ustaad-teacher")
    content_dir: Path = Path(_env("CONTENT_DIR") or ROOT / "content")

    llm_model: str = _env("LLM_MODEL", "gemini-3.5-flash")
    side_model: str = _env("SIDE_MODEL", "gemini-3.5-flash-lite")

    stt_model: str = _env("STT_MODEL", "saaras:v4")
    stt_mode: str = _env("STT_MODE", "translit")

    tts_model: str = _env("TTS_MODEL", "bulbul:v4-flash")
    tts_speaker: str = _env("TTS_SPEAKER", "simran_enhi_companion")
    tts_language: str = _env("TTS_LANGUAGE", "en-IN")

    # where the agent reports progress, memory and alerts (the web app)
    web_url: str = _env("WEB_URL", "http://localhost:3000")
    agent_secret: str = _env("AGENT_SECRET")

    safety_classifier: bool = _env("SAFETY_CLASSIFIER", "1") == "1"


settings = Settings()

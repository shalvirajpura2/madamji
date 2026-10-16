"""Safety alerts. The teacher LLM raises alerts through its tool; this module also runs a
cheap background check on each student turn as a backstop. The check never sits in the
voice path, so the 99% of normal turns pay nothing in latency."""

import json
import logging
import re
import time

from . import backend
from .config import settings
from .models import ask_json

logger = logging.getLogger("ustaad.safety")

# quick pre-filter: only clearly worrying turns go to the classifier
WORRY = re.compile(
    r"(kill|die|dying|suicide|hurt (myself|him|her|them)|cut myself|end (it|my life)|want to disappear|"
    r"hopeless|depress|nobody (loves|cares)|beat(s|ing)? me|hits? me|touch(es|ed)? me|abuse|scared of (him|her|my)|"
    r"maar (dunga|dungi|daalunga|dalunga)|mar (jaun|jaunga|jaungi|jana)|khud ko|jeena nahi|zinda nahi|"
    r"bully|threat|knife|gun|blood)",
    re.IGNORECASE,
)

PROMPT = """You check messages a school student said to their online science teacher.
Decide if a grown-up from the safety team must be told. Flag only real risk: self-harm or suicidal talk,
wanting to seriously hurt or kill someone, abuse, being in danger, severe distress. Do not flag normal
anger, jokes about science ("the bulb will die"), or ordinary sadness about marks.
Reply as JSON: {"flag": "none" | "medium" | "high", "category": short words, "summary": one sentence}.

Student said: """


class Monitor:
    def __init__(self, student: dict, chapter_id: str):
        self.student = student
        self.chapter_id = chapter_id
        self.last_alert = 0.0

    def raise_alert(self, severity: str, category: str, summary: str, quote: str = "", source: str = "teacher") -> None:
        self.last_alert = time.monotonic()
        logger.warning(
            "\a🚨 SAFETY ALERT [%s] %s — %s (student=%s, chapter=%s, source=%s) quote=%r",
            severity, category, summary, self.student.get("name"), self.chapter_id, source, quote,
        )
        backend.send({
            "type": "alert",
            "studentId": self.student.get("id"),
            "studentName": self.student.get("name"),
            "chapterId": self.chapter_id,
            "severity": severity,
            "category": category,
            "summary": summary,
            "quote": quote[:500],
            "source": source,
        })

    async def check(self, text: str) -> None:
        if not settings.safety_classifier or not WORRY.search(text):
            return
        verdict = await ask_json(PROMPT + json.dumps(text))
        if verdict is None:
            # worrying words and no second opinion: better a false alarm than a missed child
            verdict = {"flag": "medium", "category": "unchecked", "summary": "Worrying words, classifier unavailable."}
        if verdict.get("flag") in ("medium", "high") and time.monotonic() - self.last_alert > 60:
            self.raise_alert(verdict["flag"], verdict.get("category", ""), verdict.get("summary", ""),
                             quote=text, source="backstop")

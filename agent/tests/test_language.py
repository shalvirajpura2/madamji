import pytest

from ustaad_agent.language import ENGLISH, HINDI, HINGLISH, detect


@pytest.mark.parametrize("text,lang", [
    ("what is a magnet ma'am", ENGLISH),
    ("why does the compass point north", ENGLISH),
    ("can you explain it again please", ENGLISH),
    ("ma'am magnet kya hota hai", HINDI),
    ("ma'am can you explain kyun magnet attract karta hai", HINGLISH),
    ("why copper magnet se nahi chipakta", HINGLISH),
    ("ma'am mujhe samajh nahi aaya, phir se batao", HINDI),
    ("मुझे समझ नहीं आया", HINDI),
])
def test_detects_language(text, lang):
    assert detect(text) == lang


@pytest.mark.parametrize("text", ["ok", "haan ma'am", "yes", "B"])
def test_short_replies_keep_current_language(text):
    assert detect(text) is None

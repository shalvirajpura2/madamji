"""Which language the student is speaking: english, hinglish or hindi.

Transcripts arrive in Roman script (STT transliterates), so this counts common Hindi words
written in English letters. Very short replies ("ok", "haan") keep the current language."""

import re

ENGLISH, HINGLISH, HINDI = "english", "hinglish", "hindi"

HINDI_WORDS = set(
    """
    hai hain ho hoon hu tha thi hota hoti hote hoga hogi kya kyu kyun kyon kaise kaisa kaisi kab kahan kaha
    kaun kitna kitni kitne nahi nahin na mat haan ha ji mujhe mujhko mera meri mere tum tumhara tumhari aap aapka
    aapki hum hamara humara mai ye yeh woh wo vo iska uska inka unka ka ki ke ko se mein pe tak
    bhi toh aur ya lekin phir fir sab kuch koi ek teen samajh samjha samjhi samjhao samjhaiye
    batao bataiye bolo boliye karo kariye kar karna karta karte karti kiya raha rahi rahe sakta sakti sakte chahiye
    accha achha acha theek thik bahut bohot zyada kam abhi baad pehle dobara wapas matlab jaise waise isliye
    kyunki agar toh chalo dekho suno arre yaar aaya aayi gaya gayi laga lagta lagti padh padhna padhai seekh
    """.split()
)
ENGLISH_GLUE = set(
    "the is are was were what why how when where which who can could should would do does did you your i my me "
    "it this that these those of in on for with and or but not please tell explain mean".split()
)
DEVANAGARI = re.compile(r"[ऀ-ॿ]")


def detect(text: str) -> str | None:
    if DEVANAGARI.search(text):
        return HINDI
    words = re.findall(r"[a-z']+", text.lower())
    words = [w for w in words if w not in ("ma'am", "maam", "mam", "sir", "madam")]
    if len(words) < 3:
        return None
    hindi = sum(w in HINDI_WORDS for w in words) / len(words)
    english = sum(w in ENGLISH_GLUE for w in words) / len(words)
    if hindi >= 0.6 and english == 0:
        return HINDI
    if hindi >= 0.15:
        return HINGLISH
    return ENGLISH


STYLE = {
    ENGLISH: (
        "Speak clear, simple Indian English for everything, including teaching. No Hindi words or sentences and "
        "no Hindi tags like 'theek hai', 'samjhe', 'hai na' or 'chalo'; say 'okay?', 'got it?' or 'come on' instead, "
        "and use the student's name instead of 'beta'."
    ),
    HINGLISH: "Speak natural Hinglish, mixing Hindi and English the way an Indian classroom teacher does.",
    HINDI: (
        "Speak mostly in Hindi, written in Roman letters, keeping science terms in English "
        "(for example 'magnet ke do poles hote hain')."
    ),
}

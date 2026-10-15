# Ustaad

A voice-first science teacher for Indian school students. Pick a chapter, walk into class, and
**Meera Ma'am** teaches it part by part on a green chalkboard. She checks for doubts, asks practice
questions, judges your answer, gives a hint, and moves on, all in a warm Indian-English and Hinglish
voice. You can interrupt her any time, just like in a real class.

- Subject: Science · Grades: 6 and 10 · 3 NCERT chapters each
- Demo: _add Vercel link_ · Walkthrough video: _add Loom link_

| Class 6 | Class 10 |
| --- | --- |
| Exploring Magnets | Electricity |
| Mindful Eating | Magnetic Effects of Electric Current |
| A Journey through States of Water | Life Processes: Nutrition and Respiration |

The grade 10 chapters deliberately overlap with grade 6 ones (magnets → electromagnetism,
food → nutrition), so you can hear the same teacher explain related ideas at two different depths.

## What makes it a teacher, not a chatbot

**The code runs the class; the LLM speaks in it.** A small lesson engine
([agent/src/ustaad_agent/lesson.py](agent/src/ustaad_agent/lesson.py)) holds the class position and
decides what happens next:

```
intro → teach beat 1..n → "koi doubt?" → practice question → feedback → next part … → wrap-up
            ▲                  │                 │
            └── interrupted? ──┴── doubt answered, continue_lesson resumes from the same point
```

Each step gives the LLM one focused instruction ("teach this point, you are writing X on the board").
The student can talk at any moment. The LLM then handles the doubt with the whole class context
and calls `continue_lesson` when the student is ready, so the class always gets back on track.
If the student goes quiet, the teacher nudges, then hints, then moves on, like a person would.

- **Leads without being asked.** The class runs end to end even if the student never speaks.
- **Board in sync with the voice.** Each teaching beat writes one chalk line, and diagrams draw in alongside.
- **Practice that teaches.** MCQ, true/false, fill-in-the-blank, numericals and short answers. Answers are
  graded in code (fast and exact, and spoken answers like "B wala", "doosra option" or "four forty ohm" work).
  Short answers fall back to an LLM judge. The first wrong answer gets a hint that targets the specific
  misconception, the second gets a kind explanation. Nobody gets stuck.
- **Adapts to the grade.** Class 6: short sentences, stories, slower pace, more Hinglish. Class 10:
  NCERT terms, formulas, board-exam tips, a brisker pace.
- **Remembers you.** Name, where you stopped, what you found tricky, and small personal details.
  The next class opens from there ("Pichhli baar poles kiye the…").
- **Human handling of everything else.** 12 common FAQs (fees, exams, "are you a robot?"),
  maths-in-science-class, flight bookings and movies, hunger, anger, fights with friends,
  and repeated questions, which she notices and handles with growing firmness. All of this lives in
  one persona prompt, not a wall of guardrails, so normal turns stay fast.
- **Safety beyond a teacher.** Talk of self-harm, abuse or hurting someone makes the teacher call
  `raise_alert`: she responds with care, shares Tele MANAS 14416, and pauses the lesson.
  A cheap background check (a keyword prefilter, then Gemini Flash-Lite) backs it up without adding
  latency. Alerts are logged on the backend and appear on `/staff` with a sound ping.

## Architecture

```
browser (next.js on vercel)              livekit cloud               python agent (livekit agents 1.8)
┌──────────────────────────┐  webrtc  ┌─────────────┐  webrtc  ┌─────────────────────────────────────┐
│ chalkboard, teacher,     │◀────────▶│    room     │◀────────▶│ silero vad + multilingual turn model│
│ question cards, controls │  audio   │             │          │ sarvam saaras:v4 stt (auto language)│
│                          │  rpc  ──▶│ answer/hand │          │ gemini flash llm + tools            │
│                          │◀── attrs │ lesson state│          │ sarvam bulbul:v4 tts (hinglish)     │
└─────────┬────────────────┘          └─────────────┘          │ lesson engine · grading · glossary  │
          │ /api/token (loads memory into the agent dispatch)  │ notes search · safety monitor       │
          ▼                                                    └───────────────┬─────────────────────┘
   store: supabase (or a local json file in dev) ◀── /api/agent/events ────────┘
```

- **Transport:** LiveKit (WebRTC). Echo cancellation, noise cancellation (BVC) and reconnects come built in.
- **Turn taking:** Silero VAD, LiveKit's multilingual end-of-turn model, adaptive interruption
  (ignores "hmm" and coughs), and false-interruption resume. Endpointing waits longer while a question
  is open, because kids think out loud.
- **Streaming:** the LLM streams into the TTS sentence by sentence, with preemptive generation turned on.
- **Screen awareness:** the agent publishes a lesson snapshot as a participant attribute (phase, board
  lines, question, result, mood). The same snapshot goes into the LLM's instructions, so it knows exactly
  what the student can see. Taps (answers, raise hand, pause, "no doubts") come back as RPCs.
- **Captions in Roman script:** the LLM is told to write Hinglish in Roman letters. Speech-to-text uses
  transliteration mode, and the caption stream converts any stray Devanagari as a safety net.
- **Pronunciation glossary:** [content/glossary.json](content/glossary.json) rewrites terms like NCERT,
  CO₂, I²R and Oersted for the voice only. Captions keep the original text.
- **Retrieval:** BM25 over our own chapter notes and lesson plans, exposed as a `search_notes` tool for
  doubts beyond the current part, including cross-grade ones ("ye tum class 10 mein padhoge"). With
  under 400 short passages, an in-process index answers in under a millisecond. Embeddings would add a
  network round trip for no real gain at this size.
- **Memory:** `remember_student` facts, plus per-chapter progress and a recap written by the engine.
  Both are loaded into the agent's dispatch metadata, so a returning student costs no extra latency.

### Repository layout

```
agent/    python livekit agent: lesson engine, prompts, tools, grading, voice config, tests, evals
web/      next.js app: landing, chapters, study room, staff alerts, api routes, storage
content/  six chapters (sections → beats → board lines → questions → notes), faqs, glossary
docs/     phase 1 plan and testing notes
```

## Running it

You need free accounts for **LiveKit Cloud**, **Sarvam AI** and **Google AI Studio (Gemini)**.
**Supabase** is optional locally and needed on Vercel.

```bash
# web
cd web
cp .env.example .env.local      # LiveKit keys, AGENT_SECRET, STAFF_PASSCODE (Supabase optional)
npm install
npm run dev                     # http://localhost:3000

# agent (Linux or macOS; on Windows run it inside WSL)
cd agent
cp .env.example .env.local      # LiveKit, SARVAM_API_KEY, GOOGLE_API_KEY, same AGENT_SECRET
./dev.sh download-files         # VAD and turn detector models, once
./dev.sh dev                    # joins classes as they start
```

Handy dev pages: `/dev/room/g6-magnets` walks through every study-room state without the agent, and
`/dev/diagrams` shows every chalk diagram.

### Deploying

- **Web → Vercel:** set the root directory to `web`, and add the env vars from `web/.env.example`
  (including Supabase). Run [web/supabase/schema.sql](web/supabase/schema.sql) once.
- **Agent → LiveKit Cloud:** in `agent/` run `lk cloud auth` and `lk agent create` (first time), set
  secrets with `lk agent update-secrets`, then deploy with `./deploy.sh`. Set `WEB_URL` to the Vercel URL.

## Testing

```bash
cd agent
./dev.sh test     # 66 unit tests: engine, grading, every question in every chapter, glossary
./dev.sh evals    # 12 conversation evals with an LLM judge: faqs, distractors, safety, repeats, grades
cd ../web && npx tsc --noEmit && npx eslint .
```

The manual test script and user-testing notes are in [docs/testing.md](docs/testing.md).

## Decisions and trade-offs

- **Cascaded STT → LLM → TTS, not a speech-to-speech model.** Realtime models are a little faster, but
  you lose control of the Indian accent, the glossary, Roman-script captions and reliable tool calls.
  For a teacher, control matters more.
- **Sarvam for voice.** It is built for Indian languages and code-mixed speech, and `bulbul:v4-flash`
  has Hinglish voices. The voice is set through `TTS_SPEAKER`, so a blind A/B against other voices
  needs no code change.
- **Hands-free voice plus buttons.** Talking is natural, but Indian homes are noisy and kids are shy.
  So there is a raise-hand button, tap-to-answer, "No doubts, next", hints, pause, and typing as a fallback.
- **Warm, slightly strict persona.** A favourite-teacher feel: praise is specific and varied, there is
  humour when a kid drifts, and she gets firmer only when distraction repeats.
- **Our own chapter notes, not NCERT text.** The content follows NCERT chapters but is written in our own
  words, so the public repo does not redistribute copyrighted textbooks.

## Not in Phase 1

Login and parent accounts, more subjects, homework uploads, lip-synced video avatars, analytics,
and payment flows. See [docs/phase-1.md](docs/phase-1.md) for the full scope and acceptance criteria.

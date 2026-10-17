# MadamJi

A voice-first science teacher for Indian school students. Pick a chapter, walk into class, and
**Meera Ma'am** teaches it part by part on a green chalkboard. She checks for doubts, asks practice
questions, judges your answer and gives hints, all in a warm Indian voice that follows your language:
English, Hinglish or Hindi. You can interrupt her any time, just like in a real class.

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
intro → teach beat 1..n → "any doubts?" → practice question → feedback → next part … → doubt time → wrap-up
            ▲                  │                 │                                         ▲
            └── interrupted? ──┴── doubt answered live (2 per part) ── or parked on the doubt list
```

Each step gives the LLM one focused instruction ("teach this point, you are writing X on the board").
The student can talk at any moment. The LLM then handles the doubt with the whole class context
and calls `continue_lesson` when the student is ready, so the class always gets back on track.
If the student goes quiet, the teacher nudges, then hints, then moves on, like a person would.

- **Leads without being asked.** The class runs end to end even if the student never speaks.
- **Board in sync with the voice.** Each teaching beat writes one chalk line, and diagrams draw in alongside.
- **Practice that teaches.** MCQ, true/false, fill-in-the-blank, numericals and short answers. Answers are
  graded in code (fast and exact, and spoken answers like "B wala", "doosra option" or "four forty ohm" work).
  Short answers fall back to an LLM judge. **The teacher never gives the answer away:** wrong answers,
  "skip" or "just tell me" earn hints that get stronger step by step (wrong MCQ options fade out, a
  blank gets its first letter, a numerical gets its formula set up), and the student always finishes it.
- **Runs to time.** The student picks a 15 or 25 minute class. A countdown is on screen; when time runs
  low she stops starting new parts, and next class resumes from where she stopped.
- **Keeps a doubt list.** Two doubts per part are answered on the spot. Beyond that, or when time is short,
  she parks them on an on-screen doubt list (up to 5) and answers every one in "doubt time" before the class ends.
- **Draws when you ask.** "Can you explain it by drawing?" She draws on the chalkboard while she talks:
  one of 15 reviewed diagrams if it fits, otherwise a code-drawn science template (two magnets with any
  poles facing, series or parallel circuits, field around a wire, refraction and reflection, step flows),
  which is correct by construction. Only for simple pictures outside these does a model sketch freehand,
  labelled "rough sketch" and cleaned with a strict allowlist. In testing, freehand AI drawings of field lines
  were wrong even from strong models, which is why the physics is drawn by code.
- **Every class is on record.** Each class is saved as a transcript with the chapter's content version:
  what the lesson plan asked for (board line and notes), what she actually said, what the student said, and
  every tool call with its result. On `/staff` you can trace a wrong statement to the notes or to the AI.
- **Follows your language.** The class starts in English. Each student turn is classified in code
  (English, Hinglish or Hindi), and she switches with you and stays there. Captions are always in Roman script.
- **Adapts to the grade.** Class 6: short sentences, stories, a slower pace. Class 10: the NCERT
  definition first, formulas and units, board-exam tips, a brisker pace.
- **Remembers you.** Name, where you stopped, what you found tricky, and small personal details.
  The next class opens from there ("Pichhli baar poles kiye the…").
- **Human handling of everything else.** 12 common FAQs (fees, exams, "are you a robot?"),
  maths-in-science-class, flight bookings and movies, hunger, anger, fights with friends,
  and repeated questions, which she notices and handles with growing firmness. All of this lives in
  one persona prompt, not a wall of guardrails, so normal turns stay fast.
- **Safety beyond a teacher.** Talk of self-harm, abuse or hurting someone makes the teacher call
  `raise_alert`: she responds with care, shares Tele MANAS 14416, and pauses the lesson.
  A cheap background check (a keyword prefilter, then a small model) backs it up without adding
  latency. Alerts are logged on the backend and appear on `/staff` with a sound ping.

## Architecture

```
browser (next.js on vercel)              livekit cloud               python agent (livekit agents 1.8)
┌──────────────────────────┐  webrtc  ┌─────────────┐  webrtc  ┌─────────────────────────────────────┐
│ chalkboard, teacher,     │◀────────▶│    room     │◀────────▶│ silero vad + multilingual turn model│
│ question cards, controls │  audio   │             │          │ sarvam saaras:v4 stt (auto language)│
│ timer, doubt list        │  rpc  ──▶│ answer/hand │          │ gpt-4.1-mini via livekit inference  │
│                          │◀── attrs │ lesson state│          │ elevenlabs v4 turbo or sarvam tts   │
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
- **Models:** the teacher LLM is `openai/gpt-4.1-mini` through LiveKit Inference (fast first token, reliable
  tool calls, no extra key), with an automatic fallback to `google/gemini-2.5-flash` if it errors or stalls.
  The voice is ElevenLabs `eleven_v4_turbo` with an Indian library voice, or Sarvam `bulbul:v4-flash`
  (`TTS_PROVIDER` in `agent/.env.local`).
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

You need **LiveKit Cloud** (agent hosting and the LLM through LiveKit Inference), **Sarvam AI**
(speech-to-text, and the voice if you choose it), and optionally **ElevenLabs** (a paid plan is needed
to use Indian library voices through the API). **Supabase** is optional locally and needed on Vercel.

```bash
# web
cd web
cp .env.example .env.local      # LiveKit keys, AGENT_SECRET, STAFF_PASSCODE (Supabase optional)
npm install
npm run dev                     # http://localhost:3000

# agent (Linux or macOS; on Windows run it inside WSL)
cd agent
cp .env.example .env.local      # LiveKit, SARVAM_API_KEY, ELEVEN_API_KEY (optional), same AGENT_SECRET
./dev.sh download-files         # VAD and turn detector models, once
./dev.sh dev                    # joins classes as they start
./dev.sh compare-voices         # optional: blind listening page comparing candidate voices
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
./dev.sh test     # 92 unit tests: engine, hints, doubt list, clock, grading, language, drawing safety, transcripts
./dev.sh evals    # 16 conversation evals with an LLM judge: faqs, distractors, safety, repeats, grades,
                  # language following, never giving the answer, parking doubts, drawing on request
cd ../web && npx tsc --noEmit && npx eslint .
```

The manual test script and user-testing notes are in [docs/testing.md](docs/testing.md).

## Decisions and trade-offs

- **Cascaded STT → LLM → TTS, not a speech-to-speech model.** Realtime models are a little faster, but
  you lose control of the Indian accent, the glossary, Roman-script captions and reliable tool calls.
  For a teacher, control matters more.
- **Voice: ElevenLabs v4 Turbo or Sarvam.** v4 Turbo tops independent TTS arenas, including Hindi, and
  has expressive Indian voices; Sarvam is built in India for code-mixed speech and streams first audio in
  about 240 ms from India. Both are one env line away, and `./dev.sh compare-voices` builds a blind
  listening page so the choice is made by ear, not by spec sheet.
- **LLM through LiveKit Inference.** The free Gemini tier allowed 20 requests a day and took 2–8 s to the
  first token, which is unusable for voice. LiveKit Inference gives about 1.3 s from India on the same
  key that runs the rooms, with a fallback model.
- **Hands-free voice plus buttons.** Talking is natural, but Indian homes are noisy and kids are shy.
  So there is a raise-hand button, tap-to-answer, "No doubts, next", hints, pause, and typing as a fallback.
- **Warm, slightly strict persona.** A favourite-teacher feel: praise is specific and varied, there is
  humour when a kid drifts, and she gets firmer only when distraction repeats.
- **Our own chapter notes, not NCERT text.** The content follows NCERT chapters but is written in our own
  words, so the public repo does not redistribute copyrighted textbooks.

## Not in Phase 1

Login and parent accounts, more subjects, homework uploads, lip-synced video avatars, analytics,
and payment flows. See [docs/phase-1.md](docs/phase-1.md) for the full scope and acceptance criteria.

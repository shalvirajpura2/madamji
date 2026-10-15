# Ustaad — Phase 1 plan

Ustaad is a voice-first science teacher for Indian school students. It should feel like sitting in a
real classroom with a warm, slightly strict teacher who leads the lesson, writes on a green
chalkboard, asks questions, checks answers and comes back to the lesson after every doubt.

## Who we build for

- A grade 6 student (age ~11): short sentences, stories, more Hinglish, slower pace, lots of praise.
- A grade 10 student (age ~15): exam-minded, precise terms, formulas, "board mein ye aata hai" tips.

## Phase 1 scope

In:

- One subject (science), two grades (6 and 10), three chapters each.
- A study room where the teacher leads each chapter section by section without being asked.
- Doubts after every section, interruptions at any time (voice barge-in or raise-hand button).
- Practice questions after each section: MCQ, true/false, fill in the blank, short spoken answer.
  The teacher judges the answer, hints once, explains, praises, then moves on.
- Indian-accent Hinglish/English voice, Roman-script captions (never Devanagari on screen).
- 12 common student FAQs handled in the teacher's own voice (fee, exams, "who are you", etc.).
- Off-topic and distractor handling the way a real teacher would, including repeated questions.
- Care handling for sensitive moments plus an internal `raise_alert` tool. Alerts are logged and
  show up live on a staff page with a sound ping.
- Memory: the teacher remembers the student's name, where they stopped, what they got wrong and
  one or two personal details, and opens the next class from there.
- Retrieval over our own chapter notes for doubts beyond the current section.
- A pronunciation glossary for the voice and key terms for the speech recognizer.
- Clear UI states: connecting, teacher speaking, your turn, thinking, mic blocked, reconnecting,
  teacher unavailable, plus a keyboard fallback.

Out (later phases):

- Login and parent accounts (the student types a name and picks a grade).
- More subjects, more chapters, uploads, scheduling, payments.
- Talking avatars with lip-sync video. Phase 1 uses an illustrated SVG teacher with expressions.

## User flow

1. Landing: "Namaste! What's your name?" plus a choice of grade 6 or 10. Saved on the device.
2. Chapter picker: three chapter cards for the grade with progress and a "last time" note.
3. Study room: one tap on "Enter class" (needed for audio and mic permission). The teacher greets
   the student by name, recaps last time if there is history, and starts section 1.
4. Each section: teach → "koi doubt?" → practice question → feedback → next section.
5. End of chapter: a short wrap-up, a score, and the next chapter suggestion. A recap is saved.

## Architecture

```
browser (next.js on vercel)                livekit cloud                 python agent worker
┌──────────────────────────┐  webrtc  ┌──────────────┐  webrtc  ┌──────────────────────────────┐
│ study room ui            │◀────────▶│  room        │◀────────▶│ AgentSession                 │
│  chalkboard, avatar,     │  audio   │              │  audio   │  silero vad + turn detector  │
│  question cards, states  │          │              │          │  sarvam stt (saaras)         │
│                          │  rpc +   │              │          │  gemini flash (llm + tools)  │
│                          │  data    │              │          │  sarvam tts (bulbul)         │
└──────────┬───────────────┘          └──────────────┘          │ lesson engine (state machine)│
           │ /api/token                                          │ grading, glossary, safety    │
           │ /api/progress, /api/alerts                          │ notes retrieval, memory      │
           ▼                                                     └──────────────┬───────────────┘
      supabase (postgres) ◀─────────────────────────────────────────────────────┘
      students, progress, session notes, alerts (realtime → staff page ping)
```

The key decision: **code runs the class, the LLM performs inside it.** A lesson engine holds the
position (chapter, section, beat, phase, question). It tells the LLM what to do next with a small
focused instruction, and the LLM speaks it in the teacher's voice. The student can interrupt at any
point; the LLM handles the doubt with full context and calls `continue_lesson` when the student is
ready. This keeps the class on track while every reply still sounds natural.

### Lesson engine phases

```
intro → teach(beat 1..n) → check doubts → practice question → feedback → next section … → wrap
                   ▲              │                │
                   └── doubt ◀────┘ student speaks any time; engine pauses, LLM answers,
                                    continue_lesson resumes from the same spot
```

- Beats map to chalkboard lines, so the board fills in as the teacher explains.
- MCQ, true/false and fill-in answers are graded in code (fast and exact). Short spoken answers
  are judged by the LLM against the expected points.
- One hint on the first wrong attempt, then the explanation, then move on. Nobody gets stuck.

### Agent tools

- `continue_lesson` — student is ready, move to the next step.
- `submit_answer` — the student said their answer out loud.
- `search_notes` — look up our chapter notes for a doubt outside the current section.
- `remember_student` — save a small personal detail ("plays cricket", "finds formulas hard").
- `raise_alert` — sensitive situation; logs to the backend and pings the staff page.

### Browser ↔ agent protocol

- Agent → browser: a full lesson state snapshot on the `lesson` data topic after every change
  (phase, section, revealed board lines, active question, result, progress). Snapshots, not
  deltas, so a reconnect simply redraws.
- Browser → agent: RPC calls `answer` (tapped option or typed text), `raise_hand`, `pause`,
  `resume`, `say_text` (keyboard input).
- Captions and teacher/student states come from LiveKit transcriptions and agent state.

### Voice choices

- STT: Sarvam `saaras:v4`, language auto-detect, transliterated output so captions stay in
  Roman script, plus chapter key terms as STT hints.
- TTS: Sarvam `bulbul:v4-flash` with a Hinglish (`enhi`) voice, chosen in a blind test. Pace changes
  by phase (slower for new ideas, normal for chat). A pronunciation glossary rewrites tricky terms
  before speech while captions keep the original text.
- LLM: Gemini Flash with thinking off for fast first tokens.
- Turn taking: Silero VAD, the multilingual turn detector, adaptive interruption detection, false
  interruption resume, longer wait during practice questions so kids get time to think.

## Repository layout

```
ustaad/
  web/        next.js app (landing, chapters, study room, staff page, api routes)
  agent/      python livekit agent (engine, prompts, tools, voice config, tests)
  content/    lesson plans, chapter notes, faqs, glossary (json, shared by web and agent)
  docs/       plan, decisions, testing notes
```

## Milestones

1. Scaffold: web and agent projects, content schema, agent joins a room and talks.
2. Lesson engine: phases, beats, questions, grading, data/RPC sync, unit tests.
3. Study room UI: chalkboard, teacher avatar, question cards, controls, all states.
4. Content: six chapters with sections, beats, board lines, questions, notes; faqs; glossary.
5. Care and memory: safety tool and staff page, memory and recaps, notes retrieval.
6. Testing and ship: scripted conversation tests, real kid testing, README, deploy, demo video.

## Acceptance criteria

- The teacher starts and leads every chapter to the end without being prompted.
- Every section ends with a doubt check and at least one practice question; wrong answers get a
  hint and an explanation; the lesson always continues afterwards.
- Interrupting the teacher mid-sentence stops her within about half a second, and she answers
  and then returns to the same point.
- Typical reply starts within about one second of the student finishing.
- Captions never show Devanagari.
- Grade 6 and grade 10 explanations are clearly different in depth, words and pace.
- The 12 FAQs, off-topic asks, maths-in-science and repeated questions get human, varied replies.
- Sensitive messages trigger `raise_alert`, appear on the staff page with a sound, and the
  teacher responds with care and pauses the lesson.
- A returning student is greeted with what they did last time.
- Mic denied, network drop and agent unavailable each show a clear message and a way forward.
- A grade 6 and a grade 10 student each complete at least one chapter in user testing.

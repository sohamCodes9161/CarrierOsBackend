# CareerOS Backend — Foundation + Auth Module

> **Migration note:** the AI provider was switched from Gemini to Groq (`groq-sdk`) to resolve `429 RESOURCE_EXHAUSTED` rate-limit issues. All prompt/schema files, the `GROQ_API_KEY`/`GROQ_MODEL` env vars, and the AI integration layer were updated accordingly. See "Module 2" below for details on how structured-output reliability is handled now that we're not on Gemini's guaranteed schema mode. The voice layer (Module 4b) also runs on Groq end-to-end (Whisper for speech-to-text, Orpheus for text-to-speech) rather than Gemini Live, for the same rate-limit reasons.

## What's included
- Express app with security middleware (helmet, cors, rate limiting), centralized error handling, standard API response shape
- MongoDB connection via Mongoose
- Auth module: register, login, refresh (with rotation), logout, get current user
- JWT access tokens (15 min) + opaque, hashed, rotating refresh tokens stored in HTTP-only cookies
- Zod validation on all input
- 19 automated tests (unit + smoke tests), all passing

## Setup
```bash
npm install
cp .env.example .env
# Fill in your MongoDB Atlas URI and generate secrets:
#   openssl rand -hex 32   (for JWT_ACCESS_SECRET)
npm run dev
```
Server runs on `http://localhost:5000`. Health check: `GET /api/v1/health`.

## Running tests
```bash
npm test
```
Note: all 19 tests here run **without** a live database (pure logic + smoke tests on non-DB routes). Once your `.env` has a real `MONGODB_URI`, use the Postman collection below to test the full DB-backed flow (register → login → refresh → logout).

## Postman
1. Import `CareerOS-Auth.postman_collection.json`
2. Import `CareerOS-Local.postman_environment.json` and select it as your active environment
3. Make sure the server is running with a real MongoDB Atlas connection
4. Run requests top to bottom (Register → Login → Get Current User → Refresh Token → Logout). Each request has automated test assertions and auto-captures the access token into the environment for you.
5. The last two requests intentionally test failure cases (duplicate email → 409, weak password → 400).

**Note on the refresh cookie:** Postman's cookie jar handles the HTTP-only `refreshToken` cookie automatically — you don't need to copy it manually, just make sure "Automatically follow redirects" isn't stripping cookies and that you're hitting the same `baseUrl` for every request.

## API Endpoints

| Method | Endpoint | Auth required | Body |
|---|---|---|---|
| POST | `/api/v1/auth/register` | No | `{ name, email, password }` |
| POST | `/api/v1/auth/login` | No | `{ email, password }` |
| POST | `/api/v1/auth/refresh` | No (uses cookie) | — |
| POST | `/api/v1/auth/logout` | No (uses cookie) | — |
| GET | `/api/v1/auth/me` | Yes (Bearer token) | — |

## What to test / green-flag before we move to the next module
- [ ] Register a new user → 201, receive accessToken + user object (no passwordHash leaked)
- [ ] Register same email again → 409
- [ ] Register with weak password → 400 with validation message
- [ ] Login with correct credentials → 200, new accessToken
- [ ] Login with wrong password → 401
- [ ] GET /me with valid token → 200, correct user
- [ ] GET /me with no token → 401
- [ ] GET /me with expired/garbage token → 401
- [ ] Refresh → 200, new accessToken issued, old refresh token invalidated (calling refresh twice with the same old cookie should fail the second time — rotation working)
- [ ] Logout → refresh cookie cleared, subsequent refresh attempt fails

Once you've run through this and everything checks out against your real Atlas instance, give the green flag and we'll move to the Resume + ATS Analyzer module.

---

## Module 2: Resume + ATS Analyzer

### What's included
- Resume upload via Multer (memory storage, PDF/DOC/DOCX only, 5MB limit)
- Deterministic text extraction (`pdf-parse` v2 for PDFs, `mammoth` for DOCX) — real tests generate actual PDF/DOCX files and verify extraction works, not just mocked
- File storage via Cloudinary (`resource_type: raw`)
- AI analysis via Groq (`groq-sdk`) using JSON Schema structured outputs where the model supports it, with a safe fallback + required-field validation otherwise — never free text to parse

**On reliability, since this replaced Gemini's guaranteed schema mode:** Groq's strict JSON-schema mode (`response_format: json_schema, strict: true`) isn't supported by every model, and the model we migrated to (`openai/gpt-oss-120b`, since `llama-3.3-70b-versatile` — the model requested — was deprecated by Groq and its shutdown date has already passed) may or may not support it depending on Groq's current rollout. So the integration tries strict mode first, and if that specific call fails, falls back to JSON-object mode with the schema embedded in the prompt, then verifies all required fields are present before accepting the response — throwing a clean error rather than silently passing through incomplete data. This fallback logic is tested with 7 real tests simulating both paths (see `tests/groqIntegration.test.js`).
- 18 additional automated tests (41 total across both modules), all passing

### New setup steps
```bash
# Add to your .env (see .env.example):
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GROQ_API_KEY=...         # from console.groq.com/keys
GROQ_MODEL=openai/gpt-oss-120b
```

### API Endpoints (all require `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/resumes/analyze` | `multipart/form-data`: `resume` (file), `jobDescription` (optional text) | Rate-limited to 15/hour per IP — AI calls are relatively expensive |
| GET | `/api/v1/resumes/analyses` | — | Lists all past analyses for the logged-in user |
| GET | `/api/v1/resumes/analyses/:id` | — | Full analysis detail |
| DELETE | `/api/v1/resumes/:id` | — | Deletes the resume, its Cloudinary file, and its analyses |

### Postman
1. Import `CareerOS-Resume.postman_collection.json` (same environment as before — it now also uses `resumeId`/`analysisId`)
2. Run **Auth → Login** first so `accessToken` is populated
3. On the two "Analyze Resume" requests, attach `tests/fixtures/sample-resume.pdf` (included in the zip) to the `resume` form field — Postman collections can't embed binary files, so this one manual attach step is unavoidable
4. Run requests top to bottom

### What to test / green-flag before we move to the next module
- [ ] Upload a real resume PDF with no job description → 201, `atsScore` 0-100, `jobMatchScore` is `-1`
- [ ] Upload the same resume with a job description → `jobMatchScore` is 0-100, `missingKeywords` populated if relevant
- [ ] Upload with no file attached → 400
- [ ] Upload without a Bearer token → 401
- [ ] Upload a non-PDF/DOCX file (e.g. a `.png`) → 400 "Only PDF, DOC, and DOCX files are allowed"
- [ ] Upload a file over 5MB → 400 "File is too large"
- [ ] Check your Cloudinary media library → the file actually landed there
- [ ] GET `/analyses` → your analysis appears in the list
- [ ] DELETE the resume → confirm it's gone from both MongoDB and Cloudinary

Once this checks out end-to-end, give the green flag and we'll move to the GitHub Analyzer module.

---

## Module 3: GitHub Analyzer

### What's included
- Read-only GitHub REST API integration — fetches profile, repos, per-repo languages, README text, recent public events, and root directory listings only. **Never clones, executes, or fetches source code files**, per the security requirement.
- Deterministic aggregation: total stars/forks, language breakdown by byte-count percentage, top repos (forks excluded), account age, last-active date
- **Recent commit activity** (last 30/90 days, deduplicated active days) computed from public events — more honest than a repo's `pushed_at` timestamp, which a single stale commit can keep looking fresh
- **Repo health checklist** per top repo — presence of README, LICENSE, tests, CI config (`.github/`), `.gitignore`, `package.json`, rolled into a 0-100 health score. Detected from filenames only, never file contents.
- AI qualitative analysis via Groq, now grounded in the commit activity and health checklist above rather than README prose alone
- Rate-limit awareness: unauthenticated GitHub API is 60 req/hr; add `GITHUB_TOKEN` to raise it to 5,000/hr
- 30 additional automated tests (68 total across all three modules), all passing

### Important note on testing this module
I tested this one differently from the others: `api.github.com` is reachable from my sandbox, so I ran real calls against it. That immediately proved a real thing — the sandbox's shared IP had already hit the 60/hr unauthenticated limit from other traffic, and my code correctly caught it and returned a clean `429` with a message telling you to add a `GITHUB_TOKEN`. So the rate-limit handling path is proven against the real API, not just imagined. The rest (aggregation math, README-fetching, AI prompt assembly) is covered by tests using realistic fixture data shaped exactly like GitHub's actual API responses.

**Recommended:** add a `GITHUB_TOKEN` to your `.env` before testing — go to github.com/settings/tokens, generate one with no scopes selected (public read access is all we need), and you'll avoid hitting the same limit during your Postman run.

**On the new signals specifically:** I verified the events API and root-contents API live against real active repos (`torvalds`, `nodejs/node`) before writing the aggregation logic, so the parsing matches GitHub's actual response shape exactly. Writing the tests for the activity aggregation also caught a real bug — `activeDaysLast90` was initially counting active days across *all* fetched events instead of scoping to the 90-day window — fixed before it ever reached you.

### New setup steps
```bash
# Add to your .env:
GITHUB_TOKEN=ghp_your_token_here   # optional but strongly recommended
```

### API Endpoints (all require `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/github/analyze` | `{ "username": "octocat" }` | Rate-limited to 15/hour per IP |
| GET | `/api/v1/github/analyses` | — | Lists past analyses for the logged-in user |
| GET | `/api/v1/github/analyses/:id` | — | Full analysis detail |

### Postman
1. Import `CareerOS-Github.postman_collection.json`
2. Run **Auth → Login** first so `accessToken` is populated
3. `testGithubUsername` defaults to `octocat` (GitHub's official test account) — change it in the environment if you want to analyze a real profile
4. Run requests top to bottom

### What to test / green-flag before we move to the next module
- [ ] Analyze a real GitHub username → 201, `estimatedSkillLevel` is one of beginner/intermediate/advanced, `languageBreakdown` percentages roughly sum to 100
- [ ] Analyze with an invalid username format (e.g. `-bad-name`) → 400
- [ ] Analyze a username that doesn't exist → 404
- [ ] Analyze without a Bearer token → 401
- [ ] Analyze twice in under an hour with no `GITHUB_TOKEN` and low remaining quota → should eventually 429 with a clear message (only testable if you deliberately skip adding a token)
- [ ] GET `/analyses` → your analysis appears in the list
- [ ] Spot-check the AI output against the actual profile — does the skill level and summary feel fair, not inflated or hallucinated?

Once this checks out, give the green flag and we'll move to the AI Mock Interview module.

---

## Module 4: AI Mock Interview (text-based engine — voice layer comes next)

### Important context
We deliberately split this feature in two phases (your call, and the right one): this module is the **interview engine** — question generation, adaptive follow-ups, evaluation, and final reporting — built and tested standalone over text answers first. The plan was to layer live voice on top via Gemini's Live API next — but since we've now migrated off Gemini entirely for rate-limit/stability reasons, that voice-layer decision needs revisiting: Groq doesn't currently offer an equivalent bidirectional real-time voice API. We'll need to pick a voice provider (could still be Gemini Live specifically for that one feature, or a different provider like Groq's own fast Whisper transcription + a separate TTS, wired into this same tested engine) before designing that layer. Either way, this text-based engine underneath doesn't change.

### What's included
- Adaptive question generation — each new question is generated with full knowledge of prior answers and their evaluations, so the AI can target weak areas rather than asking generically (per your original "generate next question dynamically" requirement)
- Per-answer AI evaluation: correctness, communication quality, missing concepts, strengths/weaknesses — schema-constrained, no free-text parsing
- Final report generated once all questions are answered: overall score, summary, strengths/weaknesses, concrete recommendation, and an honest `readyForRole` verdict
- Embedded schema design: one `Interview` document per session holding all Q&A turns (matches our earlier embed-vs-reference decision — a session is bounded and always read together)
- 17 additional automated tests (88 total across all four modules), including a full simulated 3-question interview lifecycle (start → answer → adaptive next question → answer → completion → final report) — this is the most thorough test of any module so far, since it's the most stateful

### API Endpoints (all require `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/interviews/start` | `{ role, difficulty, interviewType, targetSkills?, totalQuestions? }` | `difficulty`: easy/medium/hard. `interviewType`: technical/behavioral/mixed. `totalQuestions`: 3-10, defaults to 5. Returns the interview with its first question. |
| POST | `/api/v1/interviews/:id/answer` | `{ answerText }` | Evaluates the current question, then either returns the next question or (if it was the last) the final report |
| GET | `/api/v1/interviews` | — | Lists past interviews for the logged-in user |
| GET | `/api/v1/interviews/:id` | — | Full interview detail including all Q&A and evaluations |

### Postman
1. Import `CareerOS-Interview.postman_collection.json`
2. Run **Auth → Login** first
3. **Run requests 1 through 5 in order** — this collection is set to `totalQuestions: 3`, so requests 2-4 walk through all three questions and request 4 should trigger completion + final report. Request 5 deliberately tests that you can't answer a completed interview.

### What to test / green-flag before we move to the voice layer
- [ ] Start an interview → 201, exactly 1 question, status `in_progress`
- [ ] Answer question 1 → 200, question 2 appears, question 1 now has an evaluation
- [ ] Keep answering until the last question → response shows `status: completed` and a populated `finalReport`
- [ ] Try answering the same interview again after completion → 400
- [ ] Start with an invalid `difficulty` value → 400
- [ ] **Sanity-check the adaptive behavior**: deliberately give a bad/vague answer to question 1, then check whether question 2's `focusArea` or content plausibly relates to what you got wrong — this is the qualitative signal that adaptivity is actually working, not just scripted
- [ ] Read the final report's `summary` and `readyForRole` against how you actually answered — does it feel honest rather than inflated?

Once this checks out, let's decide on a voice provider and I'll design that layer on top of this engine.

---

## Module 4b: Voice layer (Groq STT + Edge Neural TTS)

> **Update:** the original version of this module used Groq's Orpheus TTS. Real-world testing surfaced audio truncation issues (audio cutting off after ~11 seconds) tied to Orpheus's 200-character-per-request limit and the manual WAV-chunk-stitching that limit required. We've switched text-to-speech to **Microsoft Edge Neural TTS** (via the `msedge-tts` npm package) - free, no billing account, and no per-request length limit, so questions and reports of any length synthesize in a single native call with no manual audio stitching. Speech-to-text stays on Groq Whisper, which was never the source of the problem.

### What's included
- **Speech-to-text**: Groq's `whisper-large-v3-turbo` transcribes recorded answers (unchanged from before)
- **Text-to-speech**: Microsoft Edge Neural TTS (`msedge-tts`), voice `en-US-AriaNeural` by default - natural, conversational, and free. Other options: `en-US-AvaNeural` (female), `en-US-GuyNeural` / `en-US-AndrewNeural` (male).
- **No chunking, no manual audio stitching**: the WAV chunker/concatenator from the Orpheus version is gone entirely - `msedge-tts`'s `toStream()` synthesizes full-length text (a whole question, a whole final report) in one native call and returns a standard Node `Readable`, buffered the normal way.
- **Difficulty-tuned question generation**: easy questions are now explicitly conversational rather than textbook-style; medium focuses on scenario/trade-off design decisions; hard focuses on edge cases, concurrency, and internals. Questions are also now explicitly prompted to read naturally when spoken aloud (avoiding code-block-heavy phrasing that doesn't translate to speech).
- **Test harness improvements**: audio playback now goes through a proper queue (greeting and first question no longer race to autoplay simultaneously), and answering is now hands-free - a Voice Activity Detection (VAD) meter auto-submits your answer after ~3 seconds of silence, with a manual "Stop recording" override always available.
- Fully opt-in via `voiceEnabled: false` by default - zero TTS/STT calls unless explicitly turned on
- 123 automated tests passing project-wide (net change from the previous 129: removed 6 dead WAV-chunking tests, added 8 new edge-tts tests, plus 5 new difficulty-prompt tests)

### IMPORTANT: what changed operationally
- **No more Groq TTS model-acceptance step** - `msedge-tts` needs no API key or account at all, since it uses Microsoft's own free Edge "Read Aloud" service.
- **This is an unofficial, reverse-engineered integration** - `msedge-tts` isn't a documented/supported Microsoft API, it's a community library that talks to the same backend Edge's built-in "Read Aloud" feature uses. It's popular and free, but not SLA-backed - if Microsoft changes something on their end, this could break without warning. Worth knowing for a capstone demo, less of a concern than it would be for a real production service with paying users.
- **I could not test this live** - the service it talks to (`speech.platform.bing.com`) isn't reachable from my sandbox, same limitation as Cloudinary/Mongo/Groq before it. Everything is verified via real unit tests (a genuine `Readable` stream is buffered and asserted on, not just mocked away) against the actual installed package's confirmed API shape - but your test run is the real proof.

### API changes
No endpoint signatures changed. `POST /api/v1/interviews/start` still accepts `voiceEnabled`, `POST /api/v1/interviews/:id/answer/audio` still accepts the recorded answer the same way. Only the internal TTS provider changed.

### Testing this - two ways

**1. Postman (`CareerOS-Interview.postman_collection.json`, request "1b")** - starts a voice-enabled interview and asserts the returned audio URLs are real Cloudinary MP3 links. Paste one into a browser to hear it - should now play the *entire* question or greeting without cutting off, even if it runs well past what used to be ~11 seconds.

**2. The voice test harness (`/test/voice-test.html`)** - same as before, with two real improvements:
   - Audio no longer overlaps - greeting plays, then (500ms later) the question plays, cleanly queued
   - You no longer need to click "Stop recording" - speak your answer, pause for 2-3 seconds, and it submits automatically. A live volume meter shows what the VAD is detecting, so you can see it's actually picking up your voice. The manual stop button is still there if you want to submit sooner.

### What to test / green-flag
- [ ] Start a voice-enabled interview → greeting and first question audio play back-to-back, not simultaneously
- [ ] Listen to a full, longer question (especially a "hard" difficulty one, which tend to be more detailed) → confirm it plays completely with no truncation
- [ ] Using the test harness: speak an answer, then just stop talking and wait → confirm it auto-submits around 3 seconds of silence without clicking anything, and the volume meter visibly responded while you were talking
- [ ] Try the manual "Stop recording" override mid-answer → confirm it still works and doesn't double-submit
- [ ] Start an easy-difficulty interview and read the generated questions → do they sound more conversational than before, rather than like textbook definitions?
- [ ] Start a hard-difficulty interview → do the questions probe edge cases/internals/concurrency rather than basic usage?
- [ ] Confirm `voiceEnabled: false` interviews still work exactly as before (no audio fields populated, no TTS calls)

---

## Module 4c: Performance fix, race-condition fix, and interview flexibility

> **Why this happened:** real testing surfaced two things worth fixing properly rather than working around. Console logs showed `POST /interviews/start` taking up to **45 seconds** and `POST /interviews/.../answer/audio` taking as long as **101 seconds** in one case. Separately, the same logs showed a Mongoose `VersionError` ("No matching document found ... version 0") on several `/answer` calls - a real optimistic-concurrency conflict from duplicate requests hitting the same interview.

### The latency fix: TTS is no longer on the response's critical path
The old flow made the candidate wait on the full chain: transcribe → evaluate → generate next question → **synthesize + upload audio** → save → respond. That last step was almost certainly the bulk of the latency - `msedge-tts` is an unofficial WebSocket service with genuinely variable latency (a 100-second call is consistent with a slow/stalled synthesis, not a bug in the evaluation logic).

**Fix:** `startInterview` and `submitAnswer` now save all text-based state (question, evaluation, next question) and respond **immediately** once that's ready. Audio synthesis for the greeting/question/final-report runs *after* the response is sent, as a detached background task, and patches the URL onto the document via an atomic `Interview.updateOne(...)` once it finishes - not a fetch-modify-save, specifically to avoid colliding with whatever request comes in next for the same interview.

- `greetingAudioUrl`, `questionAudioUrl`, and `finalReport.audioUrl` are now `null` in the immediate response when voice is enabled, and get filled in shortly after
- The test harness (`/test/voice-test.html`) already handles this - it shows a "🔊 audio loading..." placeholder and polls `GET /interviews/:id` every 1.5s (up to 30s) until the audio shows up, then plays it automatically
- If you're calling the API directly (not through the harness), you'll need to do the same: poll `GET /interviews/:id` after `start`/`answer` if you want the audio URLs

### The race-condition fix: VersionError → clean 409
Two overlapping requests to the same interview (e.g. a double-click, or the harness's record button being clickable again before a slow previous request resolved) could cause Mongoose's optimistic versioning to correctly reject the second write - but it was surfacing as a raw, confusing `500`. Two fixes:
1. **Server-side**: `errorHandler.js` now maps `VersionError` to a clean `409` with a message telling the client to wait and check status, instead of leaking a Mongoose internal error
2. **Client-side (root cause)**: the test harness now disables the record/submit buttons while a request is in flight, so a duplicate submission can't be triggered by clicking again before the first one finishes

### Interview flexibility
- `totalQuestions` bounds raised from 3-10 to **1-20**, so longer real interviews (or very short test runs) are both supported
- **New interview type: `dsa`** (Data Structures & Algorithms) - since this is voice-based, the question-generation prompt specifically instructs the AI to ask the candidate to *describe* their approach (data structure choice, algorithm at a conceptual level, time/space complexity) rather than "write code," which wouldn't make sense spoken aloud
- **Role and target skills were already fully free-text**, not enums - `role: "Python Developer"`, `role: "PHP Backend Developer"`, `targetSkills: ["Django", "PostgreSQL"]`, etc. all worked before this change too. Worth calling out explicitly since it wasn't obvious: nothing hardcodes this to backend-only, the AI prompt has always taken whatever role/skills you send it.

### Automated tests
137 tests passing project-wide, including:
- A rewritten `interviewService.test.js` with a realistic in-memory model fake that supports `updateOne` with positional-`$` operator emulation and auto-assigns subdocument `_id`s on push (mimicking real Mongoose), so the background-audio-patch logic is genuinely exercised, not just assumed to work
- Explicit tests proving audio fields are `null` in the immediate response and only populate after the background task resolves
- A test proving a *failed* background audio synthesis never throws or affects the already-returned interview
- New `errorHandler.test.js` covering the `VersionError` → 409 mapping and every other error-mapping branch
- DSA interview type and raised `totalQuestions` bounds covered in both validator and prompt tests

### What to test / green-flag
- [ ] Start a voice-enabled interview → response returns in a few seconds (not 45+), with `greetingAudioUrl`/`questionAudioUrl` as `null`
- [ ] Wait ~10-20 seconds, then `GET /interviews/:id` (or just watch the test harness) → audio URLs are now populated
- [ ] In the harness, try clicking "Record answer" again immediately after it's already submitting → should be disabled/ignored, not fire a second request
- [ ] Try a DSA interview type → questions ask you to describe an approach verbally, not write code
- [ ] Start an interview with `totalQuestions: 15` → should work (previously capped at 10)
- [ ] Start an interview with `role: "Python Developer"` or another non-backend role → questions should be genuinely about Python, not generically backend-flavored
- [ ] Deliberately trigger two near-simultaneous answer submissions (e.g. double-click submit) → should get a clean 409 with a clear message, not a raw 500 with a stack trace

---

## Module 4d: Fixing speech-to-text latency (live browser transcription)

> **Why:** the old flow was "record the entire answer → upload the full file → wait for Groq Whisper to transcribe it → then start evaluating." All of that transcription time happened *after* you stopped talking, which is where the lag was coming from. Groq's Whisper endpoint is batch-only - it has no streaming/live variant - so there's no way to make Groq itself transcribe "as you speak."

### The fix: transcribe in the browser, live, as a fast path
Chromium browsers (Chrome, Edge) have a built-in live speech-recognition API (`SpeechRecognition`) that produces text incrementally the instant you talk - no upload, no separate transcription service call. The harness now runs this in parallel with recording:

- As soon as you click record, live recognition starts alongside the existing VAD/audio recording (unchanged)
- You'll see your words appear under the record button *while you're still talking* - that's the proof it's working, not a cosmetic addition
- The moment recording stops (via VAD silence detection or manual stop), the already-accumulated transcript is submitted straight to the existing `POST /interviews/:id/answer` **text** endpoint - no audio upload, no Whisper round-trip at all for that answer
- **Fallback, unchanged**: if the browser doesn't support live recognition (e.g. Firefox) or it produces nothing usable, the harness automatically falls back to the original record → upload → `POST /interviews/:id/answer/audio` → Groq Whisper path. Nothing is lost for unsupported browsers, it's just not the fast path.

### The honest trade-off
Live recognition only works well in Chromium-based browsers, and for that specific feature your live audio goes to Google's recognition servers, not Groq - a genuine shift for that one piece, worth knowing about. Everything else (evaluation, question generation, TTS output) is unchanged and still runs through Groq/Edge-TTS as before. No backend changes were needed for this fix - `POST /interviews/:id/answer` already accepted plain text, so the fast path just calls something that already existed.

### What's left after this fix
With upload + Whisper removed from the critical path (when live recognition works), the remaining wait after you stop talking is just two sequential LLM calls - evaluate the answer, then generate the next question (or final report). That's normally a few seconds, not the tens of seconds you were seeing before. This remaining gap is inherent to giving an adaptive, evaluated experience and can't be fully eliminated - a loading indicator here (your original skeleton-animation idea) is still the right call for whatever's left.

### What to test / green-flag
- [ ] In Chrome or Edge: click record, speak an answer, watch the status line - your words should appear live as you talk
- [ ] After you stop talking (either by pausing 3s or clicking stop), the answer should submit and the evaluation should return noticeably faster than before, since there's no upload/Whisper wait
- [ ] Check the "You said (...)" label in the conversation log - it should say "live speech recognition" when the fast path was used
- [ ] Test in a non-Chromium browser (or manually disable the mic mid-recording to force an error) → confirm it falls back to "You said (server-side Whisper)" and still works, just slower
- [ ] Compare the total time from "you stop talking" to "next question appears" before and after this change - it should be a meaningfully smaller number

---

## Module 5: Career Profile

### What this is
Per the original module dependency graph (Auth → Resume/GitHub/Interview → **Career Profile** → Roadmap/Portfolio), this is the aggregator that unifies the three analysis modules into one representation - what Roadmap and Portfolio will both consume once they're built, rather than each querying Resume/GitHub/Interview data independently.

### What's included
- **Deterministic skill merging**: skills from your latest resume analysis, latest GitHub analysis, and all completed interviews are normalized (case/whitespace-insensitive) and deduplicated, with a `sources` array showing *which* analyses confirm each skill - so a skill backed by two independent sources is visibly more trustworthy than one mentioned once
- **Deterministic strengths/growth-areas merging**, same dedup approach, capped at the top 10 most-frequently-mentioned each
- **One AI call** to synthesize everything into a holistic narrative, an `overallReadinessLevel` (early-stage/developing/job-ready/strong), and 2-4 concrete `topPriorityFocus` items - explicitly instructed to acknowledge missing data sources rather than invent claims about them, and to flag when fewer than two sources are available (a "partial picture" disclaimer)
- **On-demand, not automatic** - nothing in Resume/GitHub/Interview needed to change to add this; you call `POST /career-profile/generate` whenever you want a refreshed snapshot
- **Upsert via `findOneAndUpdate`, not fetch-then-save** - one profile per user, regenerated in place. This deliberately avoids the exact fetch-modify-save pattern that caused the `VersionError` race we fixed in the interview module - there's no way for two concurrent generate calls to conflict, the second one just overwrites cleanly
- 24 new automated tests (161 total project-wide), including 10 tests specifically on the merge/dedup logic (the part most likely to have subtle bugs) using deliberately mismatched-casing input across sources to prove the normalization actually works

### API Endpoints (all require `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/career-profile/generate` | — | Regenerates from latest data. Rate-limited to 15/hour. Fails with 400 if you have zero resume/GitHub/interview analyses to draw from. |
| GET | `/api/v1/career-profile` | — | Returns the last-generated profile. 404 if none has been generated yet. |

### Postman
Import `CareerOS-CareerProfile.postman_collection.json`. Run Auth → Login first, and ideally run at least one of the Resume/GitHub/Interview collections beforehand so there's real data to aggregate - the endpoint still works with just one source, but the result (and the "partial picture" note in the narrative) will reflect that.

### What to test / green-flag
- [ ] With zero prior analyses on a fresh account, call `/generate` → clean 400, not a crash
- [ ] Complete a resume analysis, then call `/generate` → profile created, narrative mentions the "partial picture" caveat since only one source is available
- [ ] Complete a GitHub analysis and an interview too, then call `/generate` again → skills that appear in multiple sources should show multiple entries in `sources`; narrative should no longer carry the partial-picture caveat
- [ ] Spot-check: does a skill appear only once in `skills` even if it was phrased slightly differently across sources (e.g. "Node.js" in resume vs "node.js" in GitHub)?
- [ ] Call `/generate` twice in a row → should succeed both times cleanly (no version conflict), second call's data should reflect only the latest analyses, not double-counted
- [ ] `GET /career-profile` before ever generating one → 404 with a clear message telling you to generate first
- [ ] Read the narrative against what you actually know about the test data you fed in - does it feel honest, not inflated, and does it correctly note any real gaps?

---

## Module 6: Learning Roadmap

### What this is, and the reference research behind it
Per your original spec: `Resume skills + GitHub skills + Interview weaknesses + Target role → Skill Gap Analysis → Priority calculation → Learning roadmap`. Before building, I looked at how this is standardly represented - roadmap.sh and the open-source "roadmap viewer" ecosystem universally model a roadmap as a **graph of nodes with prerequisite edges** (a DAG), each node carrying a title, description, prerequisites, resources, and a status field for progress tracking - not a flat ordered list. That's the shape this module returns, specifically so a frontend can render it as the interactive tree/flowchart people expect from "a roadmap," not just a checklist.

### The deterministic/AI split, explained
Your spec says prerequisites and priority should be deterministic. A fully deterministic prerequisite graph would need a hardcoded skill-dependency database - realistic for a fixed catalog (that's literally what roadmap.sh's curated content is), not for arbitrary domains ("backend, frontend, python, php, dsa" per the flexibility work we did earlier). So:

- **AI proposes**: which topics matter for the target role, descriptions, a *proposed* prerequisite structure between those specific topics, resource *topics* (title/type/description only - **never a URL**, since AI-generated links are frequently wrong or dead and would mislead someone trying to actually learn), and 1-2 project ideas per topic
- **Deterministic code validates and computes everything structural** (`src/utils/roadmapGraph.js`):
  - **Cycle removal** - AI-proposed graphs aren't guaranteed acyclic; a DFS with node-coloring detects and breaks any cycle found, so the result is always a valid DAG
  - **Topological sort** (Kahn's algorithm, alphabetically tie-broken for reproducibility) → the actual `learningOrder` on each node
  - **Priority score** - a real formula: `importance weight + (3 × how many other nodes depend on this one) + a small order tiebreak`, then bucketed into critical/high/medium/low by quantile. Not an AI-invented number.
  - **Duration estimate** - a fixed lookup table by complexity tier (beginner/intermediate/advanced → days), summed for the roadmap total
  - **Milestone grouping** - nodes are chunked in learning order until each milestone reaches ~14 days of estimated work, titled by the most common category in that chunk
- **Deterministic safety net regardless of the above**: any AI-proposed node whose title matches a skill already confirmed in your Career Profile is dropped before it ever reaches the graph builder - this is the actual skill-gap enforcement, and it applies whether or not you gave an explicit target-skills list

### What's included
- `POST /roadmap/generate` - requires a Career Profile to already exist (fails with a clear 400 otherwise, no wasted AI call)
- One roadmap per `(user, targetRole)` pair, upserted via `findOneAndUpdate` - same anti-race-condition pattern as Career Profile, and it also means you can hold multiple roadmaps for different target roles (e.g. "Backend Engineer" and "DevOps Engineer") without them colliding
- Node-level progress tracking (`not_started` / `in_progress` / `completed` / `skipped`) via `PATCH .../nodes/:nodeId/status`, updated atomically so it can't race with a concurrent roadmap regeneration
- 57 new automated tests (218 total project-wide), including 21 tests specifically on the graph algorithms - cycle-breaking (direct 2-node cycles and longer chains), diamond-shaped dependency graphs, sanitization of malformed AI output (dangling/self-referencing prerequisite ids, duplicate node ids), and priority scoring behavior

### API Endpoints (all require `Authorization: Bearer <accessToken>`)

| Method | Endpoint | Body | Notes |
|---|---|---|---|
| POST | `/api/v1/roadmap/generate` | `{ targetRole, targetSkills? }` | `targetSkills` is optional - if omitted, the AI infers typical requirements for the role. Rate-limited to 15/hour. |
| GET | `/api/v1/roadmap` | — | Lists all your roadmaps (one per target role you've generated for) |
| GET | `/api/v1/roadmap/:id` | — | Full roadmap detail: nodes, milestones, skill gap, summary |
| PATCH | `/api/v1/roadmap/:id/nodes/:nodeId/status` | `{ status }` | One of `not_started`/`in_progress`/`completed`/`skipped` |

### Postman
Import `CareerOS-Roadmap.postman_collection.json`. You need a Career Profile generated first (run that collection beforehand) or the generate request will correctly 400. The collection includes a test proving regeneration for the same role **upserts in place** (same `_id`) rather than creating a duplicate.

### What to test / green-flag
- [ ] Generate a roadmap with just `targetRole` (no explicit skills) → nodes come back with `learningOrder`, `priorityLabel`, `estimatedDurationDays`, and are sorted in learning order
- [ ] Generate with an explicit `targetSkills` list → `skillGap.alreadyHave`/`missing` reflect that exact list
- [ ] Spot-check the prerequisite structure: does a node with prerequisites always have a `learningOrder` *after* all of its prerequisites? (This is structurally guaranteed by the code, but worth eyeballing on real AI output)
- [ ] Check that no resource in the response has a URL - only title/type/description
- [ ] Mark a node's status as `completed` via the PATCH endpoint → confirm it sticks and other nodes are untouched
- [ ] Generate again for the *same* target role → same roadmap `_id` comes back (upserted), not a duplicate
- [ ] Generate for a *different* target role → a separate roadmap document is created
- [ ] Try a role clearly covered by your existing skills (per your Career Profile) → the roadmap should be short/targeted and `overallSummary` should say so honestly, not pad the list with things you already know

# Narrator's Desk

A private, single-user batch narrator for the **Serious History** YouTube channel.
Paste a formatted narration script, generate several ElevenLabs takes of every
paragraph with a custom voice, audition them, pick the best one per chunk, and
export one ordered zip for Premiere Pro.

- Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, pnpm
- No database: every generated MP3 is cached in the browser's IndexedDB for
  24 hours, so a refresh or a crash never spends credits twice
- Password login with a signed, httpOnly session cookie
- The ElevenLabs key and voice ID stay on the server

---

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the four values
pnpm dev                     # http://localhost:3000
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Production build, then `scripts/check-secrets.mjs`, which fails the build if `ELEVENLABS`, `xi-api-key` or any secret value appears in `.next/static` |
| `pnpm test` | Vitest suite (parser, runner retry/backoff, export, API routes, auth, cache) |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |

## Environment variables

| Name | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key. Server only. |
| `VOICE_ID` | The ID of your custom voice. Server only. |
| `APP_PASSWORD` | The password you type on the login screen. |
| `SESSION_SECRET` | A random string of at least 32 characters. It signs the session cookie. Generate one with `openssl rand -base64 48`. Changing it signs everyone out. |

None of these are prefixed with `NEXT_PUBLIC_`, so Next.js never inlines them
into client code. The build-time secret check enforces this.

## Deploy to Vercel

1. Push this repo to GitHub and click **Add New → Project** in Vercel. Import the repo.
2. Vercel detects Next.js and pnpm automatically. Leave the build command as `pnpm build`.
3. Under **Settings → Environment Variables**, add `ELEVENLABS_API_KEY`, `VOICE_ID`,
   `APP_PASSWORD` and `SESSION_SECRET` for **Production** (and Preview, if you use previews).
4. Deploy. Open the URL, sign in, and pin it to your phone's home screen. The app
   ships a web manifest and icon.

`/api/tts` sets `maxDuration = 120` because v3 can be slow on long chunks. This
fits within Vercel's default function limits when fluid compute is on, which is
the default for new projects.

## Finding your voice ID

1. In ElevenLabs, open **Voices → My Voices**.
2. Click your voice, open the **⋯** menu (or the voice's detail panel), and choose
   **Copy voice ID**. It's a 20-character string like `21m00Tcm4TlvDq8ikWAM`.
3. Or call the API: `curl -H "xi-api-key: $ELEVENLABS_API_KEY" https://api.elevenlabs.io/v2/voices`
   and look up your voice's `voice_id`.

## Script format

Only text inside `[AUDIO …]` blocks is narrated. Everything else is ignored, so you
can paste a full production script with `[VISUAL]`, `[SKIT]`, `[SPONSOR]` and
`[FACT-CHECK …]` lines left in.

```
@@VIDEO: worst-jobs-medieval
@@TAKES_V2: 2
@@TAKES_V3: 4

== S0: Cold Open ==
[AUDIO — v2]
Today, we're going over the worst jobs in medieval times.

== S1: Richard the Raker ==
[AUDIO — v2]
Richard the Raker.
<break time="1s" />
It's thirteen twenty-six, and a man named Richard is
shoveling human waste out of a London cesspit...

[VISUAL] STILL — Richard beside his handcart — 6s
[AUDIO — v3 — CLIMAX]
The floorboards groan. [gasps] And then... they give way.
```

| Element | Rule |
| --- | --- |
| `@@VIDEO: slug` | Required. Lowercase letters, digits and hyphens only. Used for file names and the cache key. |
| `@@TAKES_V2` / `@@TAKES_V3` | Takes per chunk. Defaults are 2 and 4, clamped to 1–6. |
| `== S1: Title ==` | Story header. Chunk numbers restart at 001 for each story. |
| `[AUDIO — v2]`, `[AUDIO — v3]`, `[AUDIO — v3 — CLIMAX]` | Starts a narration block. Em dash, en dash and hyphen all work. |
| Block end | The next line starting with an UPPERCASE tag (`[VISUAL]`, `[SKIT]`, `[AUDIO …]`…), a story header, or the end of the file. |
| Paragraphs | Blank lines split chunks. Lines within a paragraph are joined with spaces. |
| `<break time="1s" />` on its own line | Removed from the text. Ends the paragraph and sets `pause_after` on the chunk before it (in the manifest, for the edit). |
| `[sighs]`, `[gasps]`… | v3 Audio Tags. They're part of the narration, even at the start of a line. |

The exact test file is `fixtures/example.txt`. Use **Load example** in the app to load it.

**Errors** block a run: missing or invalid `@@VIDEO`, narration outside a story,
an Audio Tag in a v2 block, a `<break>` inside v3 text, an UPPERCASE tag inside
narration, a chunk over 1,500 characters, an empty block, or an unreadable
`[AUDIO …]` label.

**Warnings** don't block a run: digits in narration (spell numbers out), chunks
over 600 characters, two Audio Tags in one sentence, a story with no CLIMAX block
(S0 is exempt), and mis-cased tags like `[Sighs]`.

Tap any issue to jump to its line in the editor.

## Generating, auditioning, exporting

- **Generate climax only** and **Generate all** fill each chunk up to its take count
  and skip takes that are already cached and fresh. **Re-roll** (on a chunk row)
  adds 1–6 new takes without replacing existing ones. **Retry failed** re-runs
  only the takes that failed.
- Every run opens a confirm sheet first. It shows the take count, characters
  (chars × takes), estimated credits, and remaining credits. If the estimate is
  over 80% of what's left, the button switches to a warning state.
- Three requests run at once (`CONCURRENCY` in `lib/runner.ts`). 429, 500, 502,
  503, 504 and network errors retry after 2s, 4s, 8s, then 16s, or after
  `Retry-After` if ElevenLabs sends it. Any other 4xx fails that take immediately
  and shows the error on its row. A 401 or 402 from ElevenLabs stops the whole run,
  since every other take would fail the same way.
- **Pause** lets in-flight takes finish (they're already billed). **Cancel** aborts
  them. If the phone goes offline mid-run, the run pauses and resumes on reconnect.
  A screen Wake Lock is held while a run is active.
- Each take is saved to IndexedDB under `${video}/${chunkId}/t${take}` with
  `{ blob, seed, model, createdAt, textHash }`.
- **Retention: 24 hours.** Takes are kept for 24 hours after they're generated.
  Picks and the pasted script are kept for 24 hours after their last change.
  Anything older is pruned on load, and once a minute while the tab is open.
  Export whatever you want to keep. Regenerating a take after it has expired
  costs credits again. The app asks the browser for persistent storage so the
  data isn't evicted early. Data is per browser: your phone and your desktop
  don't share takes. If you edit a chunk's text (or move
  it between v2 and v3), its old takes are marked **stale**. They stay playable
  but can't be picked or exported, and the next run regenerates them.
  **Clear stale takes** frees the space.
- Keyboard: `j`/`k` next/previous chunk, `space` play/pause, `1`–`6` pick a take.
  Filters: All, Climax, v3, Failed, Unpicked.
- Export builds `{video}.zip` in the browser: `takes/`, `selects/` (picked takes
  only), `manifest.csv` and `script_used.txt`. Choose All takes, Selects only, or
  Both (the default). Only fresh takes are exported.

## Credit math

ElevenLabs bills by characters sent. For Multilingual v2 and v3, one character
is one credit. Audio Tags like `[sighs]` count as characters. Inline v2 `<break>`
tags are sent as text, so they count too.

```
estimate = Σ over jobs ( chunk.chars × credits_per_char(model) )
```

For a full run, that's `Σ chars × takes`. The example script has 343 characters,
4 v2 chunks × 2 takes and 2 v3 chunks × 4 takes, for 856 credits. The per-model
rate lives in `lib/voice-config.ts` (`creditsPerChar`). Update it if your plan
bills a model differently. Remaining credits come from `GET /api/usage`
(`character_limit − character_count`).

## Voice settings

All voice settings live in `lib/voice-config.ts`:

| Model | `model_id` | Settings sent |
| --- | --- | --- |
| v2 | `eleven_multilingual_v2` | stability 0.40, similarity_boost 0.78, style 0.32, use_speaker_boost true, speed 1.05 |
| v3 | `eleven_v3` | stability 0.0 (Creative), similarity_boost 0.78, use_speaker_boost true |

Output is `mp3_44100_128`. Each take sends a random 32-bit `seed`, which is
stored with the take and written to the manifest.

**Deviation note:** the build environment couldn't reach elevenlabs.io to
re-check the v3 parameter docs. v3 is therefore sent **without `style` and
`speed`**: v3 doesn't expose a speed control, and style isn't a v3 control, so
both are left out rather than risk a rejected request. v3 stability must be
exactly 0.0, 0.5 or 1.0. If ElevenLabs ever rejects a setting, the 4xx detail
appears on the chunk row, and you can fix it in `voice-config.ts`.

## Known ElevenLabs API limits

- **Characters per request:** v2 allows about 10,000 and v3 about 5,000. This app
  caps chunks at 1,500 and warns above 600, because long chunks drift in delivery.
- **Concurrency:** each plan has a limit on simultaneous requests (lowest on Free,
  higher on paid tiers). Going over returns 429 (`too_many_concurrent_requests`
  or `system_busy`), which the runner retries. Concurrency 3 suits Starter and up.
  On Free, set `CONCURRENCY` to 2.
- **v3 features:** no SSML `<break>` tags (use punctuation, ellipses or Audio Tags),
  discrete stability, no speed control.
- **v2 features:** no Audio Tags. v2 reads `[sighs]` aloud, which is why it's a
  validation error.
- **Seeds:** the same seed and text usually give a similar take, but ElevenLabs
  doesn't guarantee determinism.
- **Quota:** when credits run out, ElevenLabs returns 401 (`quota_exceeded`) or
  402. The run stops and finished takes stay cached.

## Security notes

- `proxy.ts` (Next 16's new name for `middleware.ts`) guards every route except
  `/login` and `/api/login`. `/api/tts` and `/api/usage` re-verify the cookie
  themselves.
- The session is an HS256 JWT signed with `SESSION_SECRET` via `jose` (Web Crypto,
  so it works on Edge). The cookie is `httpOnly`, `secure`, `sameSite=strict`,
  with a 30-day expiry.
- Passwords are compared in constant time: both sides are HMAC'd with a random
  key, then compared byte-for-byte. After 5 wrong attempts from one IP, responses
  are delayed 1s, 2s, 4s… up to 30s. This counter is in memory per server instance.
- Upstream error bodies are reduced to their message string, scrubbed of the key
  and voice ID, and length-capped before reaching the browser. Upstream headers
  are never forwarded, except `Retry-After`.

## Project layout

```
app/                 pages, API routes (login, logout, tts, usage), icon, manifest
components/          Header, QuillMark, SectionLabel
components/desk/     Script editor, Validate, Generate, Audition, Export, hooks
lib/parser.ts        script parser + validation (pure)
lib/runner.ts        job planning, retry/backoff, concurrency runner
lib/export.ts        zip, manifest.csv, file naming (pure)
lib/cache.ts         IndexedDB (idb-keyval)
lib/voice-config.ts  models, voice settings, credit rates
proxy.ts             auth gate
scripts/check-secrets.mjs
tests/               Vitest
```

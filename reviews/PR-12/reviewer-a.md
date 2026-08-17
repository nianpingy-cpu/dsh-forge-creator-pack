# PR #12 Review — CREATOR-006 creator-transcribe

Independent external model review (non-implementer). Two rounds + reviewer-recommended cleanup applied before merge.

## Round 1 — REQUEST_CHANGES
- Blocking: B1 (subtitle/ASS injection — transcript `segment.text` written raw
  into SRT/VTT/ASS, so crafted transcript text could inject cue boundaries,
  VTT `NOTE`/`STYLE` blocks, ASS override tags / section headers = silent data
  corruption of a distributable artifact).
- Non-blocking (11): N1 whisper stdout-JSON assumption unverified (openai-whisper
  writes JSON to a file, text to stdout — zero happy-path coverage); N2
  `language` arg no-op; N3 word granularity approximated (no `--word_timestamps`);
  N4 redact uses `args.audio` not canonical; N5 no file-size guard / duration
  guard only for WAV; N6 `guardAudio` reads whole file; N7 whisper model download
  under `read` mutation; N8 nonexistent audio + mock silently succeeds; N9
  whisper writes `<audio>.json` to cwd; N10 vestigial provider factory; N11
  invalid whisper timestamps reported as InvalidArguments.

## Fixes applied (regression TDD) — Round 1 blockers
- B1: `sanitizeLine` (collapse `\r\n\t` → space, strip C0/DEL control chars,
  trim) applied in `toSrt`/`toVtt`; `sanitizeAssText` (sanitizeLine + `{`/`}`
  → fullwidth + `,` → `，`) applied in `toAss`. Control-char class built via
  `new RegExp(String.fromCharCode(...))` to satisfy `no-control-regex`.
- N4: `redact: [args.audio, guarded.canonical]`.
- N6: `guardAudio` reads only the 44-byte WAV header (`openSync`/`readSync`).
- Added regression tests: SRT cue injection, VTT NOTE/STYLE injection, ASS
  override-tag + section-header injection; whisper integration suite (realistic
  JSON stdout, sidecar fallback, malformed JSON, non-zero exit, timeout);
  permission-denied gates for `subtitle_srt` / `transcript_export`.

## Round 2 — APPROVE
- B1 verified fixed across all three renderers; no raw transcript text reaches
  structured output. Regression tests empirically replayed against pre-fix code
  (SRT/ASS effective; VTT flagged vacuous → fixed).
- Full plugin suite 23/23; typecheck 0; lint 0.
- Non-blocking follow-ups flagged: NB-1 whisper sidecar filename must match real
  openai-whisper (`<basename-without-ext>.json` in cwd); NB-2 `parsed.segments`
  unguarded (JSON `null` → uncaught TypeError); NB-3 VTT regression test vacuous;
  NB-4 transcript_export newline inconsistency; NB-5 C1 controls / U+2028/2029
  not stripped (defense-in-depth).
- Final merge recommendation (Round 2): **Merge**, with follow-ups recommended.

## Reviewer-recommended cleanup applied before merge
- NB-1: sidecar fallback now tries both `<audio>.json` and
  `<basename-without-ext>.json` (matches openai-whisper `ResultWriter` naming);
  sidecar tests cover both spellings.
- NB-2: `Array.isArray(parsed?.segments)` guard — unexpected shape (e.g. `null`)
  degrades to an empty transcript, never an uncaught TypeError.
- NB-3: VTT regression payload rewritten with a blank-line-terminated
  `cue text\n\nNOTE ...\nSTYLE ...` vector so it fails against pre-fix code.
- NB-4/NB-5: accepted as documented cosmetic / defense-in-depth residuals.

## Evidence
- RED (`a57677e`): 13 fail (stubs throw "not implemented")
- GREEN (`5eddd1b`): 13 pass
- B1 regression RED (`7b51e19`): 3 fail → GREEN (`4bdab20`): 16 pass
- NB cleanup GREEN (`9e13133`): 25 transcribe tests pass
- Final: 25 transcribe tests; typecheck 0; lint 0; full suite 214
  (1 pre-existing `packages/core` timing flake, passes in isolation, branch
  does not touch core); CI green.
- Merge commit: `98fd95f` (PR #12)

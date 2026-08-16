# PROJECT_STATUS

Current Version: 0.1.0 (bootstrap — no tag yet)
Current Milestone: Creator Alpha (CREATOR-001 … CREATOR-011)
Current Issue: CREATOR-011 MERGED — creator-localize (PR #22)

## Completed (merged + closed with evidence)

- bootstrap monorepo skeleton: adapted `@dsh-forge-creator/core` (from
  `@dsh-forge/core`, MIT), root gates (typecheck/lint/test/build), CI, docs/creator,
  AGENTS.md, README, no-shell ESLint rule + regression tests
- **CREATOR-001 Ecosystem & Overlap Lock** (PR #2): `docs/creator/ecosystem.json`
  (20 capability rows) + ECOSYSTEM_MATRIX / UPSTREAM_LICENSES /
  BUILD_REUSE_DECISIONS, validator `scripts/creator-ecosystem-check.ts`,
  `tests/creator-ecosystem.test.ts` (11 tests), `creator-contract` CI job.
  External review APPROVE (2 rounds, no blocking findings).
- **CREATOR-002 Creator Core Contracts** (PR #4): Creator Domain in
  `@dsh-forge-creator/core` — `src/creator/{types,validate,errors,provider}` +
  `index`; shared CreatorAsset / RightsMetadata / PlatformPostDraft /
  PublishResult / CredentialRef / CreatorError / CreatorProvider contracts.
  26 creator-contract tests. External review APPROVE (2 rounds, no blocking
  findings).
- **CREATOR-003 Creator Safety Policy** (PR #6): `src/creator/safety.ts` —
  creator mutation classes, approval gate (scope/content-hash/expiry), rights
  policy, voice authorization, bypass-flag rejection, credential-plaintext
  rejection, log redaction, resource limits. 32 creator-safety tests. External
  review APPROVE (2 rounds, no blocking findings).
- **CREATOR-004 creator-radar** (PR #8): first plugin package — 9 tools
  (trend_sources … opportunity_rank), 3 providers (mock fixture / RSS /
  TrendRadar-compatible adapter), evidence-backed scoring, shared contract
  suite; core kit `missingBinaryTool` now optional for binary-free plugins.
  External review APPROVE (2 rounds, no blocking findings).
- **CREATOR-005 creator-capture** (PR #10): 8 tools (media_inspect …
  playlist_download), typed argv[] (never shell/extra args), rights/provenance,
  permission gate, bounded playlists, source-URL redaction, dry-run. External
  review APPROVE after 4 rounds (B1–B4 + inspect redaction closed).
- **CREATOR-006 creator-transcribe** (PR #12): 9 tools (transcribe_media …
  transcript_export), whisper external-binary provider with stdout-JSON +
  sidecar fallback (openai-whisper naming), deterministic mock, subtitle
  renderers with injection-safe sanitization (SRT/VTT/ASS), duration guard
  (header-only read), permission gates, timeout/redaction. 25 tests. External
  review APPROVE after 2 rounds (B1 subtitle-injection closed via regression
  TDD; reviewer-recommended whisper sidecar + JSON-shape cleanup applied).
- **CREATOR-007 creator-clips** (PR #14): 8 tools (clip_by_time …
  merge_segments). Carried in `@dsh-forge/plugin-ffmpeg` (MIT) as
  `@dsh-forge-creator/plugin-ffmpeg` (REUSE — attribution preserved, no
  reimplementation) and extended with 3 fixed typed operations
  (video_vertical/video_square with real output-ratio verification via
  ffprobe, silence_remove). `plugin-creator-clips` is a pure orchestration
  layer (no ffmpeg argv, no free-form params) composing the adapter; RED
  range/duration/collision/aspect/no-shell tests. Core gained backward
  compatible `runnerByTool` + union value types. 21 clips + 72 adapter tests.
  External review APPROVE (1 round, no blocking findings).
- **CREATOR-008 creator-short-video** (PR #16): 5 tools (short_video_plan …
  short_video_preview), centralized Plan Schema (script/aspectRatio/
  durationTarget/voiceMode/subtitleMode/assetStrategy/outputDir), deterministic
  mock with a shared module-level job store (plan -> generate -> status ->
  assets E2E), MoneyPrinterTurbo-compatible provider adapter (MIT, no
  vendoring, unconfigured -> typed ToolFailure), bounded status polling with
  typed Timeout, workspace-bounded outputDir, no external-URL/credential leak.
  20 tests. External review APPROVE (1 round + NB cleanup: dead code removed,
  permission-denied test added).
- **CREATOR-009 creator-cover** (PR #18): 7 tools (cover_generate_background …
  cover_validate), centralized platform profiles (6 platforms with source
  notes), LocalLayoutProvider (overflow / safe-area / font-fallback), mock
  background with dimension recording, optional ComfyUI external HTTP/API
  adapter (GPL-3.0, no vendoring, unconfigured -> typed ToolFailure),
  cover_variants -> validate -> CreatorAsset[] acceptance. 21 tests. External
  review APPROVE (1 round + NB cleanup: background default derived from
  profile, store keying documented).
- **CREATOR-010 creator-voice** (PR #20): 6 tools (voice_register_reference …
  voice_preview), mandatory authorization model (authorization: true, note
  optional), reference metadata = source/owner/checksum/createdAt (no
  biometrics), authorized-reference-only clone/transfer (no impersonation
  bypass), workspace-bounded outputs, credential redaction on all outputs,
  deterministic mock + OpenVoice-compatible external adapter (no vendoring).
  16 tests. External review APPROVE (1 round + NB comment: canonical-path
  binding documented for the future real provider).
- **CREATOR-011 creator-localize** (PR #22): 6 tools (subtitle_translate …
  localize_preview), deterministic SRT parse/validate/align/resegment (valid
  timestamps, no negative time), explicit same-language policy, overwrite
  guards, dub_video passes the creator-voice authorized-reference policy
  (public getReference export added to creator-voice), mock + VideoLingo-
  compatible external adapter (Apache-2.0, no vendoring). 13 tests. External
  review APPROVE (1 round + NB cleanup: overwrite guard on derived output,
  dub re-asserts voice authorization).

## In progress / planned

- CREATOR-012 creator-motion
- CREATOR-013 creator-publish
- CREATOR-014 Creator Skills
- CREATOR-015 Presets + E2E Stories
- CREATOR-016 Release Hardening (v0.1.0 release)

# PROJECT_STATUS

Current Version: 0.1.0 (bootstrap — no tag yet)
Current Milestone: Creator Alpha (CREATOR-001 … CREATOR-006)
Current Issue: CREATOR-006 MERGED — creator-transcribe (PR #12)

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

## In progress / planned

- CREATOR-007 creator-clips
- CREATOR-008 creator-short-video
- CREATOR-009 creator-cover
- CREATOR-010 creator-voice
- CREATOR-011 creator-localize
- CREATOR-012 creator-motion
- CREATOR-013 creator-publish
- CREATOR-014 Creator Skills
- CREATOR-015 Presets + E2E Stories
- CREATOR-016 Release Hardening (v0.1.0 release)

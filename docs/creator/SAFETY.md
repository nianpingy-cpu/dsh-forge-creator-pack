# Creator Pack — Safety (CREATOR-016)

Safety is designed in from CREATOR-003 (core safety policy) and enforced by
every plugin's tests. This page is the operator-facing summary.

## Permission & approval model

- **Mutation classes**: read / workspace-write / network / process /
  system-change / destructive. Every mutating tool gates side effects on
  `ctx.permission`.
- **Workspace boundary**: all writes resolve inside `workspaceRoot`; escaping
  paths are rejected (`WorkspaceViolation`).
- **Publish approval** (`creator-remote-publish` / `creator-remote-destructive`):
  `post_publish` / `post_schedule` / `post_cancel_schedule` require an approval
  object that is content-hash bound to the exact draft, scoped, and expiring
  (`assertCreatorApproval`). Without it the tool returns `PermissionDenied`.
  The model/agent can never mint an approval itself — only the host can.
- **Voice authorization** (`creator-voice-sensitive`): `voice_register_reference`
  requires `authorization: true`; `voice_clone` / `voice_style_transfer` /
  `dub_video` operate only on authorized registered references. A bare
  celebrity/person name is rejected (no impersonation bypass).

## Process & network safety

- **No arbitrary shell**: plugins emit typed `string[]` argv and run through
  the core process runner (never `shell: true`). Env is an allowlist, never
  the full inherited environment, so harness secrets cannot reach child
  binaries (e.g. ffmpeg parsing untrusted media).
- **Capture**: downloaders run with strict argv, explicit `rights` confirmation
  (never defaulted), overwrite policy (`fail` / `overwrite-approved`), bounded
  playlists, and `-protocol_whitelist`/`-probesize` guards for media parsing
  (no SSRF via hostile playlists).
- **Transcribe**: duration guard reads only the file header; large-media
  resource limits; whisper runs as an external binary with typed argv.

## Secret handling

- **Credential redaction**: every provider that touches remote credentials
  redacts them from model-visible output (`redactCredentials` — URL userinfo,
  `user:pass@`, headers). Redaction is asserted by plugin tests.
- **No credentials in CI**: CI is mock-only; unconfigured external adapters
  return a typed `ToolFailure`, never a real publish.
- The release gate runs `scripts/creator-security-audit.ts` (API keys, tokens,
  private keys, Authorization headers, credential assignments, machine-specific
  absolute user paths, >1 MiB generated media) and blocks a tag on any finding.

## Rights & provenance

Every captured/generated asset carries `RightsMetadata` (status owned /
licensed / fair-use / cc / public-domain) and provenance. `media_download`
requires an explicit `rights` confirmation with status `owned`.

## Scope of this release

Mock providers are the safe default. External providers (see
[PROVIDERS.md](PROVIDERS.md)) are adapters only — no upstream code is vendored,
and GPL/AGPL/unknown-license upstreams are consumed as external services or
binaries, never copied into this repository.

# Creator Pack — Release Notes v0.1.0 (CREATOR-016)

## What is Creator Pack

A typed, safe creator-workflow plugin pack for DeepSeek Harness (`dsh`): from
topic discovery and licensed media capture, through transcription, short-form
production, covers, voice, localization and motion, to **controlled
multi-platform publishing** (draft → preview → approval → publish → verify).
This is a dedicated repository that adapts `@dsh-forge/core` (MIT) into
`@dsh-forge-creator/core` with Creator-domain contracts.

## Plugins included (10 + ffmpeg adapter)

| Plugin | Tools | Role |
| --- | --- | --- |
| creator-radar | 9 (trend_sources … opportunity_rank) | hot-topic & scoring |
| creator-capture | 8 (media_inspect … playlist_download) | licensed capture |
| creator-transcribe | 9 (transcribe_media … transcript_export) | transcription & subtitles |
| creator-clips | 8 (clip_by_time … merge_segments) | long-video clipping |
| creator-short-video | 5 (short_video_plan … short_video_preview) | script → short job |
| creator-cover | 7 (cover_generate_background … cover_validate) | platform covers |
| creator-voice | 6 (voice_register_reference … voice_preview) | authorized TTS/clone |
| creator-localize | 6 (subtitle_translate … localize_preview) | localization |
| creator-motion | 5 (motion_templates … motion_preview) | template motion |
| creator-publish | 9 (publisher_accounts … post_cancel_schedule) | controlled publishing |
| plugin-ffmpeg | 11 (media_probe … silence_remove) | media adapter (reused) |

Plus: 4 composable presets, 7 creator skills, 5 deterministic E2E stories.

## Safety defaults

- No remote publish without explicit host-minted approval (content-hash bound,
  scoped, expiring) → `PermissionDenied` otherwise.
- No arbitrary shell (typed argv, env allowlist); workspace-bound writes.
- Voice clone/transfer require an authorized registered reference.
- Credential redaction on every provider output.
- CI is mock-only; unconfigured external adapters are `ToolFailure`.

## Providers

Deterministic mock providers are the default and the CI path. External
adapters (TrendRadar/RSS, yt-dlp, openai-whisper, ffmpeg/ffprobe, MPT, ComfyUI,
OpenVoice, VideoLingo, Remotion, Postiz) are opt-in and adapter-only — no
upstream code is vendored. See [PROVIDERS.md](PROVIDERS.md).

## Known limitations

- Mock providers are the only fully-tested path in CI; external providers
  require their own binaries/services and are not exercised in CI.
- `post_publish` gates on the approval argument; the host must never expose the
  `createApproval` helper to an agent (documented in core safety).
- Cover validation checks the recorded dimension record (mock), not raw PNG
  pixels — real providers must re-validate.
- Remotion license is custom/NOASSERTION; usage is adapter-only and CI
  mock-only (gate re-check recorded in UPSTREAM_LICENSES.md).

## Experimental integrations

- ComfyUI (GPL-3.0) cover generation — external HTTP/API adapter.
- Remotion-compatible motion renderer — external adapter, license-gated.
- MoneyPrinterTurbo-compatible short-video adapter (MIT) — unconfigured in CI.

## Compatibility

- Node ≥ 20, pnpm 11.4, TypeScript 5.8 (type-stripping for `node scripts/*.ts`).
- Validated on **ubuntu-latest** (CI: node 22) and **Windows** (local fresh
  clone). Other platforms are not claimed as tested.
- FFmpeg/ffprobe/whisper/yt-dlp binaries are resolved from `PATH` at runtime
  and are not bundled.

## License notes

MIT (this pack). `@dsh-forge-creator/core` retains the MIT notice of the
adapted `@dsh-forge/core`. GPL/AGPL/unknown-license upstreams are adapters
only, never vendored — see [UPSTREAM_LICENSES.md](UPSTREAM_LICENSES.md) and
[BUILD_REUSE_DECISIONS.md](BUILD_REUSE_DECISIONS.md).

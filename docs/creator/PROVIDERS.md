# Creator Pack — Providers (CREATOR-016)

Every plugin ships a **deterministic mock provider** (the CI default) plus an
optional **external provider** that is an adapter only (no vendored upstream
code). Unconfigured external providers return a typed `ToolFailure`.

| Plugin | Mock (default, CI) | External adapter (opt-in) | Upstream (license) |
| --- | --- | --- | --- |
| creator-radar | fixture topics, deterministic scoring | TrendRadar-compatible MCP/HTTP + RSS feed | TrendRadar GPL-3.0 / RSS AGPL-3.0 (data) |
| creator-capture | canned runner (no binary) | yt-dlp external CLI binary (argv only) | yt-dlp Unlicense |
| creator-transcribe | deterministic segments | openai-whisper external binary | openai/whisper MIT |
| creator-clips | — (composes ffmpeg adapter) | ffmpeg/ffprobe external binaries | ffmpeg (LGPL/GPL build) |
| creator-short-video | singleton mock job store | MoneyPrinterTurbo-compatible adapter | MPT MIT |
| creator-cover | mock background (dimension-recording) | ComfyUI HTTP/API adapter | ComfyUI GPL-3.0 |
| creator-voice | synthetic TTS mock (returns path) | OpenVoice-compatible adapter | OpenVoice MIT |
| creator-localize | `[lang]`-prefixed translation mock | VideoLingo-compatible adapter | VideoLingo Apache-2.0 |
| creator-motion | fully-local deterministic renderer | Remotion-compatible adapter | Remotion custom/NOASSERTION (license gate recorded) |
| creator-publish | `mock` publisher (published/unknown/failed, idempotent) | Postiz / Official / Local adapters | Postiz AGPL-3.0 |

## Provider selection

Tools accept a `provider` argument (default `"mock"`). Examples:

- `trend_fetch({ source: "mock" })` / `{ source: "rss" }`
- `transcribe_media({ audio, provider: "whisper" })`
- `cover_generate_background({ outputPath, width, height, provider: "comfyui" })`
- `post_publish({ draftId, approval, provider: "postiz" })`
- `tts_generate({ text, outputPath, provider: "openvoice" })`

## External-binary providers (capture / transcribe / clips)

These resolve binaries from `PATH` (never a bare name on Windows) and run them
through the core process runner with typed argv, an env allowlist, timeouts and
output caps. When a binary is absent the tool returns `BinaryNotFound` with an
install hint — it never falls back to a shell string.

## License posture

GPL/AGPL/unknown-license upstreams are **adapter/provider only** — consumed as
external services or binaries, never copied. The full decision matrix is in
[ECOSYSTEM_MATRIX.md](ECOSYSTEM_MATRIX.md) and
[UPSTREAM_LICENSES.md](UPSTREAM_LICENSES.md).

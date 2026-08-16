# Build / Reuse / Integrate Decisions — DSH Forge Creator Pack

> CREATOR-001 — what the Creator Pack builds, reuses, integrates, and
> explicitly does not build. Rationale for each decision in
> [`ECOSYSTEM_MATRIX.md`](ECOSYSTEM_MATRIX.md) and license details in
> [`UPSTREAM_LICENSES.md`](UPSTREAM_LICENSES.md).

## Build (new plugin in this repository)

| Plugin | Builds on | Why here |
|---|---|---|
| `plugin-creator-radar` (CREATOR-004) | TrendRadar-compatible provider (GPL, adapter), RSS-compatible provider, MockRadarProvider | Creator-grade topic discovery with score + evidence, not a news list |
| `plugin-creator-capture` (CREATOR-005) | yt-dlp external CLI provider | Controlled licensed capture with rights/provenance; not an arbitrary downloader |
| `plugin-creator-transcribe` (CREATOR-006) | Whisper-compatible provider | Creator-grade transcription (timestamps, SRT/VTT, chapters), not one-shot STT |
| `plugin-creator-clips` (CREATOR-007) | **REUSE existing ffmpeg adapter** | High-level workflow clips; never re-implements FFmpeg |
| `plugin-creator-short-video` (CREATOR-008) | MoneyPrinterTurbo-compatible provider + mock | topic/script → short-video job adapter |
| `plugin-creator-cover` (CREATOR-009) | LocalLayoutProvider + optional ComfyUI (GPL, external) | platform-ready covers with size/safe-area validation |
| `plugin-creator-voice` (CREATOR-010) | OpenVoice-compatible provider + mock | authorized TTS/clone with consent gate |
| `plugin-creator-localize` (CREATOR-011) | VideoLingo-compatible provider + mock | subtitle translate/align/resegment workflow |
| `plugin-creator-motion` (CREATOR-012) | generic provider interface + local deterministic mock (Remotion license gate) | template-driven motion renders |
| `plugin-creator-publish` (CREATOR-013) | Postiz API adapter (AGPL, external) + MockPublisher + LocalAutomationProvider | draft → preview → approval → publish state machine |

## Reuse (existing capability, no re-implementation)

| Capability | Source | Used by |
|---|---|---|
| FFmpeg media probe/edit | existing dsh-forge `plugin-ffmpeg` (MIT) via core provider | `creator-clips` |
| Process runner, workspace policy, permission classes, diagnostics, contract kit | `@dsh-forge-creator/core` (adapted `@dsh-forge/core`, MIT) | all plugins |
| Generic web search / news briefing / image upload / media crawl | DeepSeek Harness ecosystem | referenced, never rebuilt |

## Integrate (external upstream via adapter, never vendored)

| Capability | Upstream | Integration |
|---|---|---|
| Feed / trend data | RSSHub (AGPL) | HTTP feed consumption |
| Cover generation | ComfyUI (GPL) | HTTP/API to external service |
| Publishing backend | Postiz (AGPL) | API adapter to external service |
| Trend signals | TrendRadar (GPL) | MCP/HTTP adapter, external service |

## Do not build (explicitly out of scope)

| Capability | Reason |
|---|---|
| social-auto-upload | **no explicit license** → no vendoring; publish automation is adapter-only |
| LosslessCut | GPL-2.0 GUI; capability covered by ffmpeg adapter |
| OpenBiliClaw | cross-platform content discovery is out of Creator Pack scope; existing DSH plugin exists |
| PicGo / generic image upload | out of scope (taskbook: no generic image-hosting rebuild) |
| Generic web search / news briefing / media crawler | out of scope (taskbook: no generic rebuilds) |
| Arbitrary shell execution | forbidden (ADR-004); never exposed as a tool |
| CAPTCHA bypass / anti-detection / DRM bypass | forbidden |

## Binding consequences

1. Every plugin reuses `@dsh-forge-creator/core` — no second infrastructure.
2. No GPL/AGPL/unclear-license source is copied into this repository.
3. `creator-clips` reuses the ffmpeg adapter — a second FFmpeg wrapper fails review.
4. `creator-publish` default is draft/preview/dry-run; approval is mandatory for
   any remote side effect.

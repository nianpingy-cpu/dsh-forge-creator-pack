# Ecosystem Matrix — DSH Forge Creator Pack

> CREATOR-001 — the single upstream-decision baseline for every later CREATOR
> issue. Machine-readable source of truth: [`ecosystem.json`](ecosystem.json).
> Fields per capability: **Capability | Existing DSH overlap | Candidate
> upstream | Stars/date checked | License | Integration mode | Decision |
> Risk**. Decision: `BUILD` / `REUSE` / `INTEGRATE` / `DO NOT BUILD`.

## Target Creator plugins

| Capability | Existing DSH overlap | Candidate upstream | Stars/date | License | Integration mode | Decision | Risk |
|---|---|---|---|---|---|---|---|
| creator-radar | none in repo; DSH has generic web search | [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) | 61,488 / 2026-08-16 | GPL-3.0 | provider-compatible adapter (MCP/HTTP/RSS); external service; no source copying | BUILD | GPL-3.0 forces adapter-only |
| creator-capture | none in repo | [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | 184,678 / 2026-08-16 | Unlicense | external CLI binary provider (argv[]); no vendoring | BUILD | rights policy + workspace guard; no DRM bypass |
| creator-transcribe | none in repo | [openai/whisper](https://github.com/openai/whisper) | 107,338 / 2026-08-16 | MIT | external model/binary provider (Whisper-compatible) | BUILD | large media limits; deterministic fixtures |
| creator-clips | existing dsh-forge ffmpeg adapter | existing ffmpeg adapter | n/a / 2026-08-16 | MIT | REUSE ffmpeg adapter via core provider; workflow tools only | BUILD | no second FFmpeg wrapper |
| creator-short-video | none in repo | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 103,987 / 2026-08-16 | MIT | provider-compatible adapter + mock; no vendoring | BUILD | plan-before-generate contract |
| creator-cover | generic image gen exists in DSH ecosystem | [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) | 127,798 / 2026-08-16 | GPL-3.0 | HTTP/API adapter to external service; no source copying | BUILD | GPL-3.0 forces external-service adapter |
| creator-voice | generic TTS may exist; authorized clone does not | [myshell-ai/OpenVoice](https://github.com/myshell-ai/OpenVoice) | 37,148 / 2026-08-16 | MIT | provider (OpenVoice-compatible) + mock | BUILD | authorization-gated clone; no biometrics storage |
| creator-localize | none in repo | [Huanshere/VideoLingo](https://github.com/Huanshere/VideoLingo) | 18,150 / 2026-08-16 | Apache-2.0 | provider-compatible adapter + mock; no vendoring | BUILD | dubbing passes voice policy |
| creator-motion | none in repo | [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 56,421 / 2026-08-16 | Remotion License (custom, NOASSERTION) | generic HTTP/command provider interface only; license gate; no vendoring | BUILD | custom license — no vendoring; deterministic mock renderer for CI |
| creator-publish | none in repo (ad-hoc article publish exists in DSH ecosystem) | [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app); [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload) | 34,710 / 14,251 / 2026-08-16 | AGPL-3.0 / none | API adapter (Postiz, external service); LocalAutomationProvider for CN platforms; never vendor social-auto-upload | BUILD | highest-risk plugin: approval gate, idempotency, dry-run, CI mock-only |

## Ecosystem capabilities — do-not-build / reuse / integrate

| Capability | Existing DSH overlap | Candidate upstream | Stars/date | License | Integration mode | Decision | Risk |
|---|---|---|---|---|---|---|---|
| rsshub | none in repo (feeds used by creator-radar) | [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | 45,751 / 2026-08-16 | AGPL-3.0 | HTTP feed consumption (external service); no source copying | INTEGRATE | AGPL-3.0 — consume over HTTP only |
| losslesscut | ffmpeg adapter covers lossless cutting | [mifi/lossless-cut](https://github.com/mifi/lossless-cut) | 42,952 / 2026-08-16 | GPL-2.0 | none — ffmpeg adapter covers it | DO NOT BUILD | GUI app; capability covered |
| openbiliclaw | existing dsh-openbiliclaw DSH plugin (BSD-3-Clause) | [whiteguo233/OpenBiliClaw](https://github.com/whiteguo233/OpenBiliClaw) | 2,603 / 2026-08-16 | MIT | none — cross-platform content discovery is out of scope | DO NOT BUILD | out of scope (discovery, not production) |
| picgo | generic image upload in DSH ecosystem | [Molunerfinn/PicGo](https://github.com/Molunerfinn/PicGo) | 26,986 / 2026-08-16 | MIT | none — generic image upload out of scope | DO NOT BUILD | out of scope (taskbook) |
| social-auto-upload | none in repo | [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload) | 14,251 / 2026-08-16 | **none (no license file)** | none — no explicit license → no vendoring; publish automation is adapter-only | DO NOT BUILD | no explicit license → vendoring forbidden |
| dsh-web-search | DSH web capability | DSH web capability | n/a / 2026-08-16 | n/a | none — generic web search out of scope | DO NOT BUILD | out of scope (taskbook) |
| dsh-news-briefing | DSH news/briefing tooling | DSH ecosystem | n/a / 2026-08-16 | n/a | none — generic briefing out of scope | DO NOT BUILD | out of scope (taskbook) |
| dsh-media-crawler | DSH media crawling tooling | DSH ecosystem | n/a / 2026-08-16 | n/a | none — generic crawling out of scope | DO NOT BUILD | out of scope (taskbook) |
| dsh-article-publish | DSH article-publish tooling | DSH ecosystem | n/a / 2026-08-16 | n/a | none — superseded by creator-publish approval flow | DO NOT BUILD | must never bypass approval state machine |
| ffmpeg | existing dsh-forge plugin-ffmpeg (MIT) | existing dsh-forge plugin-ffmpeg | n/a / 2026-08-16 | MIT | REUSE existing ffmpeg adapter via core provider | REUSE | no second wrapper; no free-form ffmpeg strings |

## Rules derived from this matrix (binding)

1. **Never vendor** GPL/AGPL/unknown-license upstreams; adapter/provider only.
2. `social-auto-upload` has **no explicit license** → DO NOT BUILD, never vendor.
3. `creator-clips` **REUSES** the existing ffmpeg adapter — no re-implementation.
4. Out-of-scope capabilities (generic web search, news briefing, media crawler,
   image upload, cross-platform discovery) are not rebuilt.
5. Upstreams checked on 2026-08-16; re-check before pinning in a plugin issue.

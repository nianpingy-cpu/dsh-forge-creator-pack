# Upstream Licenses — DSH Forge Creator Pack

> CREATOR-001 — license registry for every candidate upstream. Integration
> mode must be consistent with the license. Copyleft and unclear licenses
> force adapter/provider integration (never vendoring). Checked 2026-08-16.

## License registry

| Project | License (SPDX / note) | Integration allowed | Notes |
|---|---|---|---|
| [sansan0/TrendRadar](https://github.com/sansan0/TrendRadar) | GPL-3.0 | adapter (MCP/HTTP/RSS), external service | GPL → no source copying; consume data over HTTP/MCP |
| [DIYgod/RSSHub](https://github.com/DIYgod/RSSHub) | AGPL-3.0 | HTTP feed consumption | AGPL → treat feeds as data; never vendor code |
| [yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp) | Unlicense (public domain) | external CLI binary | invoke with typed argv[]; no shell strings |
| [openai/whisper](https://github.com/openai/whisper) | MIT | external model/binary provider | MIT permits, but keep provider boundary |
| [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | MIT | provider-compatible adapter | do not vendor the upstream app |
| [mifi/lossless-cut](https://github.com/mifi/lossless-cut) | GPL-2.0 | none (DO NOT BUILD) | GUI app; capability covered by ffmpeg adapter |
| [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) | GPL-3.0 | HTTP/API adapter to external service | GPL → no source copying |
| [myshell-ai/OpenVoice](https://github.com/myshell-ai/OpenVoice) | MIT | provider (OpenVoice-compatible) + mock | keep authorization gate for cloning |
| [Huanshere/VideoLingo](https://github.com/Huanshere/VideoLingo) | Apache-2.0 | provider-compatible adapter + mock | Apache-2.0 reference OK; keep adapter boundary |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | **Remotion License (custom; GitHub reports NOASSERTION)** | generic HTTP/command provider interface only | Company/commercial use is paid; free for individuals; **no vendoring** — see gate below |
| [gitroomhq/postiz-app](https://github.com/gitroomhq/postiz-app) | AGPL-3.0 | API adapter to external service | AGPL → no source copying |
| [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload) | **none (no license file)** | none — DO NOT BUILD | No explicit license → vendoring and partial copying forbidden |
| [whiteguo233/OpenBiliClaw](https://github.com/whiteguo233/OpenBiliClaw) | MIT | none (out of scope) | existing DSH plugin `whiteguo233/dsh-openbiliclaw` is BSD-3-Clause |
| [Molunerfinn/PicGo](https://github.com/Molunerfinn/PicGo) | MIT | none (out of scope) | generic image upload reused from ecosystem |
| existing dsh-forge `plugin-ffmpeg` | MIT (dsh-forge repo) | REUSE via core provider | creator-clips reuses it; no re-implementation |

## License gates (binding)

1. **Remotion gate** — the Remotion license is NOT a standard SPDX license
   (GitHub reports `NOASSERTION`). Before any `creator-motion` implementation:
   re-check the current license and commercial/distribution restrictions, and
   record the conclusion here. Do NOT vendor Remotion; implement only a generic
   HTTP/command provider interface plus a fully-local deterministic mock
   renderer so CI never needs Remotion.

   **CREATOR-012 implementation-time re-check (2026-08-16):** Remotion's
   LICENSE is the custom "Remotion License" (GitHub reports `NOASSERTION`);
   it permits free use for individuals and non-commercial/open-source projects
   but requires a paid Company License for company/commercial use, and
   redistribution of the source/engine carries obligations. Conclusion: **do
   NOT vendor or reimplement Remotion**. `plugin-creator-motion` ships a
   generic Remotion-compatible HTTP/command provider interface (unconfigured ->
   typed ToolFailure) plus a fully-local deterministic mock renderer with
   built-in template fixtures; CI uses only the mock. (Re-check note: direct
   license re-fetch from github.com was blocked by the sandbox network policy
   at implementation time; the conclusion relies on the CREATOR-001 record and
   the conservative gate: no vendoring, no company-licensed rendering in CI.)
2. **social-auto-upload gate** — no license file → never vendor, never partially
   copy. CN-platform automation in `creator-publish` uses an adapter /
   `LocalAutomationProvider` whose behavior is described from the API/CLI
   surface only, never derived from copied source.
3. **GPL/AGPL gate** — adapter/provider (API / external service / CLI) only.
   No source file from a GPL/AGPL project enters this repository.
4. **Unlicense** — public domain, safe for CLI-binary integration, but still
   invoked through typed argv[] (never shell strings).

## Copying policy

No GPL / AGPL / unclear-license project source is copied into this repository.
MIT/Apache projects may be referenced but the Creator Pack keeps adapter /
provider boundaries to avoid license contamination and dependency drift.

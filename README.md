# DSH Forge Creator Pack

Typed, safe **creator-workflow plugins** for DeepSeek Harness (`dsh`): from
topic discovery and licensed media capture, through transcription, short-form
production, covers, voice, localization and motion, to **controlled
multi-platform publishing** (draft → preview → approval → publish → verify).

This is a dedicated repository. It adapts `@dsh-forge/core` (MIT) into
`@dsh-forge-creator/core` and extends it with Creator-domain contracts
(assets, rights, providers, publish state machine, credentials, policy). Every
plugin reuses that single core — process runner, workspace policy, permission
classes, diagnostics and the contract test kit. No second infrastructure.

> The product line: **DSH Forge Creator Pack — 让 DeepSeek Harness 不只是帮你想内容，
> 而是真正完成从选题、素材、制作到受控发布的创作者工作流。**

## Creator Pack

Typed, safe creator-workflow plugins for DeepSeek Harness, organized into four
composable presets and guided by authoring skills:

- **creator-research** — topic radar → licensed capture → transcription.
- **creator-video** — long-form → short-form: transcribe, clip, vertical,
  subtitle, cover, voice, localize, motion (+ ffmpeg media adapter).
- **creator-publisher** — approval-gated draft → preview → publish/schedule
  with cover assets and platform-specific writing skills.
- **creator-full** — every creator plugin + all 7 skills.

Entry points: [docs/creator/README.md](docs/creator/README.md) (index),
[QUICKSTART](docs/creator/QUICKSTART.md), [SAFETY](docs/creator/SAFETY.md),
[PROVIDERS](docs/creator/PROVIDERS.md), [EXAMPLES](docs/creator/EXAMPLES.md),
[RELEASE_NOTES](docs/creator/RELEASE_NOTES.md).

## Plugins (planned)

| Logical ID | Plugin | Purpose |
|---|---|---|
| CREATOR-004 | `plugin-creator-radar` | hot-topic & topic-scoring radar |
| CREATOR-005 | `plugin-creator-capture` | licensed media capture (yt-dlp adapter) |
| CREATOR-006 | `plugin-creator-transcribe` | creator-grade transcription & subtitles |
| CREATOR-007 | `plugin-creator-clips` | long-video clipping (reuses ffmpeg adapter) |
| CREATOR-008 | `plugin-creator-short-video` | topic/script → short-video job |
| CREATOR-009 | `plugin-creator-cover` | platform-ready cover/thumbnail |
| CREATOR-010 | `plugin-creator-voice` | authorized TTS / voice clone |
| CREATOR-011 | `plugin-creator-localize` | subtitle translation/alignment/localization |
| CREATOR-012 | `plugin-creator-motion` | template-driven motion renders |
| CREATOR-013 | `plugin-creator-publish` | draft/schedule/controlled publish |

Supporting tracks: Creator Core Contracts (CREATOR-002), Creator Safety Policy
(CREATOR-003), Creator Skills (CREATOR-014), Presets + E2E stories
(CREATOR-015), Release Hardening (CREATOR-016).

## Repository layout

```
packages/core/            adapted @dsh-forge/core + Creator contracts
packages/plugin-creator-*/  10 creator plugins
presets/                  creator-research / creator-video / creator-publisher / creator-full
skills/creator/           skill definitions (topic-to-outline, short-video-script, ...)
docs/creator/             ecosystem matrix, upstream licenses, safety, providers, examples
tests/                    contract / integration / e2e stories
reviews/PR-N/             external model review artifacts
```

## Commands

```sh
pnpm install
pnpm test           # vitest unit tests
pnpm typecheck
pnpm lint
pnpm build
pnpm coverage       # CI coverage gate
```

## Safety defaults

- No remote publish without explicit approval (draft/preview/dry-run by default).
- No arbitrary shell; typed argv[], env allowlist.
- Workspace-bound writes; rights/provenance metadata on every asset.
- Voice clone requires authorization; CI uses synthetic/own fixtures only.
- GPL/AGPL/unknown-license upstreams are adapter/provider only, never vendored.

## License

MIT — see [LICENSE](LICENSE). The adapted core retains the MIT notice of the
upstream `dsh-forge` core.

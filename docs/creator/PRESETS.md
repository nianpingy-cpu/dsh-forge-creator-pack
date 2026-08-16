# Creator Presets + E2E Stories (CREATOR-015)

## Presets

`presets/presets` ships `@dsh-forge-creator/presets` — composition-only
manifests (`CreatorPreset`) that reference already-implemented plugin packages
and the creator skills that guide their use. No plugin code is duplicated.

| Preset | Plugins | Skills |
| --- | --- | --- |
| `creator-research` | creator-radar, creator-capture, creator-transcribe | topic-to-outline |
| `creator-video` | creator-transcribe, creator-clips, creator-short-video, creator-cover, creator-voice, creator-localize, creator-motion, plugin-ffmpeg | short-video-script, platform-repurpose |
| `creator-publisher` | creator-cover, creator-publish | xiaohongshu-writing, bilibili-metadata, youtube-metadata, creator-humanize |
| `creator-full` | all creator plugins + plugin-ffmpeg | all 7 skills |

A host loads a preset and registers every referenced plugin/tool; the preset
also declares the skill slugs that describe HOW to use those tools well.
`PRESETS` is validated in `presets/presets/tests/presets.test.ts` (exact plugin
sets, no tool collisions, skills exist on disk, `creator-full` = union of the
other three, core contract version matches).

## E2E Stories

Deterministic end-to-end stories in `tests/creator-e2e/` drive the real plugin
tools through a shared harness (`harness.ts`) over a fresh temp workspace with
a canned media runner (ffprobe 10s 9:16, ffmpeg ok, downloaders ok). No
external accounts, no network, no binaries.

| Story | Flow | File |
| --- | --- | --- |
| A — 热点到素材 | trend_fetch → opportunity_rank → select source → media_inspect → authorized capture (approval-gated) | `story-a-research.test.ts` |
| B — 长视频到短视频 | transcribe_media → choose segment → clip_by_time → make_vertical → subtitle_srt | `story-b-short-video.test.ts` |
| C — 海外本地化 | subtitle_translate → subtitle_align → tts_generate (mock) → localize_video | `story-c-localize.test.ts` |
| D — 封面变体 | cover_generate_background → cover_variants → cover_validate | `story-d-cover.test.ts` |
| E — 安全发布 | post_create_draft → post_preview → blocked without approval → approval → post_publish → post_status | `story-e-publish.test.ts` |

Story E is the security-critical one: the draft lifecycle can never publish
before an explicit `creator-remote-publish` approval is supplied, and the test
asserts the unapproved call returns `PermissionDenied`.

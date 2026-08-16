# Creator Pack — Examples (CREATOR-016)

The five deterministic E2E stories in `tests/creator-e2e/` are the canonical
examples. This page turns them into operator walkthroughs.

## Example 1 — Hot topic to assets (Story A)

```text
trend_fetch(mock) → opportunity_rank → pick source → media_inspect
→ media_download (rights + approval) → CreatorAsset
```

1. `trend_fetch({ source: "mock" })` returns normalized topics with evidence.
2. `opportunity_rank({})` returns the top-ranked opportunities.
3. `media_inspect({ sourceUrl })` probes format/streams.
4. `media_download({ sourceUrl, outputPath, rights:{status:"owned"},
   conflict:"fail" })` — requires `ctx.permission.approved === true`; without
   it the tool returns `PermissionDenied`.

## Example 2 — Long video to short (Story B)

```text
transcribe_media → choose a segment → clip_by_time → make_vertical
→ subtitle_srt
```

`make_vertical` verifies the rendered output is 9:16 by re-probing with
ffprobe and fails with `ToolFailure` on an aspect mismatch.

## Example 3 — Overseas localization (Story C)

```text
subtitle_translate (mock) → subtitle_align → tts_generate (mock voice)
→ localize_video → loc/localized.srt
```

Translation preserves valid SRT timestamps; alignment rejects negative time;
TTS is optional and uses the authorized-reference voice model.

## Example 4 — Cover variants (Story D)

```text
cover_generate_background (1600x900) → cover_variants([youtube-thumbnail,
x-image, douyin-vertical]) → cover_validate each variant
```

Each variant is validated against its own platform profile (dimensions + safe
area); a wrong profile fails validation.

## Example 5 — Safe publishing (Story E)

```text
post_create_draft → post_preview → post_publish (NO approval) → PermissionDenied
post_publish (approval) → published → post_status → published
```

This is the security-critical path: the lifecycle can never publish before an
explicit `creator-remote-publish` approval is supplied.

## Determinism guarantee

All stories run mock providers over a fresh temp workspace with a canned media
runner — no external accounts, no network, no binaries. Run them with:

```sh
pnpm exec vitest run tests/creator-e2e
```

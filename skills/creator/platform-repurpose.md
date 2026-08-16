# Platform Repurpose

## Purpose
Adapt one piece of source content (a long video, a transcript, or a post) into
multiple platform-ready variants without re-researching from scratch, keeping
each variant native to its platform.

## Trigger
- A long-form video or article exists and should be cut into shorts, quotes,
  and metadata for several platforms.
- The creator wants one idea expressed natively on youtube, bilibili,
  xiaohongshu, and x.

## Inputs
- A source media file or transcript.
- The set of target platforms.

## Workflow
1. Transcribe the source with `transcribe_media` and export the plain text
   with `transcript_export`.
2. Detect natural chapters with `chapter_detect` and cut the strongest moments
   with `clip_by_time` or `clip_by_chapter`.
3. For vertical platforms, reformat with `make_vertical`; for square feeds use
   `make_square`.
4. Generate a cover per platform with `cover_variants` (e.g.
   `youtube-thumbnail`, `xiaohongshu-portrait`, `x-image`).
5. Draft a localized subtitle for other languages with `subtitle_translate`
   (keeping timestamps valid) and align it with `subtitle_align`.
6. Create a draft post with `post_create_draft` for each platform, then stop —
   publishing requires the approval flow.

## Tool preference
- `transcribe_media`, `chapter_detect`, `clip_by_time`, `make_vertical`,
  `make_square`, `cover_variants`, `subtitle_translate`, `subtitle_align`,
  `post_create_draft`.
- Reads are always safe; writes stay inside the workspace until approval.

## Quality checklist
- Each variant is native to its platform (ratios, hooks, lengths).
- Covers match the platform profile dimensions (validated by `cover_validate`).
- Subtitles keep valid cue timestamps after translation.
- Drafts are ready for human review, not auto-published.

## Platform constraints
- Respect each platform's cover dimensions and safe areas (see
  `cover_layout`).
- Not all platforms support scheduling; check `publisher_capabilities` before
  planning a schedule.

## Failure / uncertainty handling
- If a clip or cover fails validation, report the typed diagnostic and do not
  force a publish.
- If a language pair is unsupported, state it and skip translation.

## Do-not-do rules
- Do not publish or schedule any variant without explicit approval.
- Do not claim a repurposed post is certain to perform well.
- Do not include tokens or credentials in any output.

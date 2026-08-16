# Bilibili Metadata

## Purpose
Produce complete, accurate bilibili upload metadata (title, description,
tags, cover) for a video, following the platform's metadata conventions so the
video is findable — as a heuristic, not a guaranteed-discovery promise.

## Trigger
- A video has been produced and needs bilibili title/description/tags/cover.
- Updating metadata for an existing bilibili upload.

## Inputs
- The video file or transcript.
- Optional: existing outline or title candidates.

## Workflow
1. Transcribe the video with `transcribe_media` if no script exists.
2. Summarize the strongest 1-2 ideas for the title.
3. Write a description that states what the video shows and why it matters.
4. Pick 3-6 tags from the transcript keywords (Chinese + English where
   natural).
5. Generate a bilibili cover with `cover_add_title` on the `bilibili-cover`
   profile and validate with `cover_validate`.
6. Create a draft post with `post_create_draft`; publishing requires approval.

## Tool preference
- `transcribe_media` for the script/keywords.
- `cover_add_title`, `cover_validate` for the cover.
- `post_create_draft` for the metadata draft.

## Quality checklist
- Title is under the platform limit and includes the core keyword.
- Description is 2-4 sentences with a clear payoff.
- Tags are accurate and derived from the content, not stuffed.
- Cover text fits the profile and is legible.

## Platform constraints
- bilibili cover ratio ~1146x717; keep text clear.
- Tags have length limits; use the most relevant few.

## Failure / uncertainty handling
- If transcription is thin, use the outline instead and flag uncertainty.
- If a tag is not clearly supported, drop it rather than guessing.

## Do-not-do rules
- Do not make claims about how the video will rank or perform.
- Do not auto-publish; `post_publish` requires explicit approval.
- Do not include tokens or credentials in any output.

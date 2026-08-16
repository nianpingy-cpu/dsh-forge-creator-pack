# Youtube Metadata

## Purpose
Produce youtube upload metadata (title, description, tags, thumbnail) with
SEO-conscious but honest phrasing, following youtube conventions for
findability — presented as a heuristic, never a guaranteed-rank promise.

## Trigger
- A video is ready and needs youtube title/description/tags/thumbnail.
- Refreshing metadata for an existing video.

## Inputs
- The video file or transcript.
- Optional: existing outline or title candidates.

## Workflow
1. Transcribe the video with `transcribe_media` if no script exists.
2. Draft a title that names the concrete topic and payoff.
3. Write a description with 1-2 lead sentences, a short summary, and a clear
   call to action.
4. Derive 3-5 tags from the transcript keywords.
5. Generate a 16:9 thumbnail with `cover_add_title` on the
   `youtube-thumbnail` profile and validate with `cover_validate`.
6. Create a draft post with `post_create_draft`; publishing requires approval.

## Tool preference
- `transcribe_media` for script/keywords.
- `cover_add_title`, `cover_validate` for the thumbnail.
- `post_create_draft` for the metadata draft.

## Quality checklist
- Title is specific, under the limit, and free of clickbait.
- Description opens with the value of the video.
- Tags reflect actual content.
- Thumbnail text is large enough to read at small size and within the safe
  area.

## Platform constraints
- Thumbnail is 1280x720; text must be legible at small scale.
- Keep titles honest: no exaggerated claims.

## Failure / uncertainty handling
- If transcription fails, fall back to the outline and mark wording as
  unverified.
- If a term is ambiguous, prefer the clearer phrasing.

## Do-not-do rules
- Do not make claims about how the video will rank.
- Do not auto-publish; `post_publish` requires explicit approval.
- Do not include tokens or credentials in any output.

# Xiaohongshu Writing

## Purpose
Write native xiaohongshu (RED) posts — a scannable hook, a personal first-person
voice, honest value, and emoji used with restraint — that fit the platform's
3:4 portrait covers and long-text culture.

## Trigger
- Repurposing an outline or transcript into a xiaohongshu post.
- Writing a new post that should feel native to xiaohongshu, not like a generic
  blog.

## Inputs
- An outline, topic, or transcript.
- Optional: a source image or video for the cover.

## Workflow
1. Extract the single most useful takeaway from the outline/transcript.
2. Write the post: a scannable hook title, a short first-person intro, 3-5
   bullet-style sections, and a lightweight call to action.
3. Draft a 3:4 cover with `cover_add_title` on the `xiaohongshu-portrait`
   profile; validate with `cover_validate` (text inside the safe area).
4. Keep the post under the platform's comfortable reading length.
5. Create a draft post with `post_create_draft`; do not publish from this
   skill.

## Tool preference
- `cover_add_title`, `cover_validate` for the cover.
- `post_create_draft` for the post draft.
- `trend_search` (optional) to check the topic is still current.

## Quality checklist
- The title states a concrete benefit or strong opinion.
- The body is specific and first-person, not corporate boilerplate.
- Cover text fits the portrait safe area and is readable at small size.
- Emoji are used sparingly and never replace the actual content.

## Platform constraints
- Cover ratio is 3:4; text must stay within the safe area.
- xiaohongshu does not support API scheduling through the mock; check
  `publisher_capabilities` before promising a schedule.

## Failure / uncertainty handling
- If cover text overflows, shorten the title and re-validate.
- If the topic is saturated, suggest a sharper angle rather than forcing a post.

## Do-not-do rules
- Do not make trend-outcome claims in the post title or body.
- Do not auto-publish; `post_publish` requires explicit approval.
- Do not include tokens or credentials in any output.

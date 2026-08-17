# Topic to Outline

## Purpose
Turn a broad topic into a structured, publishable content outline by grounding
it in current signal (what people are actually discussing), then shaping it
into a narrative with an angle, a hook, and supporting points.

## Trigger
- The creator has only a topic or a keyword and needs an outline before writing
  or producing.
- A draft outline exists but is generic and not grounded in evidence.

## Inputs
- A topic or keyword phrase.
- Optional: existing notes, transcript segments, or a source URL.

## Workflow
1. Discover what is currently active around the topic: call `trend_sources` to
   list sources, then `trend_fetch`/`trend_search` for recent items.
2. Score the candidates with `topic_score` and pick 2-3 evidence anchors.
3. Draft a narrative: hook, angle, 3-5 supporting points, and a call to action.
4. If an audio/video source exists, run `transcribe_media` and pull the
   strongest moments into the outline.
5. Optionally rank opportunities with `opportunity_rank` to choose the angle.

## Tool preference
- `trend_sources`, `trend_fetch`, `trend_search`, `topic_score` for signal.
- `opportunity_rank` for angle selection.
- `transcribe_media` when transcribing an existing recording.
- Keep reads read-only; do not generate or publish content from this skill.

## Quality checklist
- The outline has a clear hook and a single angle.
- Every claim is grounded in a fetched source or transcribed evidence.
- The outline is specific enough that a writer could produce it without more
  research.

## Platform constraints
- Different platforms reward different lengths and hooks; keep the outline
  platform-agnostic and let platform-specific skills (e.g.
  `xiaohongshu-writing`) adapt it.
- Never fabricate source details; only cite what `trend_fetch` actually
  returned.

## Failure / uncertainty handling
- If a source fetch fails or returns nothing useful, say so and fall back to
  the topic's domain knowledge, flagged as unverified.
- If search results are thin, widen the keyword once, then stop — do not loop.

## Do-not-do rules
- Do not invent statistics, quotes, or source attributions.
- Do not call `post_publish` or `post_schedule` from this skill (publishing
  requires the creator-publish approval flow).
- Do not include tokens or credentials in any output.

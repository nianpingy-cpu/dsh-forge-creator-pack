# Creator Humanize

## Purpose
Rewrite machine-sounding drafts so they read like a real creator wrote them —
natural rhythm, concrete detail, and a distinct voice — while keeping facts
accurate and claims honest.

## Trigger
- A script, caption, or description feels stiff, templated, or AI-generated.
- The creator wants a draft adapted to their personal tone.

## Inputs
- The draft text (script, caption, description).
- Optional: notes on the creator's voice (formal/casual, humor level).

## Workflow
1. Identify the stiff patterns: repeated sentence starts, over-precise
   transitions, hedging fillers.
2. Rewrite for spoken or native social rhythm: shorter sentences, concrete
   nouns, one human detail per section.
3. Preserve every factual claim — change wording, not meaning.
4. Re-read the result aloud mentally; tighten anything that still sounds
   templated.

## Tool preference
- Reads the draft; optionally pulls source wording with `transcript_export`.
- Does not regenerate media; use `short_video_plan` after the script is final.

## Quality checklist
- No two consecutive sentences share the same opening structure.
- Facts are unchanged from the source.
- The rewrite keeps the platform's constraints (length, hooks).
- It reads like one person wrote it.

## Platform constraints
- Keeps the target platform's length and ratio constraints from the original
  plan.
- Honest tone is required on all platforms; no fabricated testimonials.

## Failure / uncertainty handling
- If a claim is unverifiable, flag it for the creator rather than embellishing.
- If the creator's voice is unknown, ask or default to a plain spoken tone.

## Do-not-do rules
- Do not invent quotes, statistics, or results to make the text livelier.
- Do not make performance-outcome claims in the rewrite.
- Do not change factual content to sound more natural.

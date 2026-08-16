# Short Video Script

## Purpose
Write a tight, spoken-word short-video script (hook, body, payoff) that maps to
a `short_video_plan` and can be generated with the mock or an external
provider.

## Trigger
- The creator has an outline or topic and needs a 30-90 second spoken script.
- Repurposing a longer piece into short-form.

## Inputs
- An outline, topic, or transcript (optionally from `transcript_export`).
- Target platform / aspect ratio and target duration.

## Workflow
1. Identify the single strongest hook from the outline or transcript.
2. Write the script in spoken language: hook (0-5s), 2-4 beats, payoff.
3. Map the script to a plan: call `short_video_plan` with the script,
   `aspectRatio`, `durationTarget`, `voiceMode`, `subtitleMode`, and
   `assetStrategy`.
4. Validate the plan reads well aloud; keep sentences under ~8 seconds each.
5. If a mock generation is desired, call `short_video_generate` and poll
   `short_video_status` until complete, then review `short_video_assets`.

## Tool preference
- `short_video_plan` to structure the job.
- `short_video_generate` / `short_video_status` / `short_video_assets` for a
  mock run.
- `transcript_export` to pull wording from an existing recording.
- Do not publish from this skill.

## Quality checklist
- The first line is a hook that promises a payoff.
- Every sentence is short and spoken naturally.
- The script fits `durationTarget` within ±10%.
- No filler or hedging that weakens the payoff.

## Platform constraints
- Vertical platforms (douyin, xiaohongshu) favor a fast hook and on-screen
  text; keep `subtitleMode` burned for silent viewing.
- Do not assume a platform will perform a certain way; treat engagement rules
  as heuristics.

## Failure / uncertainty handling
- If `short_video_generate` times out, check `short_video_status` once and
  report the job id rather than resubmitting blindly.
- If the provider is unavailable, state that only the mock ran.

## Do-not-do rules
- Do not make claims about how the video will perform.
- Do not call `post_publish` / `post_schedule` — publishing requires explicit
  approval.
- Do not include tokens or credentials in any output.

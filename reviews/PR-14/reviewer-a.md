# PR #14 Review — CREATOR-007 creator-clips

Independent external model review (non-implementer). One round.

## Round 1 — APPROVE
- **Reuse vs reimplementation**: verified creator-clips contains ZERO
  ffmpeg/ffprobe argv generation (all `-ss`/`-af`/`silenceremove=`/`scale=`
  matches are in comments/imports). It composes the carried-in adapter via
  `callAdapter`/`probeDuration`, passing the same ToolContext so the adapter's
  hardening (workspace boundary, overwrite guard, protocol whitelist, playlist
  rejection, no shell, permission gate) applies unchanged.
- **Carry-in fidelity**: diffed against the original
  `@dsh-forge/plugin-ffmpeg` — 8 original tools byte-identical; changes are
  attribution header, import path, and the 3 new fixed typed additions
  (`video_vertical`/`video_square`/`silence_remove`). Genuine REUSE.
- **Ratio verification real**: `runAspect` writes then probes the output via
  ffprobe (`-select_streams v:0 -show_entries stream=width,height`) and fails
  if `|actual - expected| > 0.02` (9:16 / 1:1).
- **RED tests all discriminating** (would fail on stubs): invalid range,
  start>=end, outside duration, batch collision, wrong aspect, no shell
  injection — plus PermissionDenied, mm:ss, empty-inputs coverage.
- **Core changes backward compatible**: `runnerByTool` (undefined by default)
  and union value types (single-string schemas unchanged).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 308/14
  files, clips 21/21, ffmpeg 72/72.
- **TDD history verified**: `e0f8773` RED (stubs throw) -> `c94cd89` GREEN.
- **License clean**: MIT carry-in with attribution; no vendored binaries;
  fixtures are tiny synthetic test media.
- Non-blocking: case-sensitive batch collision (overwrite guard still
  protects); best-effort duration guard on unparseable probes; `withinDuration`
  checks only `end` (safe: `start < end` guaranteed).
- Final merge recommendation: **Merge**.

## Evidence
- RED (`e0f8773`): 21 fail (all 8 tool stubs throw "not implemented")
- GREEN (`c94cd89`): 21 pass
- Fixture fix (`0d0fa22`): fixtures moved to `packages/plugin-ffmpeg/tests/fixtures/`
  to satisfy gitignore policy (CI was failing on missing `fixtures/ffmpeg`)
- Final: 21 clips tests; 72 ffmpeg adapter tests; full suite 308; typecheck 0;
  lint 0; CI green.
- Merge commit: `1c83de7` (PR #14)

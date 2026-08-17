# PR #10 Review — CREATOR-005 creator-capture

Independent external model review (non-implementer). Four rounds.

## Round 1 — REQUEST_CHANGES
- Blocking: B1 (workspace-write download tools never gate on ctx.permission);
  B2 (`rights:null` silently defaults to "owned" via RIGHT_CONFIRMED fallback);
  B3 (playlist_download never calls assertRightsPolicy); B4 (playlist_download
  bypasses assertWithinResourceLimits — unbounded playlist).
- Non-blocking: N1 playlist conflict ignored; code mapping; bypass-flag no-op;
  sync hash; hardcoded timeouts; sourceUrl echoed; doc nit.

## Round 2 — REQUEST_CHANGES
- B4 incompletely fixed: `playlistLimit: 0`/negative bypasses the resource gate
  (unbounded download); regression over-fit to 5001.

## Round 3 — REQUEST_CHANGES
- NEW blocking: inspect tools (media_inspect/media_formats/playlist_inspect)
  omit `redact: [sourceUrl]` — yt-dlp -J embeds the URL; credentialed URLs leak.

## Fixes applied (regression TDD)
- B1 permission gate, B2 explicit rights (no owned fallback), B3 playlist
  rights, B4 clamp 1..50 + reject non-positive, N1 conflict in playlist argv,
  inspect redaction (runInspect secrets + callers), tool-level workspace
  escape test.

## Round 4 — APPROVE
- No blocking findings; all prior findings closed with genuine regression tests
  (verified failing on pre-fix code); no regressions/over-fitting.
- Non-blocking residuals (minor): media_formats doc mismatch; playlist_inspect
  non-integer limit; derived signed-URL redaction scope.
- Final merge recommendation: **Merge**.

## Evidence
- RED (`1b1e7b9`): 7 fail (argv stubs)
- GREEN (`80eeb63`): 11 pass
- Final: 19 capture tests; full suite 189; typecheck 0; lint 0; CI pass
- Merge commit: `adcf758` (PR #10)

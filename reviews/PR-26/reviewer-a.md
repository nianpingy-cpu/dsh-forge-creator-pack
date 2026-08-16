# PR #26 Review — CREATOR-013 creator-publish

Independent external model review (non-implementer). One round + NB hardening.

## Round 1 — APPROVE (merge-ready)
- **Approval gate**: every remote mutation (publish/schedule -> scope
  creator-remote-publish; cancel -> creator-remote-destructive) calls core
  `assertCreatorApproval` (content-hash bound, scope bound, expiry checked) ->
  PermissionDenied. RED tests cover publish/schedule/cancel without approval +
  expired approval.
- **No immediate remote publish**: create-draft/validate/preview never call
  provider publish (RED tests assert publishCallCount unchanged).
- **Idempotency + retry safety**: default key `draft-<id>`; MockPublisher
  idempotent by key; on "unknown" status the tool queries provider.status
  BEFORE resending; "request failed" explicitly safe to retry with the same
  key. RED tests: idempotency-key no-duplicate, retry-no-duplicate (with a
  simulated "failed" outcome), unknown-status query-before-resend.
- **Credentials never in result**: redactCredentials applied to all outputs
  (incl. status now); RED test asserts no credential patterns.
- **CI provider mock only**: postiz/official/local are unconfigured external
  adapters -> typed ToolFailure; no Postiz source vendored; metadata discloses
  AGPL-3.0 external adapter; no browser anti-detection logic in core/plugin.
- **Dry-run + capability discovery**: dryRun returns without publish; caps
  differ per platform (xiaohongshu scheduling false vs youtube true).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 411, publish
  19/19, TDD history verified (70162c3 RED -> 412da7c GREEN).
- Non-blocking: NB-1 idempotency test weak assertion (strengthened); NB-2 no
  distinct retry test / "failed" outcome missing (added); NB-3 publishCallCount
  trivial assertion (replaced with postCount delta); NB-4 status not redacted
  (fixed).
- Final merge recommendation (Round 1): **Merge**.

## NB hardening applied before merge
- MockPublisher gained a "failed" publishOutcome (records nothing) so the
  "network retry does not duplicate publish" path has a real discriminating
  test.
- Idempotency + unknown-status tests now assert a postCount delta of exactly 1
  and the same postId.
- post_status / post_publish / post_schedule success outputs now pass through
  redactCredentials.

## Evidence
- RED (`70162c3`): 19 fail (all 9 tool stubs throw "not implemented")
- GREEN (`412da7c`): 19 pass
- NB hardening (`b759f24`): 20 pass
- Final: 20 publish tests; full suite 412; typecheck 0; lint 0; CI green.
- Merge commit: `0bee4d4` (PR #26)

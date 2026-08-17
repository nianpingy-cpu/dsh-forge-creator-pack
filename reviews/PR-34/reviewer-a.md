# Reviewer A — PR #34 (CREATOR-016 §30 Final Acceptance Coverage)

- PR: https://github.com/nianpingy-cpu/dsh-forge-creator-pack/pull/34
- Base → head: `release/v0.1.0` → `V0.1.0/issue-033-final-acceptance`
- Reviewer: independent external model (runSubagent), research-only, empirical
  verification against the local checkout.
- Result: **APPROVE** (no blocking findings).

## Verified

1. `pnpm exec vitest run tests/creator-e2e` → 8 files / 11 tests pass; full
   suite 442 tests / 31 files; typecheck/lint/test/gate green; CI verify +
   creator-contract green.
2. RED `ad2d145` genuinely failed: `git ls-tree` shows story-f/g absent at that
   commit; the coverage test maps scenario-7/8 to those files so
   `expect(missing).toEqual([])` failed. GREEN `76c27ed` adds both stories;
   REFACTOR `3fcc205` docs-only.
3. Story F is discriminating: positive control (publish A with A's approval →
   published) + negative (publish different B with A's approval →
   PermissionDenied), backed by core `assertCreatorApproval` content-hash
   binding against the draft record's own hash.
4. Story G exercises the unknown → query → resolve path: forces
   `__mockPublisher.publishOutcome = "unknown"`, restores in `finally`, asserts
   status "published" + postCount delta 1. (NB: publishCallCount delta added in
   `650b11c` to discriminate query-then-resolve from a blind resend into the
   idempotent mock.)
5. Story A's `topic_score` addition asserts `scores.opportunity` is a number
   for the ranked top pick (Scenario 1).
6. `docs/creator/ACCEPTANCE.md` 8-scenario map matches taskbook §30 verbatim
   and the run log is honest (Windows fresh clone + CI ubuntu).
7. No determinism/flakiness risk: vitest default isolate gives each file a
   fresh worker; no cross-file mock-state leakage.

## Blocking findings

None.

## Non-blocking notes (disposition)

1. **ACCEPTANCE.md run-log test count was stale** (438→440, actual 442/31) —
   corrected to 442 tests / 31 files. FIXED (commit `650b11c`).
2. **Story G lacked a publishCallCount assertion** — added
   `publishCallCount - callsBefore === 1` so the test discriminates
   query-then-resolve from a blind resend into the idempotent mock. FIXED
   (commit `650b11c`).
3. **`__mockPublisher` imported from package src** — documented test hook in
   providers.ts, consistent with publish.test.ts; acceptable, no change.
4. **Latent same-process re-run caveat** (fixed key + singleton counters) —
   non-issue in practice under vitest default isolate. Accepted.

# PR #16 Review — CREATOR-008 creator-short-video

Independent external model review (non-implementer). One round + NB cleanup.

## Round 1 — APPROVE
- **Plan schema centralized**: all allowed aspect ratios / voice / subtitle /
  asset modes and duration bounds come from `types.ts` constants; defaults
  applied in `plan.ts`; unsupported values rejected as InvalidArguments.
- **No-plan gate**: `short_video_generate` requires `plan` (schema + explicit
  guard) -> InvalidArguments.
- **Workspace boundary**: `resolveOutputDir` uses
  `assertCreatorAssetInWorkspace` (symlink-safe canonicalization); `../`
  escapes -> WorkspaceViolation.
- **Provider design**: deterministic MockShortVideoProvider (queued ->
  progressing -> complete), module-level singleton shares the job store across
  generate/status/assets calls; pre-seeded completed sample job "mock-1" makes
  stateless checks deterministic; MoneyPrinterTurbo-compatible provider is a
  stub adapter only (typed ToolFailure + config hint, no vendored upstream).
- **Timeout / poll cap**: generate waitForComplete polls bounded by
  maxPollAttempts (default 10) -> typed Timeout; status enforces the same cap.
- **No external URL / credential leak**: assets/preview are workspace-relative
  and pass through redactExternalRefs; tests assert no http(s):// or
  credential patterns.
- **RED tests discriminating** (verified fail on naive impl); TDD history
  verified (d600024 RED -> 9881b86 GREEN).
- **Gates green (run by reviewer)**: typecheck 0, lint 0, full suite 327/15,
  short-video 19/19, CI verify + creator contract pass.
- **License clean**: MIT upstream recorded in ECOSYSTEM_MATRIX/UPSTREAM_LICENSES;
  provider-compatible adapter + mock, no vendoring.
- Non-blocking: NB-1 poll timeout-branch ordering (documented); NB-2 dead
  `deriveScript` (removed); NB-3 missing PermissionDenied test (added); NB-4
  redaction scope (user-supplied script echoed in preview is user content, not
  a provider leak — accepted); NB-5 canonical path discarded (comment added).
- Final merge recommendation (Round 1): **Merge**.

## NB cleanup applied before merge
- NB-2: removed unused `deriveScript`.
- NB-3: added a `PermissionDenied` regression test for generate.
- NB-1: documented the poll timeout-branch ordering in `providers.ts`.
- NB-5: documented the canonical-path requirement for a future real provider.
- NB-4: accepted as a documented boundary (user-supplied script is user
  content).

## Evidence
- RED (`d600024`): 19 fail (all 5 tool stubs throw "not implemented")
- GREEN (`9881b86`): 19 pass
- NB cleanup (`8b321e9`): 20 pass
- Final: 20 short-video tests; full suite 327; typecheck 0; lint 0; CI green.
- Merge commit: `84af8a2` (PR #16)
